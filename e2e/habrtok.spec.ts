import { expect, test, type Page } from '@playwright/test';
import { installFixtures, skipOnboarding } from './fixtures';

const shots = 'test-results/screenshots';

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

async function ready(page: Page) {
  await expect(page.getByTestId('article-title')).toBeVisible();
  await expect(page.getByTestId('article-card')).toHaveAttribute('data-related-ready', 'true');
  await expect(page.getByTestId('article-panel-current').locator('.hero')).toHaveAttribute('data-image-ready', 'true');
  await page.waitForTimeout(300);
}

async function expectActionsInsideViewport(page: Page) {
  const button = page.getByRole('button', { name: /Читать на Habr/ });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function emulateMobilePlatform(page: Page, standalone = false) {
  await page.addInitScript(({ standaloneMode }) => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    });
    if (standaloneMode) {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        value: true,
      });
    }
  }, { standaloneMode: standalone });
}

async function dispatchInstallPrompt(page: Page, outcome: 'accepted' | 'dismissed') {
  await page.evaluate((choice) => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: choice, platform: 'web' });
    window.dispatchEvent(event);
  }, outcome);
}

test('onboarding teaches all four gestures', async ({ page }) => {
  await installFixtures(page);
  await page.goto('/');
  await expect(page.getByTestId('onboarding')).toBeVisible();
  await expect(page.getByText('01 / 04')).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}/01-onboarding.png` });
  for (const title of ['Уходите в тему', 'Возвращайтесь точно', 'Сохраняйте маршрут']) {
    await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await page.getByTestId('onboarding').getByRole('button', { name: 'В ленту' }).click();
  await expect(page.getByTestId('onboarding')).toBeHidden();
});

test('gesture feed preserves parent positions, journey, and home', async ({ page }) => {
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/');
  await ready(page);
  await expect(page.getByTestId('article-title')).toHaveText('TypeScript на границе системы');
  await page.screenshot({ path: `${shots}/02-root-light.png` });

  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await expect(page.getByTestId('article-title')).toContainText('Как мы пересобрали');
  await page.waitForTimeout(300);
  await expectActionsInsideViewport(page);
  await page.screenshot({ path: `${shots}/03-long-content.png` });
  await swipe(page, { x: 190, y: 390 }, { x: 190, y: 650 });
  await expect(page.getByTestId('article-title')).toHaveText('TypeScript на границе системы');

  await expect(page.getByTestId('article-card')).toHaveAttribute('data-related-ready', 'true');
  await page.mouse.move(330, 410);
  await page.mouse.down();
  await page.mouse.move(150, 410, { steps: 5 });
  const related = page.getByTestId('related-preview');
  await expect(related).toBeVisible();
  await expect(related).toContainText('Типобезопасные события');
  await expect(related).not.toHaveCSS('transform', 'none');
  await page.screenshot({ path: `${shots}/04-mid-explore.png` });
  await page.mouse.up();
  await expect(page.getByTestId('article-title')).toContainText('Типобезопасные события');
  await expect(page.getByLabel('Глубина 1')).toBeVisible();

  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await expect(page.getByTestId('article-title')).toContainText('Контракты API');
  await expect(page.getByTestId('article-card')).toHaveAttribute('data-related-ready', 'true');
  await swipe(page, { x: 330, y: 410 }, { x: 120, y: 410 });
  await expect(page.getByTestId('article-title')).toContainText('Очереди событий');
  await expect(page.getByLabel('Глубина 2')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/05-nested-depth.png` });

  await swipe(page, { x: 70, y: 410 }, { x: 320, y: 410 });
  await expect(page.getByTestId('article-title')).toContainText('Контракты API');
  await page.getByRole('button', { name: 'Открыть путь' }).click();
  const pathSheet = page.getByTestId('path-sheet');
  await expect(pathSheet).toContainText('TypeScript на границе системы');
  await expect(pathSheet).toContainText('Контракты API');
  await expect(pathSheet).not.toContainText('Типобезопасные события');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}/06-path-sheet.png` });
  await page.getByRole('button', { name: 'Закрыть путь' }).click();
  await page.getByRole('button', { name: 'В ленту' }).click();
  await expect(page.getByTestId('article-title')).toHaveText('TypeScript на границе системы');
});

test('held vertical drag moves full adjacent cards and cancellation does not commit', async ({ page }) => {
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/');
  await ready(page);
  const card = page.getByTestId('article-card');
  await page.mouse.move(190, 650);
  await page.mouse.down();
  await page.mouse.move(190, 465, { steps: 5 });
  await expect(card).toHaveAttribute('data-drag-y', '-185');
  await expect(page.getByTestId('next-preview')).toBeVisible();
  await expect(page.getByTestId('next-preview')).not.toHaveCSS('transform', 'none');
  await page.screenshot({ path: `${shots}/07-mid-vertical.png` });
  await card.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await expect(page.getByTestId('article-title')).toHaveText('TypeScript на границе системы');

  await page.mouse.move(190, 650);
  await page.mouse.down();
  await page.mouse.move(190, 470, { steps: 4 });
  await card.dispatchEvent('lostpointercapture', { pointerId: 1 });
  await page.mouse.up();
  await expect(page.getByTestId('article-title')).toHaveText('TypeScript на границе системы');
});

test('a fresh launch avoids the previous starting article', async ({ page }) => {
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/');
  await ready(page);
  const firstStart = await page.getByTestId('article-title').textContent();

  await page.reload();
  await ready(page);
  await expect(page.getByTestId('article-title')).not.toHaveText(firstStart ?? '');
});

test('mobile install offer appears after two swipes and snoozes for a week', async ({ page, context }) => {
  await emulateMobilePlatform(page);
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/');
  await ready(page);
  await dispatchInstallPrompt(page, 'dismissed');

  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await expect(page.getByTestId('install-offer')).toBeHidden();
  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  const offer = page.getByTestId('install-offer');
  await expect(offer).toBeVisible();
  await expect(offer.getByRole('heading', { name: 'Листайте без браузерных рамок' })).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}/13-install-offer.png` });

  await offer.getByRole('button', { name: 'Установить HabrTok' }).click();
  await expect(offer).toBeHidden();
  const cooldown = (await context.cookies()).find((cookie) => cookie.name === 'habrtok_install_offer_after');
  expect(cooldown).toBeDefined();
  expect(cooldown!.expires * 1000).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);

  await page.reload();
  await ready(page);
  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await expect(page.getByTestId('install-offer')).toBeHidden();
});

