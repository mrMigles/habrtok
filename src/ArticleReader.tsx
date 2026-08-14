import { ArrowLeft, Clock3, ExternalLink, RefreshCw, Share2 } from 'lucide-react';
import { useMemo } from 'react';
import { sanitizeArticleHtml } from './articleContent';
import type { TokArticleDetail, TokItem } from './types';

interface ArticleReaderProps {
  article: TokItem;
  detail: TokArticleDetail | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onOpen: () => void;
  onRetry: () => void;
  onShare: () => void;
}

function publishedLabel(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function ArticleReader({
  article,
  detail,
  loading,
  error,
  onBack,
  onOpen,
  onRetry,
  onShare,
}: ArticleReaderProps) {
  const current = detail?.article ?? article;
  const safeBody = useMemo(
    () => (detail ? sanitizeArticleHtml(detail.bodyHtml) : ''),
    [detail],
  );
  const published = publishedLabel(current.publishedAt);

  return (
    <section
      className="article-reader"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-title"
      data-testid="article-reader"
    >
      <header className="reader-toolbar">
        <button type="button" className="reader-back" onClick={onBack} aria-label="Назад к ленте">
          <ArrowLeft aria-hidden="true" />
          <span>Назад</span>
        </button>
        <span className="reader-label">Статья</span>
        <div className="reader-toolbar-actions">
          <button type="button" onClick={onShare} aria-label="Поделиться статьёй">
            <Share2 aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpen} aria-label="Открыть статью на Habr">
            <ExternalLink aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="reader-scroll" data-testid="reader-scroll">
        {current.imageUrl && (
          <div className="reader-hero">
            <img src={current.imageUrl} alt="" />
          </div>
        )}
        <article className="reader-page">
          <div className="reader-kicker">
            <span>{current.hubs?.[0] ?? 'Habr'}</span>
            {current.readingTime && <span><Clock3 aria-hidden="true" /> {current.readingTime} мин</span>}
          </div>
          <h1 id="reader-title">{current.title}</h1>
          <div className="reader-byline">
            <span className="habr-mark">H</span>
            <div>
              <strong>{current.author ? `@${current.author}` : 'Автор на Habr'}</strong>
              {published && <span>{published}</span>}
            </div>
          </div>
          <p className="reader-lead">{current.summary}</p>

          {loading && (
            <div className="reader-loading" role="status" aria-label="Загружаем полный текст">
              <span /><span /><span /><span />
            </div>
          )}
          {error && !loading && (
            <div className="reader-error" role="alert">
              <strong>Полный текст не загрузился</strong>
              <p>{error}</p>
              <button type="button" className="secondary-button" onClick={onRetry}>
                <RefreshCw aria-hidden="true" /> Повторить
              </button>
            </div>
          )}
          {detail && !loading && (
            <div
              className="reader-body"
              data-testid="reader-body"
              dangerouslySetInnerHTML={{ __html: safeBody }}
            />
          )}

          <footer className="reader-footer">
            <p>Оригинал и обсуждение всегда доступны на Habr.</p>
            <div>
              <button type="button" className="secondary-button" onClick={onShare}>
                <Share2 aria-hidden="true" /> Поделиться
              </button>
              <button type="button" className="primary-button" onClick={onOpen}>
                Открыть на Habr <ExternalLink aria-hidden="true" />
              </button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}
