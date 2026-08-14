import { z } from 'zod';
import { tokItemSchema, type TokItem, type TokSource } from './types';

export const HABR_API_BASE = 'https://habr.com/kek/v2';
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

const nullableString = z.string().nullable().optional();
const rawArticleSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    timePublished: nullableString,
    lang: z.string().optional(),
    titleHtml: z.string(),
    postType: z.string().optional(),
    publicationType: z.string().optional(),
    status: z.string().optional(),
    author: z
      .object({
        alias: nullableString,
        fullname: nullableString,
        avatarUrl: nullableString,
      })
      .nullable()
      .optional(),
    statistics: z
      .object({
        readingCount: z.number().optional().default(0),
        commentsCount: z.number().optional().default(0),
        favoritesCount: z.number().optional().default(0),
        score: z.number().optional().default(0),
      })
      .nullable()
      .optional(),
    hubs: z
      .array(
        z.object({
          alias: z.string(),
          title: nullableString,
          titleHtml: nullableString,
        }),
      )
      .optional()
      .default([]),
    tags: z
      .array(
        z.object({
          titleHtml: z.string(),
        }),
      )
      .optional()
      .default([]),
    leadData: z
      .object({
        textHtml: nullableString,
        imageUrl: nullableString,
        buttonTextHtml: nullableString,
        image: z
          .object({
            url: nullableString,
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    readingTime: z.number().int().positive().nullable().optional(),
    complexity: z.enum(['low', 'medium', 'high']).nullable().optional(),
    format: nullableString,
  })
  .passthrough();

const rawListSchema = z.object({
  pagesCount: z.number().int().nonnegative(),
  publicationRefs: z.record(z.string(), rawArticleSchema),
  publicationIds: z.array(z.union([z.string(), z.number()])),
});

type RawList = z.infer<typeof rawListSchema>;

const htmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  raquo: '»',
  rdquo: '”',
};

export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x?[0-9a-f]+);/gi, (_match, code: string) => {
      const point = code.toLowerCase().startsWith('x')
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&([a-z]+);/gi, (_match, name: string) => htmlEntities[name.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteHttpsUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://habr.com');
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function canonicalUrl(id: string): string {
  return `https://habr.com/ru/articles/${encodeURIComponent(id)}/`;
}

export function normalizeArticle(input: unknown): TokItem | null {
  const result = rawArticleSchema.safeParse(input);
  if (!result.success) return null;
  const raw = result.data;
  const id = String(raw.id);
  const title = plainText(raw.titleHtml);
  const summary = plainText(raw.leadData?.textHtml);
  const hubs = raw.hubs.map((hub) => plainText(hub.titleHtml ?? hub.title)).filter(Boolean);
  const tags = raw.tags.map((tag) => plainText(tag.titleHtml)).filter(Boolean);

  if (
    !/^\d+$/.test(id) ||
    title.length < 4 ||
    summary.length < 24 ||
    raw.status === 'draft' ||
    raw.postType === 'voice'
  ) {
    return null;
  }

  const imageUrl = absoluteHttpsUrl(raw.leadData?.imageUrl ?? raw.leadData?.image?.url);
  const author = raw.author?.alias ?? raw.author?.fullname ?? undefined;
  const authorAvatarUrl = absoluteHttpsUrl(raw.author?.avatarUrl);
  const stats = raw.statistics
    ? {
        readingCount: Math.max(0, raw.statistics.readingCount),
        commentsCount: Math.max(0, raw.statistics.commentsCount),
        favoritesCount: Math.max(0, raw.statistics.favoritesCount),
        score: raw.statistics.score,
      }
    : undefined;

  return tokItemSchema.parse({
    id,
    source: 'Habr',
    title,
    summary,
    description: hubs.slice(0, 3).join(' · ') || undefined,
    imageUrl,
    canonicalUrl: canonicalUrl(id),
    author,
    authorAvatarUrl,
    publishedAt: raw.timePublished ? new Date(raw.timePublished).toISOString() : undefined,
    tags,
    hubs,
    hubAliases: raw.hubs.map((hub) => hub.alias),
    readingTime: raw.readingTime ?? undefined,
    complexity: raw.complexity ?? undefined,
    format: raw.format ?? undefined,
    stats,
  });
}

export function normalizeList(input: unknown): { items: TokItem[]; pagesCount: number } {
  const raw: RawList = rawListSchema.parse(input);
  const seen = new Set<string>();
  const items = raw.publicationIds.flatMap((rawId) => {
    const id = String(rawId);
    const item = normalizeArticle(raw.publicationRefs[id]);
    if (!item || seen.has(item.id)) return [];
    seen.add(item.id);
    return [item];
  });
  return { items, pagesCount: raw.pagesCount };
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  const seconds = retryAfter ? Number.parseFloat(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 3_000);
  return 350 * 2 ** attempt + Math.random() * 150;
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function requestJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      signal: requestSignal,
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) return response.json();
    if (![429, 503].includes(response.status) || attempt === MAX_RETRIES) {
      const error = new Error(`Habr API: ${response.status}`);
      Object.assign(error, { status: response.status });
      throw error;
    }
    await wait(retryDelay(response, attempt), requestSignal);
  }
  throw new Error('Habr API недоступен');
}

