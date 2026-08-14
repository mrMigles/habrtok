import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CheckCircle2,
  CornerDownRight,
  Download,
  Moon,
  Route,
  Share2,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import type { TokItem } from './types';

interface OnboardingProps {
  step: number;
  onStep: (step: number) => void;
  onFinish: () => void;
}

const tutorialSteps = [
  {
    title: 'Листайте вверх',
    body: 'Следующая техническая публикация уже стоит под текущей карточкой.',
    visual: <div className="tutorial-card"><span>H</span><ArrowUp /></div>,
  },
  {
    title: 'Уходите в тему',
    body: 'Свайп влево открывает подборку из того же хаба — это новый уровень пути.',
    visual: <div className="tutorial-pair"><span>root</span><ArrowLeft /><span>topic</span></div>,
  },
  {
    title: 'Возвращайтесь точно',
    body: 'Свайп вправо вернёт к той же карточке и позиции родительской ленты.',
    visual: <div className="tutorial-pair"><span>parent</span><ArrowRight /><span>child</span></div>,
  },
  {
    title: 'Сохраняйте маршрут',
    body: 'В путь попадают только осознанные переходы влево, а не всё просмотренное.',
    visual: <div className="tutorial-route"><Route /><span>публикация → тема → глубже</span></div>,
  },
];

export function Onboarding({ step, onStep, onFinish }: OnboardingProps) {
  const current = tutorialSteps[step] ?? tutorialSteps[0];
  const last = step === tutorialSteps.length - 1;

  return (
    <section className="onboarding" role="dialog" aria-modal="true" aria-label="Как пользоваться HabrTok" data-testid="onboarding">
      <button type="button" className="skip-button" onClick={onFinish}>Пропустить</button>
      <div className="tutorial-visual">{current.visual}</div>
      <div className="tutorial-copy">
        <span className="step-count">{String(step + 1).padStart(2, '0')} / 04</span>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
      </div>
      <footer className="tutorial-footer">
        <div className="tutorial-dots" aria-hidden="true">
          {tutorialSteps.map((item, index) => <span key={item.title} className={index === step ? 'active' : ''} />)}
        </div>
        <button type="button" className="primary-button" onClick={() => (last ? onFinish() : onStep(step + 1))}>
          {last ? 'В ленту' : 'Дальше'} <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

interface PathSheetProps {
  journey: TokItem[];
  current: TokItem;
  onClose: () => void;
  onShare: () => void;
}

export function PathSheet({ journey, current, onClose, onShare }: PathSheetProps) {
  return (
    <div className="sheet-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bottom-sheet path-sheet" role="dialog" aria-modal="true" aria-label="Ваш путь" data-testid="path-sheet">
        <span className="sheet-handle" />
        <header>
          <div><span className="sheet-kicker">Осознанные переходы</span><h2>Ваш путь</h2></div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Закрыть путь"><X /></button>
        </header>
        {journey.length > 0 ? (
          <div className="journey-list">
            {journey.map((item, index) => (
              <div className="journey-node" key={`${item.id}-${index}`}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="node-fallback">{item.title[0]}</span>}
                <div><small>Уровень {index + 1}</small><strong>{item.title}</strong></div>
                <ChevronDown className="connector" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : <p className="sheet-empty">Сделайте свайп влево, и первая тематическая развилка появится здесь.</p>}
        <div className="now-viewing">
          <CornerDownRight aria-hidden="true" />
          <div><span>Сейчас читаете</span><strong>{current.title}</strong></div>
        </div>
        <button type="button" className="primary-button wide" onClick={onShare}>
          <Share2 aria-hidden="true" /> Поделиться маршрутом
        </button>
      </section>
    </div>
  );
}

interface SettingsSheetProps {
  theme: 'light' | 'dark';
  canInstall: boolean;
  installed: boolean;
  onTheme: (theme: 'light' | 'dark') => void;
  onInstall: () => void;
  onTutorial: () => void;
  onClose: () => void;
}

export function SettingsSheet({ theme, canInstall, installed, onTheme, onInstall, onTutorial, onClose }: SettingsSheetProps) {
  return (
    <div className="sheet-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bottom-sheet settings-sheet" role="dialog" aria-modal="true" aria-label="Настройки" data-testid="settings-sheet">
        <span className="sheet-handle" />
        <header><div><span className="sheet-kicker">HabrTok</span><h2>Настройки</h2></div><button type="button" className="sheet-close" onClick={onClose} aria-label="Закрыть настройки"><X /></button></header>
        <div className="setting-block">
          <span>Тема интерфейса</span>
          <div className="theme-switch">
            <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => onTheme('light')}><Sun /> Светлая</button>
            <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => onTheme('dark')}><Moon /> Тёмная</button>
          </div>
        </div>
        <div className="setting-block">
          <span>Приложение на телефоне</span>
          <div className="pwa-card">
            <img src="/icons/habrtok-192.png" alt="" />
            <div className="pwa-copy">
              <strong>{installed ? 'HabrTok установлен' : 'HabrTok всегда под рукой'}</strong>
              <p>Открывается на весь экран; оболочка и ранее просмотренные данные доступны без сети.</p>
            </div>
            {installed ? (
              <span className="install-status"><CheckCircle2 /> Установлено</span>
            ) : canInstall ? (
              <button type="button" className="primary-button wide" onClick={onInstall}><Download /> Установить</button>
            ) : (
              <small className="install-hint"><Smartphone /> iPhone: «Поделиться» → «На экран „Домой“». Android: меню браузера → «Установить».</small>
            )}
          </div>
        </div>
        <button type="button" className="secondary-button wide" onClick={onTutorial}>Показать жесты ещё раз</button>
        <p className="source-note">Публикации загружаются напрямую из Habr API в вашем браузере. HabrTok не копирует полные тексты.</p>
      </section>
    </div>
  );
}

interface SharedIntroProps {
  items: TokItem[];
  pathLength: number;
  onContinue: () => void;
}

export function SharedIntro({ items, pathLength, onContinue }: SharedIntroProps) {
  return (
    <section className="shared-intro" role="dialog" aria-modal="true" data-testid="shared-intro">
      <span className="shared-icon"><Route /></span>
      <span className="sheet-kicker">Маршрут HabrTok</span>
      <h2>Вам оставили технический след</h2>
      <div className="shared-chain">
        {items.slice(0, pathLength + 1).map((item, index) => (
          <div key={item.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong></div>
        ))}
      </div>
      <button type="button" className="primary-button wide" onClick={onContinue}>Открыть маршрут <ArrowRight /></button>
    </section>
  );
}
