import { afterEach, describe, expect, it, vi } from 'vitest';
import { HabrBrowserSource, normalizeArticle, normalizeArticleDetail, normalizeList, plainText } from './source';

function rawArticle(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    timePublished: '2026-08-13T12:00:00+00:00',
    lang: 'ru',
    titleHtml: `Техническая статья ${id}`,
    postType: 'article',
    publicationType: 'article',
    status: 'published',
    author: { alias: `author${id}`, fullname: null, avatarUrl: '//habrastorage.org/avatar.png' },
    statistics: { readingCount: 1200, commentsCount: 12, favoritesCount: 44, score: 18 },
    hubs: [{ alias: 'webdev', title: 'Веб-разработка', titleHtml: 'Веб-разработка' }],
    tags: [{ titleHtml: 'TypeScript' }],
    leadData: {
      textHtml: `<p>Подробный анонс публикации ${id} с полезным техническим контекстом.</p>`,
      imageUrl: '//habrastorage.org/image.png',
      image: null,
    },
    readingTime: 7,
    complexity: 'medium',
    format: 'tutorial',
    textHtml: `<div><h2>Полный текст ${id}</h2><p>Основная часть публикации с подробностями.</p></div>`,
    ...overrides,
  };
}

function rawList(ids: string[]) {
  return {
    pagesCount: 3,
    publicationIds: ids,
    publicationRefs: Object.fromEntries(ids.map((id) => [id, rawArticle(id)])),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('Habr normalization', () => {
  it('strips upstream markup and normalizes protocol-relative URLs', () => {
    const normalized = normalizeArticle(rawArticle('10', {
      titleHtml: 'TypeScript &amp; React',
      leadData: { textHtml: '<script>bad()</script><p>Безопасный <b>анонс</b> длиной больше двадцати четырёх символов.</p>', imageUrl: '//habrastorage.org/x.png', image: null },
    }));
    expect(normalized?.title).toBe('TypeScript & React');
    expect(normalized?.summary).not.toContain('bad');
    expect(normalized?.imageUrl).toBe('https://habrastorage.org/x.png');
    expect(normalized?.canonicalUrl).toBe('https://habr.com/ru/articles/10/');
  });

  it('accepts image-less content but rejects malformed, short, and voice records', () => {
    expect(normalizeArticle(rawArticle('11', { leadData: { textHtml: 'Достаточно длинный технический анонс без изображения.', imageUrl: null, image: null } }))?.imageUrl).toBeUndefined();
    expect(normalizeArticle(rawArticle('12', { postType: 'voice' }))).toBeNull();
    expect(normalizeArticle({ nope: true })).toBeNull();
    expect(normalizeArticle(rawArticle('13', { leadData: { textHtml: 'коротко', imageUrl: null, image: null } }))).toBeNull();
  });

  it('preserves list order and filters missing refs', () => {
    const payload = rawList(['2', '1']);
    payload.publicationRefs['2'] = rawArticle('2', { titleHtml: 'Вторая публикация' });
    const normalized = normalizeList(payload);
    expect(normalized.items.map((item) => item.id)).toEqual(['2', '1']);
    expect(normalized.pagesCount).toBe(3);
  });

  it('decodes numeric entities', () => {
    expect(plainText('<p>&#1058;&#1077;&#1089;&#1090; &#x2192;</p>')).toBe('Тест →');
  });

  it('normalizes full article content only when textHtml is present', () => {
    expect(normalizeArticleDetail(rawArticle('14'))?.bodyHtml).toContain('Полный текст 14');
    expect(normalizeArticleDetail(rawArticle('15', { textHtml: null }))).toBeNull();
  });
});

describe('HabrBrowserSource', () => {
  it('coalesces an in-flight discovery request and uses the browser API URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(rawList(['1', '2'])), { status: 200 }));
    const source = new HabrBrowserSource();
    const [first, second] = await Promise.all([source.discover(), source.discover()]);
    expect(first.map((item) => item.id)).toEqual(['1', '2']);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('habr.com/kek/v2/articles/');
  });

  it('ranks related records by shared hubs and removes the anchor', async () => {
    const payload = rawList(['1', '2', '3']);
    payload.publicationRefs['2'] = rawArticle('2', { hubs: [{ alias: 'other', title: 'Другое', titleHtml: 'Другое' }], tags: [{ titleHtml: 'другое' }] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    const source = new HabrBrowserSource();
    const anchor = normalizeArticle(rawArticle('1'))!;
    const result = await source.related(anchor);
    expect(result.map((item) => item.id)).toEqual(['3', '2']);
  });

  it('evicts a failed related promise so it can be retried', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(rawList(['2'])), { status: 200 }));
    const source = new HabrBrowserSource();
    const anchor = normalizeArticle(rawArticle('1'))!;
    await expect(source.related(anchor)).rejects.toThrow('500');
    await expect(source.related(anchor)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hydrates exact ids in the requested order', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const id = String(input).match(/articles\/(\d+)\//)?.[1] ?? '0';
      return new Response(JSON.stringify(rawArticle(id)), { status: 200 });
    });
    const source = new HabrBrowserSource();
    const result = await source.hydrate(['3', '1', '2']);
    expect(result.map((item) => item.id)).toEqual(['3', '1', '2']);
  });

  it('coalesces full article requests and returns the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawArticle('7')), { status: 200 }),
    );
    const source = new HabrBrowserSource();
    const [first, second] = await Promise.all([source.article('7'), source.article('7')]);
    expect(first.bodyHtml).toContain('Полный текст 7');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates aborts without caching the failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const source = new HabrBrowserSource();
    const controller = new AbortController();
    controller.abort();
    await expect(source.discover(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(source.discover()).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
