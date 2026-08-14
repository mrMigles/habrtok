import createDOMPurify from 'dompurify';

const ARTICLE_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'details',
  'div',
  'em',
  'figcaption',
  'figure',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'picture',
  'pre',
  's',
  'source',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'video',
] as const;

const ARTICLE_ATTRIBUTES = [
  'alt',
  'colspan',
  'controls',
  'height',
  'href',
  'poster',
  'rowspan',
  'src',
  'title',
  'type',
  'width',
] as const;

function safeUrl(value: string, allowFragment = false): string | null {
  if (allowFragment && value.startsWith('#')) return value;
  try {
    const url = new URL(value, 'https://habr.com');
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeArticleHtml(html: string): string {
  const sanitized = createDOMPurify(window).sanitize(html, {
    ALLOWED_ATTR: [...ARTICLE_ATTRIBUTES],
    ALLOWED_TAGS: [...ARTICLE_TAGS],
    ALLOW_DATA_ATTR: false,
  });
  const template = document.createElement('template');
  template.innerHTML = sanitized;

  for (const link of template.content.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = safeUrl(link.getAttribute('href') ?? '', true);
    if (!href) {
      link.removeAttribute('href');
      continue;
    }
    link.href = href;
    if (!href.startsWith('#')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  }

  for (const media of template.content.querySelectorAll<HTMLImageElement | HTMLSourceElement>(
    'img[src], source[src]',
  )) {
    const src = safeUrl(media.getAttribute('src') ?? '');
    if (!src) {
      media.remove();
      continue;
    }
    media.src = src;
    if (media instanceof HTMLImageElement) {
      media.setAttribute('loading', 'lazy');
      media.setAttribute('decoding', 'async');
    }
  }

  for (const video of template.content.querySelectorAll<HTMLVideoElement>('video[poster]')) {
    const poster = safeUrl(video.getAttribute('poster') ?? '');
    if (poster) video.poster = poster;
    else video.removeAttribute('poster');
  }

  return template.innerHTML;
}
