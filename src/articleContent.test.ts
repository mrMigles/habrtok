// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { sanitizeArticleHtml } from './articleContent';

describe('article content sanitizer', () => {
  it('keeps useful article markup and hardens links and media', () => {
    const html = sanitizeArticleHtml(`
      <div class="tm-article"><h2>Раздел</h2><p>Текст <strong>статьи</strong>.</p>
      <a href="/ru/articles/10/" onclick="steal()">Habr</a>
      <img src="//habrastorage.org/image.png" style="position:fixed" alt="Схема"></div>
    `);
    expect(html).toContain('<h2>Раздел</h2>');
    expect(html).toContain('<strong>статьи</strong>');
    expect(html).toContain('href="https://habr.com/ru/articles/10/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('src="https://habrastorage.org/image.png"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('class=');
  });

  it('removes scripts, iframes, event handlers, and unsafe protocols', () => {
    const html = sanitizeArticleHtml(`
      <script>alert(1)</script><iframe src="https://example.com"></iframe>
      <a href="javascript:alert(1)">bad link</a>
      <img src="data:image/svg+xml,evil" onerror="steal()">
      <pre><code>const safe = true;</code></pre>
    `);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:image');
    expect(html).not.toContain('onerror');
    expect(html).toContain('<pre><code>const safe = true;</code></pre>');
  });
});