test('standalone PWA never shows the automatic install offer', async ({ page }) => {
  await emulateMobilePlatform(page, true);
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/');
  await ready(page);
  await dispatchInstallPrompt(page, 'dismissed');
  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await swipe(page, { x: 190, y: 650 }, { x: 190, y: 390 });
  await expect(page.getByTestId('install-offer')).toBeHidden();
});

test('keyboard, dark theme, image fallback, mobile overflow, and interactive exclusions', async ({ page }) => {
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/');
  await ready(page);

  await page.getByRole('button', { name: 'Открыть настройки' }).click();
  await expect(page.getByTestId('settings-sheet')).toBeVisible();
  await expect(page.getByText('HabrTok всегда под рукой')).toBeVisible();
  await expect(page.getByText(/iPhone: «Поделиться»/)).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}/12-pwa-settings.png` });
  await page.getByRole('button', { name: 'Тёмная' }).click();
  await page.getByRole('button', { name: 'Закрыть настройки' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}/08-root-dark.png` });

  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('article-title')).toContainText('Как мы пересобрали');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('article-title')).toContainText('без картинки');
  await expect(page.getByTestId('article-panel-current').locator('.hero')).toHaveAttribute('data-image-ready', 'fallback');
  await page.waitForTimeout(300);
  await expectActionsInsideViewport(page);
  await page.screenshot({ path: `${shots}/09-image-fallback.png` });

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('article-title')).toContainText('Как мы пересобрали');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(300);
  await expectActionsInsideViewport(page);
  await page.screenshot({ path: `${shots}/10-mobile-360x800.png` });
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    height: document.body.scrollHeight - document.body.clientHeight,
  }));
  expect(overflow.html).toBeLessThanOrEqual(0);
  expect(overflow.body).toBeLessThanOrEqual(0);
  expect(overflow.height).toBeLessThanOrEqual(0);

  const titleBefore = await page.getByTestId('article-title').textContent();
  await page.getByRole('button', { name: 'Поделиться публикацией' }).click();
  await expect(page.getByTestId('article-title')).toHaveText(titleBefore ?? '');
});

test('hydrates a shared journey in order', async ({ page }) => {
  await skipOnboarding(page);
  await installFixtures(page);
  await page.goto('/#p=101.201&c=301');
  const intro = page.getByTestId('shared-intro');
  await expect(intro).toContainText('TypeScript на границе системы');
  await expect(intro).toContainText('Очереди событий');
  await page.getByRole('button', { name: 'Открыть маршрут' }).click();
  await expect(page.getByTestId('article-title')).toContainText('Очереди событий');
  await expect(page.getByLabel('Глубина 2')).toBeVisible();
});

test('shows a reachable retry state for rate limits and outages', async ({ page }) => {
  await skipOnboarding(page);
  await installFixtures(page, { failApi: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Лента не загрузилась' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await page.screenshot({ path: `${shots}/11-error-state.png` });
});
