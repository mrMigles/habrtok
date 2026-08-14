import { HABR_API_BASE, normalizeArticleDetail, normalizeList } from '../src/source';

const headers = {
  Accept: 'application/json',
  Origin: 'http://127.0.0.1:5173',
};

async function getJson(url: URL | string): Promise<{ payload: unknown; cors: string | null }> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return { payload: await response.json(), cors: response.headers.get('access-control-allow-origin') };
}

async function main() {
  const discoverUrl = new URL(`${HABR_API_BASE}/articles/`);
  discoverUrl.search = new URLSearchParams({ sort: 'rating', period: 'weekly', fl: 'ru', hl: 'ru', page: '1' }).toString();
  const discoveryResponse = await getJson(discoverUrl);
  if (discoveryResponse.cors !== '*') throw new Error(`Unexpected CORS header: ${discoveryResponse.cors ?? 'missing'}`);
  const discovery = normalizeList(discoveryResponse.payload).items;
  const anchor = discovery.find((item) => item.hubAliases?.[0]);
  if (!anchor || discovery.length < 3) throw new Error('Discovery did not produce enough normalized articles');

  const relatedUrl = new URL(`${HABR_API_BASE}/articles/`);
  relatedUrl.search = new URLSearchParams({ hub: anchor.hubAliases![0], sort: 'rating', period: 'monthly', fl: 'ru', hl: 'ru', page: '1' }).toString();
  const related = normalizeList((await getJson(relatedUrl)).payload).items.filter((item) => item.id !== anchor.id);
  if (related.length === 0) throw new Error('Related hub query returned no usable candidates');

  const hydrateIds = [anchor.id, related[0].id];
  const hydrated = [];
  for (const id of hydrateIds) {
    const detail = normalizeArticleDetail((await getJson(`${HABR_API_BASE}/articles/${id}/`)).payload);
    if (!detail || detail.bodyHtml.length < 100) throw new Error(`Full article hydration failed for ${id}`);
    hydrated.push(detail.article);
  }
  if (hydrated.map((item) => item.id).join(',') !== hydrateIds.join(',')) throw new Error('Hydration order changed');

  console.log(`discover=${discovery.length} first=${anchor.id} "${anchor.title}"`);
  console.log(`related=${related.length} hub=${anchor.hubAliases![0]} first=${related[0].id}`);
  console.log(`hydrate=${hydrated.map((item) => item.id).join(' -> ')} cors=${discoveryResponse.cors}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
