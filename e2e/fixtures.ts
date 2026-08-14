import type { Page, Route } from '@playwright/test';

interface RawArticleOptions {
  title?: string;
  summary?: string;
  hub?: string;
  hubTitle?: string;
  image?: boolean;
  author?: string;
  language?: string;
}

export function rawArticle(id: string, options: RawArticleOptions = {}) {
  const hub = options.hub ?? 'webdev';
  const title = options.title ?? `Публикация ${id}: архитектура без лишней магии`;
  const summary = options.summary ?? `Практический разбор инженерного решения ${id}: от ограничений и компромиссов до наблюдаемого результата в продакшене.`;
  return {
    id,
    timePublished: '2026-08-13T12:00:00+00:00',
    lang: options.language ?? 'ru',
    titleHtml: title,
    editorVersion: '2.0',
    postType: 'article',
    publicationType: 'article',
    postLabels: [],
    author: { id: id, alias: options.author ?? `engineer${id}`, fullname: null, avatarUrl: null, deleted: false, isSeo: false },
    statistics: { commentsCount: Number(id) % 41, favoritesCount: Number(id) % 77, readingCount: 1200 + Number(id), score: Number(id) % 53, votesCount: 10 },
    hubs: [{ id: id, alias: hub, type: 'collective', title: options.hubTitle ?? hub, titleHtml: options.hubTitle ?? hub }],
    relatedData: null,
    leadData: {
      textHtml: `<p>${summary}</p>`,
      imageUrl: options.image === false ? null : `https://assets.habrtok.test/${id}.svg`,
      image: options.image === false ? null : { url: `https://assets.habrtok.test/${id}.svg`, fit: 'cover', positionY: 0, positionX: 0 },
    },
    status: 'published',
    format: 'tutorial',
    readingTime: 6 + (Number(id) % 7),
    complexity: Number(id) % 2 ? 'medium' : 'low',
    tags: [{ titleHtml: 'TypeScript' }, { titleHtml: hub }],
  };
}

export const articles = new Map<string, ReturnType<typeof rawArticle>>([
  ['101', rawArticle('101', { title: 'TypeScript на границе системы', hub: 'root-one', hubTitle: 'TypeScript', author: 'northwind' })],
  ['102', rawArticle('102', {
    title: 'Как мы пересобрали очень длинный и упрямый пайплайн доставки данных без остановки продакшена',
    summary: 'Подробный рассказ о миграции, где несовместимые контракты, длинная очередь событий и требования к нулевому простою пришлось свести в один проверяемый план. Заодно — о метриках, откатах и честной цене компромиссов.',
    hub: 'devops',
    hubTitle: 'DevOps',
  })],
  ['103', rawArticle('103', { title: 'PostgreSQL: план запроса без картинки', hub: 'postgresql', hubTitle: 'PostgreSQL', image: false })],
  ['104', rawArticle('104', { title: 'Оптимизация рендера на слабых устройствах', hub: 'webdev', hubTitle: 'Веб-разработка' })],
  ['105', rawArticle('105', { title: 'Инфраструктура наблюдаемости за один спринт', hub: 'sys_admin', hubTitle: 'Системное администрирование' })],
  ['106', rawArticle('106', { title: 'Rust для сервисов с предсказуемой задержкой', hub: 'rust', hubTitle: 'Rust' })],
  ['201', rawArticle('201', { title: 'Типобезопасные события в большом фронтенде', hub: 'frontend', hubTitle: 'Фронтенд', author: 'northwind' })],
  ['202', rawArticle('202', { title: 'Контракты API как исполняемая документация', hub: 'api', hubTitle: 'API' })],
  ['203', rawArticle('203', { title: 'Дженерики без головной боли', hub: 'typescript', hubTitle: 'TypeScript' })],
  ['301', rawArticle('301', { title: 'Очереди событий и обратное давление', hub: 'architecture', hubTitle: 'Архитектура' })],
  ['302', rawArticle('302', { title: 'Когда состояние лучше хранить снаружи', hub: 'frontend', hubTitle: 'Фронтенд' })],
  ['401', rawArticle('401', { title: 'Индексы PostgreSQL под реальной нагрузкой', hub: 'postgresql', hubTitle: 'PostgreSQL', image: false })],
]);

const rootIds = ['101', '102', '103', '104', '105', '106'];
const relatedIds: Record<string, string[]> = {
  'root-one': ['201', '202', '203'],
  frontend: ['301', '302'],
  postgresql: ['401', '103'],
  devops: ['105', '104'],
  api: ['301', '202'],
  architecture: ['302', '301'],
};

function listPayload(ids: string[]) {
  return {
    pagesCount: 4,
    publicationIds: ids,
    publicationRefs: Object.fromEntries(ids.map((id) => [id, articles.get(id)])),
  };
}

function svgFor(id: string): string {
  const hue = (Number(id) * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 48% 18%)"/><stop offset="1" stop-color="hsl(${(hue + 45) % 360} 65% 43%)"/></linearGradient><pattern id="p" width="52" height="52" patternUnits="userSpaceOnUse"><path d="M52 0H0v52" fill="none" stroke="white" stroke-opacity=".08"/></pattern></defs><rect width="900" height="900" fill="url(#g)"/><rect width="900" height="900" fill="url(#p)"/><circle cx="690" cy="210" r="210" fill="none" stroke="white" stroke-opacity=".18" stroke-width="2"/><text x="70" y="720" fill="white" font-family="monospace" font-size="170" font-weight="700">H_${id}</text></svg>`;
}

export async function installFixtures(page: Page, options: { failApi?: boolean } = {}) {
  await page.route('https://assets.habrtok.test/**', async (route) => {
    const id = route.request().url().match(/(\d+)\.svg/)?.[1] ?? '0';
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgFor(id) });
  });

  await page.route('https://habr.com/kek/v2/articles/**', async (route: Route) => {
    if (options.failApi) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'unavailable' }) });
      return;
    }
    const url = new URL(route.request().url());
    const detailId = url.pathname.match(/\/articles\/(\d+)\/$/)?.[1];
    if (detailId) {
      const article = articles.get(detailId);
      await route.fulfill({ status: article ? 200 : 404, contentType: 'application/json', body: JSON.stringify(article ?? { message: 'not found' }) });
      return;
    }
    const hub = url.searchParams.get('hub');
    const ids = hub ? relatedIds[hub] ?? rootIds.slice(0, 3) : rootIds;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(listPayload(ids)) });
  });
}

export async function skipOnboarding(page: Page) {
  await page.addInitScript(() => localStorage.setItem('habrtok:onboarded', '1'));
}