function scoreRelated(anchor: TokItem, candidate: TokItem): number {
  const anchorHubs = new Set(anchor.hubAliases ?? []);
  const anchorTags = new Set((anchor.tags ?? []).map((tag) => tag.toLocaleLowerCase('ru')));
  const sharedHubs = new Set((candidate.hubAliases ?? []).filter((hub) => anchorHubs.has(hub))).size;
  const sharedTags = new Set(
    (candidate.tags ?? [])
      .map((tag) => tag.toLocaleLowerCase('ru'))
      .filter((tag) => anchorTags.has(tag)),
  ).size;
  const sameAuthor = anchor.author && candidate.author === anchor.author ? 1 : 0;
  const image = candidate.imageUrl ? 1 : 0;
  return sharedHubs * 10 + sharedTags * 4 + sameAuthor * 3 + image;
}

export class HabrBrowserSource implements TokSource {
  private nextDiscoveryPage = 1;
  private discoveryExhausted = false;
  private readonly discoveryInflight = new Map<number, Promise<TokItem[]>>();
  private readonly relatedInflight = new Map<string, Promise<TokItem[]>>();
  private readonly detailInflight = new Map<string, Promise<TokItem | null>>();

  discover(signal?: AbortSignal): Promise<TokItem[]> {
    if (this.discoveryExhausted) return Promise.resolve([]);
    const page = this.nextDiscoveryPage;
    const cached = this.discoveryInflight.get(page);
    if (cached) return cached;
    const url = new URL(`${HABR_API_BASE}/articles/`);
    url.search = new URLSearchParams({ sort: 'rating', period: 'weekly', fl: 'ru', hl: 'ru', page: String(page) }).toString();
    const promise = requestJson(url.toString(), signal)
      .then((payload) => normalizeList(payload))
      .then(({ items, pagesCount }) => {
        if (this.nextDiscoveryPage === page) this.nextDiscoveryPage += 1;
        if (page >= pagesCount) this.discoveryExhausted = true;
        this.discoveryInflight.delete(page);
        return items;
      })
      .catch((error) => {
        this.discoveryInflight.delete(page);
        throw error;
      });
    this.discoveryInflight.set(page, promise);
    return promise;
  }

  related(item: TokItem, signal?: AbortSignal): Promise<TokItem[]> {
    const cached = this.relatedInflight.get(item.id);
    if (cached) return cached;
    const primaryHub = item.hubAliases?.[0];
    const url = new URL(`${HABR_API_BASE}/articles/`);
    const params: Record<string, string> = {
      sort: 'rating',
      period: 'monthly',
      fl: 'ru',
      hl: 'ru',
      page: '1',
    };
    if (primaryHub) params.hub = primaryHub;
    else if (item.author) params.user = item.author;
    url.search = new URLSearchParams(params).toString();

    const promise = requestJson(url.toString(), signal)
      .then((payload) => normalizeList(payload).items)
      .then((items) =>
        items
          .filter((candidate) => candidate.id !== item.id)
          .sort((a, b) => scoreRelated(item, b) - scoreRelated(item, a)),
      )
      .catch((error) => {
        this.relatedInflight.delete(item.id);
        throw error;
      });
    this.relatedInflight.set(item.id, promise);
    if (this.relatedInflight.size > 80) {
      this.relatedInflight.delete(this.relatedInflight.keys().next().value ?? '');
    }
    return promise;
  }

  private hydrateOne(id: string, signal?: AbortSignal): Promise<TokItem | null> {
    const cached = this.detailInflight.get(id);
    if (cached) return cached;
    const promise = requestJson(`${HABR_API_BASE}/articles/${encodeURIComponent(id)}/`, signal)
      .then(normalizeArticle)
      .catch((error) => {
        this.detailInflight.delete(id);
        throw error;
      });
    this.detailInflight.set(id, promise);
    if (this.detailInflight.size > 80) this.detailInflight.delete(this.detailInflight.keys().next().value ?? '');
    return promise;
  }

  async hydrate(ids: string[], signal?: AbortSignal): Promise<TokItem[]> {
    const bounded = ids.filter((id) => /^\d+$/.test(id)).slice(0, 12);
    const items = await Promise.all(bounded.map((id) => this.hydrateOne(id, signal)));
    return items.flatMap((item) => (item ? [item] : []));
  }
}

export const habrSource: TokSource = new HabrBrowserSource();
