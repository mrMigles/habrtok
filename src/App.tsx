import { Compass, Route, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArticleCard } from './ArticleCard';
import { activeLevel, currentItem, explorationReducer, initialExplorationState } from './exploration';
import { Onboarding, PathSheet, SettingsSheet, SharedIntro } from './Overlays';
import { platform } from './platform';
import { randomizeInitialFeed } from './randomizeFeed';
import { createShareUrl, parseShareHash } from './share';
import { habrSource } from './source';
import type { TokItem } from './types';
import { usePwaInstall } from './usePwaInstall';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  const stored = platform.read('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Запрос отменён.';
  if (error instanceof Error && /429|503/.test(error.message)) return 'Habr просит немного замедлиться. Попробуйте ещё раз.';
  return 'Не удалось связаться с Habr. Проверьте сеть и повторите попытку.';
}

export default function App() {
  const initialShare = useMemo(() => parseShareHash(window.location.hash), []);
  const [state, dispatch] = useReducer(explorationReducer, initialExplorationState);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [relatedById, setRelatedById] = useState<Record<string, TokItem[]>>({});
  const [loadingRelatedId, setLoadingRelatedId] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => !initialShare && platform.read('onboarded') !== '1');
  const [showPath, setShowPath] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [toast, setToast] = useState<string | null>(null);
  const [sharedIntro, setSharedIntro] = useState<{ items: TokItem[]; pathLength: number } | null>(null);
  const loadingMore = useRef(false);
  const pwaInstall = usePwaInstall();

  const level = activeLevel(state);
  const article = currentItem(state);
  const depth = state.levels.length - 1;
  const parentLevel = state.levels.at(-2);
  const parentArticle = parentLevel?.items[parentLevel.index];
  const overlaysOpen = showOnboarding || showPath || showSettings || Boolean(sharedIntro);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    platform.write('theme', theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadingInitial(true);
      setInitialError(null);
      try {
        if (initialShare) {
          const ids = [...initialShare.pathIds, initialShare.currentId];
          const sharedItems = await habrSource.hydrate(ids, controller.signal);
          if (sharedItems.length === ids.length) {
            dispatch({ type: 'HYDRATE_SHARED', articles: sharedItems, pathLength: initialShare.pathIds.length });
            setSharedIntro({ items: sharedItems, pathLength: initialShare.pathIds.length });
          }
        }
        const discovered = await habrSource.discover(controller.signal);
        if (discovered.length === 0) throw new Error('Пустая лента');
        const items = initialShare
          ? discovered
          : randomizeInitialFeed(discovered, platform.read('last-start-article'));
        if (!initialShare && items[0]) platform.write('last-start-article', items[0].id);
        dispatch({ type: 'SET_ROOT', items });
      } catch (error) {
        if (!controller.signal.aborted) setInitialError(friendlyError(error));
      } finally {
        if (!controller.signal.aborted) setLoadingInitial(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [initialShare]);

  useEffect(() => {
    if (depth !== 0 || level.items.length === 0 || level.items.length - level.index > 4 || loadingMore.current) return;
    loadingMore.current = true;
    void habrSource
      .discover()
      .then((items) => dispatch({ type: 'SET_ROOT', items }))
      .catch((error) => setInlineError(friendlyError(error)))
      .finally(() => {
        loadingMore.current = false;
      });
  }, [depth, level.index, level.items.length]);

  useEffect(() => {
    const targets = level.items.slice(level.index, level.index + 3);
    let cancelled = false;
    for (const target of targets) {
      if (relatedById[target.id] !== undefined) continue;
      void habrSource
        .related(target)
        .then((items) => {
          if (!cancelled) setRelatedById((current) => ({ ...current, [target.id]: items }));
        })
        .catch(() => {
          // Prefetch is best-effort; a committed explore gesture will retry and report the error.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [level.index, level.items, relatedById]);

  useEffect(() => {
    const items = [level.items[level.index - 1], article, level.items[level.index + 1], article && relatedById[article.id]?.[0]];
    for (const item of items) {
      if (!item?.imageUrl) continue;
      const image = new Image();
      image.src = item.imageUrl;
    }
  }, [article, level.index, level.items, relatedById]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const explore = useCallback(async () => {
    if (!article) return;
    const prefetched = relatedById[article.id];
    if (prefetched?.length) {
      dispatch({ type: 'EXPLORE', anchor: article, items: prefetched });
      platform.haptic();
      return;
    }
    setLoadingRelatedId(article.id);
    setInlineError(null);
    try {
      const items = await habrSource.related(article);
      setRelatedById((current) => ({ ...current, [article.id]: items }));
      if (items.length > 0) dispatch({ type: 'EXPLORE', anchor: article, items });
      else setInlineError('Для этой публикации пока не нашлось тематического продолжения.');
    } catch (error) {
      setInlineError(friendlyError(error));
    } finally {
      setLoadingRelatedId(null);
    }
  }, [article, relatedById]);

  const closeOverlays = useCallback(() => {
    setShowPath(false);
    setShowSettings(false);
    setSharedIntro(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      if (event.key === 'Escape') {
        closeOverlays();
        return;
      }
      if (overlaysOpen) return;
      if (event.key === 'ArrowUp') dispatch({ type: 'NEXT' });
      else if (event.key === 'ArrowDown') dispatch({ type: 'PREVIOUS' });
      else if (event.key === 'ArrowRight') void explore();
      else if (event.key === 'ArrowLeft') dispatch({ type: 'BACK' });
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeOverlays, explore, overlaysOpen]);

  const finishOnboarding = () => {
    platform.write('onboarded', '1');
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const share = async (journey: boolean) => {
    if (!article) return;
    const pathIds = journey ? state.journey.map((item) => item.id) : [];
    const url = createShareUrl(pathIds, article.id);
    try {
      const result = await platform.share('HabrTok', journey ? 'Мой маршрут по Habr' : article.title, url);
      setToast(result === 'copied' ? 'Ссылка скопирована' : 'Готово');
    } catch {
      setToast('Не удалось скопировать ссылку');
    }
  };

  const installApp = async () => {
    const result = await pwaInstall.install();
    if (result === 'accepted') setToast('HabrTok установлен');
  };

  if (!article && loadingInitial) {
    return <div className="app-shell"><div className="skeleton"><div /><section><span /><span /><span /><span /></section></div></div>;
  }

  if (!article) {
    return (
      <div className="app-shell">
        <section className="error-state" role="alert">
          <span>H!</span><h1>Лента не загрузилась</h1><p>{initialError ?? 'Habr вернул пустой ответ.'}</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>Повторить</button>
        </section>
      </div>
    );
  }

  return (
    <div className={`app-shell ${overlaysOpen ? 'has-overlay' : ''}`}>
      <header className="topbar">
        <button type="button" className="brand-button" onClick={() => dispatch({ type: 'HOME' })} aria-label="HabrTok — в корень">
          <span className="brand-mark">H</span><span>HabrTok</span>
        </button>
        <div className="top-actions">
          {depth > 0 && <span className="depth-pill" aria-label={`Глубина ${depth}`}>{String(depth).padStart(2, '0')}</span>}
          <button type="button" className="icon-button" onClick={() => setShowPath(true)} aria-label="Открыть путь"><Route /></button>
          <button type="button" className="icon-button" onClick={() => setShowSettings(true)} aria-label="Открыть настройки"><SlidersHorizontal /></button>
          <button type="button" className="icon-button home-button" onClick={() => dispatch({ type: 'HOME' })} aria-label="В ленту"><Compass /></button>
        </div>
      </header>

      <ArticleCard
        article={article}
        previousArticle={level.items[level.index - 1]}
        nextArticle={level.items[level.index + 1]}
        exploreArticle={relatedById[article.id]?.[0]}
        parentArticle={parentArticle}
        anchorTitle={level.anchor?.title}
        depth={depth}
        loadingRelated={loadingRelatedId === article.id}
        disabled={overlaysOpen || loadingInitial}
        onNext={() => dispatch({ type: 'NEXT' })}
        onPrevious={() => dispatch({ type: 'PREVIOUS' })}
        onExplore={() => void explore()}
        onBack={() => dispatch({ type: 'BACK' })}
        onShare={() => void share(false)}
        onOpen={() => platform.openExternal(article.canonicalUrl)}
      />

      {inlineError && <div className="inline-error" role="status"><span>{inlineError}</span><button type="button" onClick={() => setInlineError(null)}>Закрыть</button></div>}
      {showOnboarding && <Onboarding step={onboardingStep} onStep={setOnboardingStep} onFinish={finishOnboarding} />}
      {showPath && <PathSheet journey={state.journey} current={article} onClose={() => setShowPath(false)} onShare={() => void share(true)} />}
      {showSettings && (
        <SettingsSheet
          theme={theme}
          canInstall={pwaInstall.canInstall}
          installed={pwaInstall.installed}
          onTheme={setTheme}
          onInstall={() => void installApp()}
          onClose={() => setShowSettings(false)}
          onTutorial={() => { setShowSettings(false); setOnboardingStep(0); setShowOnboarding(true); }}
        />
      )}
      {sharedIntro && <SharedIntro items={sharedIntro.items} pathLength={sharedIntro.pathLength} onContinue={() => setSharedIntro(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
