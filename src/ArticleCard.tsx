import { Bookmark, Clock3, ExternalLink, Eye, MessageCircle, Share2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { TokItem } from './types';
import { useGestures } from './useGestures';

interface ArticleCardProps {
  article: TokItem;
  previousArticle?: TokItem;
  nextArticle?: TokItem;
  exploreArticle?: TokItem;
  parentArticle?: TokItem;
  anchorTitle?: string;
  depth: number;
  loadingRelated: boolean;
  disabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onExplore: () => void;
  onBack: () => void;
  onRead: () => void;
  onShare: () => void;
  onOpen: () => void;
}

interface ArticleSurfaceProps {
  article: TokItem;
  anchorTitle?: string;
  depth: number;
  className: string;
  style?: CSSProperties;
  hidden?: boolean;
  testId?: string;
  onShare?: () => void;
  onOpen?: () => void;
}

const complexityLabels = { low: 'лёгкая', medium: 'средняя', high: 'сложная' } as const;

function compactNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function initials(article: TokItem): string {
  const words = article.title.split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? 'H'}${words[1]?.[0] ?? ''}`.toLocaleUpperCase('ru');
}

function ArticleSurface({
  article,
  anchorTitle,
  depth,
  className,
  style,
  hidden,
  testId,
  onShare,
  onOpen,
}: ArticleSurfaceProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const interactive = Boolean(onShare && onOpen);
  const hub = article.hubs?.[0] ?? 'Технологии';

  return (
    <article className={className} style={style} aria-hidden={hidden} data-testid={testId}>
      <div className={`hero ${article.imageUrl && imageReady && !imageFailed ? 'has-image' : ''}`} data-image-ready={article.imageUrl && imageReady ? 'true' : 'fallback'}>
        <div className="hero-fallback" aria-hidden="true">
          <span className="fallback-grid" />
          <strong>{initials(article)}</strong>
        </div>
        {article.imageUrl && !imageFailed && (
          <img
            className={imageReady ? 'ready' : ''}
            src={article.imageUrl}
            alt=""
            draggable={false}
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="hero-shade" />
        <div className="hero-context">
          <span>{depth > 0 ? `Глубина ${String(depth).padStart(2, '0')}` : 'Ваша лента'}</span>
          <span>{depth > 0 ? anchorTitle : hub}</span>
        </div>
        {article.readingTime && (
          <span className="read-time"><Clock3 aria-hidden="true" /> {article.readingTime} мин</span>
        )}
      </div>

      <div className={`article-copy ${article.title.length > 72 || article.summary.length > 190 ? 'long-copy' : ''}`}>
        <div className="eyebrow">
          <span>{hub}</span>
          {article.complexity && <span>{complexityLabels[article.complexity]}</span>}
          {article.format && <span>{article.format}</span>}
        </div>
        <h1 data-testid={interactive ? 'article-title' : undefined}>{article.title}</h1>
        {article.description && <p className="description">{article.description}</p>}
        <p className="summary">{article.summary}</p>

        {article.stats && (
          <div className="metrics" aria-label="Статистика публикации">
            <span><Eye aria-hidden="true" />{compactNumber(article.stats.readingCount)}</span>
            <span><MessageCircle aria-hidden="true" />{compactNumber(article.stats.commentsCount)}</span>
            <span><Bookmark aria-hidden="true" />{compactNumber(article.stats.favoritesCount)}</span>
            <span className={article.stats.score < 0 ? 'negative' : ''}>↑ {article.stats.score}</span>
          </div>
        )}

        <div className="article-footer">
          <div className="attribution">
            <span className="habr-mark">H</span>
            <span><b>Habr</b>{article.author ? ` · @${article.author}` : ''}</span>
          </div>
          {interactive && (
            <div className="article-actions">
              <button type="button" className="round-action" onClick={onShare} aria-label="Поделиться публикацией">
                <Share2 aria-hidden="true" />
              </button>
              <button type="button" className="open-action" onClick={onOpen}>
                Читать на Habr <ExternalLink aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ArticleCard(props: ArticleCardProps) {
  const gestures = useGestures({
    disabled: props.disabled,
    canDown: Boolean(props.previousArticle),
    canUp: Boolean(props.nextArticle),
    canLeft: Boolean(props.exploreArticle),
    canRight: Boolean(props.parentArticle),
    onTap: props.onRead,
    onDown: props.onPrevious,
    onUp: props.onNext,
    onLeft: props.onExplore,
    onRight: props.onBack,
  });
  const { drag } = gestures;
  const verticalDrag = drag.direction === 'up' || drag.direction === 'down' ? drag.y : 0;
  const horizontalDrag = drag.direction === 'left' || drag.direction === 'right' ? drag.x : 0;
  const verticalProgress = Math.min(Math.abs(verticalDrag) / 180, 1);
  const horizontalProgress = Math.min(Math.abs(horizontalDrag) / 180, 1);
  const tilt = Math.max(-2.2, Math.min(2.2, horizontalDrag / 120));
  const currentTransform = horizontalDrag
    ? `translate3d(${horizontalDrag}px, 0, 0) rotate(${tilt}deg)`
    : `translate3d(0, ${verticalDrag}px, 0) scale(${1 - verticalProgress * 0.015})`;
  const previousTransform = `translate3d(0, calc(-100% + ${verticalDrag}px), 0)`;
  const nextTransform = `translate3d(0, calc(100% + ${verticalDrag}px), 0)`;
  const exploreTransform = `translate3d(calc(100% + ${Math.min(horizontalDrag, 0)}px), 0, 0)`;
  const parentTransform = `translate3d(calc(-100% + ${Math.max(horizontalDrag, 0)}px), 0, 0)`;
  const hint =
    drag.direction === 'up'
      ? 'Следующая публикация'
      : drag.direction === 'down'
        ? 'Предыдущая публикация'
        : drag.direction === 'left'
          ? props.exploreArticle
            ? `В тему: ${props.exploreArticle.title}`
            : 'Ищем публикации по теме'
          : drag.direction === 'right' && props.depth > 0
            ? 'Назад к исходной публикации'
            : '';

  return (
    <main
      className={`article-deck ${drag.direction ? `drag-${drag.direction}` : ''} ${drag.ready ? 'gesture-ready' : ''} ${drag.settling ? 'gesture-settling' : ''} ${drag.swapping ? 'gesture-swapping' : ''}`}
      {...gestures.bind}
      data-testid="article-card"
      data-drag-x={drag.x}
      data-drag-y={drag.y}
      data-related-ready={Boolean(props.exploreArticle)}
    >
      {props.previousArticle && (
        <ArticleSurface
          article={props.previousArticle}
          anchorTitle={props.anchorTitle}
          depth={props.depth}
          className="article-panel preview-panel previous"
          style={{ transform: previousTransform, opacity: drag.direction === 'down' ? 1 : 0.25 }}
          hidden
          testId="previous-preview"
        />
      )}
      {props.nextArticle && (
        <ArticleSurface
          article={props.nextArticle}
          anchorTitle={props.anchorTitle}
          depth={props.depth}
          className="article-panel preview-panel next"
          style={{ transform: nextTransform, opacity: drag.direction === 'up' ? 1 : 0.25 }}
          hidden
          testId="next-preview"
        />
      )}
      {drag.direction === 'left' && props.exploreArticle && (
        <ArticleSurface
          article={props.exploreArticle}
          anchorTitle={props.article.title}
          depth={props.depth + 1}
          className="article-panel side-preview related"
          style={{ transform: exploreTransform }}
          hidden
          testId="related-preview"
        />
      )}
      {drag.direction === 'right' && props.parentArticle && (
        <ArticleSurface
          article={props.parentArticle}
          depth={Math.max(0, props.depth - 1)}
          className="article-panel side-preview parent"
          style={{ transform: parentTransform }}
          hidden
          testId="parent-preview"
        />
      )}
      {drag.direction === 'left' && !props.exploreArticle && (
        <div className="swipe-layer right" style={{ opacity: horizontalProgress }}>Связи прогреваются…</div>
      )}
      {drag.direction === 'right' && !props.parentArticle && (
        <div className="swipe-layer left" style={{ opacity: horizontalProgress }}>Вы уже в корне</div>
      )}
      <ArticleSurface
        article={props.article}
        anchorTitle={props.anchorTitle}
        depth={props.depth}
        className="article-panel current"
        style={{ transform: currentTransform }}
        testId="article-panel-current"
        onShare={props.onShare}
        onOpen={props.onOpen}
      />
      {hint && <div className={`gesture-hint ${drag.direction ?? ''}`}>{hint}</div>}
      {props.loadingRelated && <div className="related-loading"><span /> Ищем связи</div>}
    </main>
  );
}
