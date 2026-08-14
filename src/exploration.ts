import type { FeedLevel, FeedState, TokItem } from './types';

export type ExplorationAction =
  | { type: 'SET_ROOT'; items: TokItem[] }
  | { type: 'RESET_ROOT'; items: TokItem[] }
  | { type: 'APPEND_ITEMS'; level: number; items: TokItem[]; exhausted?: boolean }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'EXPLORE'; anchor: TokItem; items: TokItem[] }
  | { type: 'BACK' }
  | { type: 'HOME' }
  | { type: 'HYDRATE_SHARED'; articles: TokItem[]; pathLength: number };

export const initialExplorationState: FeedState = {
  levels: [{ anchor: null, items: [], index: 0 }],
  journey: [],
};

function keyOf(item: TokItem): string {
  return `${item.source}:${item.id}`;
}

export function uniqueItems(existing: TokItem[], incoming: TokItem[]): TokItem[] {
  const keys = new Set(existing.map(keyOf));
  const urls = new Set(existing.map((item) => item.canonicalUrl));
  const result = [...existing];

  for (const item of incoming) {
    const key = keyOf(item);
    if (keys.has(key) || urls.has(item.canonicalUrl)) continue;
    keys.add(key);
    urls.add(item.canonicalUrl);
    result.push(item);
  }

  return result;
}

export function explorationReducer(state: FeedState, action: ExplorationAction): FeedState {
  switch (action.type) {
    case 'SET_ROOT': {
      const previousRoot = state.levels[0] ?? initialExplorationState.levels[0];
      const root: FeedLevel = {
        ...previousRoot,
        anchor: null,
        items: uniqueItems(previousRoot.items, action.items),
        index: Math.min(previousRoot.index, Math.max(0, uniqueItems(previousRoot.items, action.items).length - 1)),
      };
      const levels = state.levels.length > 0 ? [...state.levels] : [root];
      levels[0] = root;
      return { ...state, levels };
    }
    case 'RESET_ROOT':
      return { levels: [{ anchor: null, items: uniqueItems([], action.items), index: 0 }], journey: [] };
    case 'APPEND_ITEMS': {
      const levels = state.levels.map((level, index) =>
        index === action.level
          ? {
              ...level,
              items: uniqueItems(level.items, action.items),
              ...(action.exhausted === undefined ? {} : { exhausted: action.exhausted }),
            }
          : level,
      );
      return { ...state, levels };
    }
    case 'NEXT': {
      const active = state.levels.at(-1);
      if (!active || active.index >= active.items.length - 1) return state;
      const levels = [...state.levels];
      levels[levels.length - 1] = { ...active, index: active.index + 1 };
      return { ...state, levels };
    }
    case 'PREVIOUS': {
      const active = state.levels.at(-1);
      if (!active || active.index <= 0) return state;
      const levels = [...state.levels];
      levels[levels.length - 1] = { ...active, index: active.index - 1 };
      return { ...state, levels };
    }
    case 'EXPLORE': {
      const candidates = uniqueItems(
        [],
        action.items.filter((item) => keyOf(item) !== keyOf(action.anchor)),
      );
      if (candidates.length === 0) return state;
      const activeAnchors = state.levels.slice(1).flatMap((level) => (level.anchor ? [level.anchor] : []));
      return {
        levels: [...state.levels, { anchor: action.anchor, items: candidates, index: 0 }],
        journey: [...activeAnchors, action.anchor],
      };
    }
    case 'BACK':
      return state.levels.length > 1 ? { ...state, levels: state.levels.slice(0, -1) } : state;
    case 'HOME':
      return { ...state, levels: state.levels.slice(0, 1) };
    case 'HYDRATE_SHARED': {
      if (action.articles.length === 0) return state;
      const path = action.articles.slice(0, action.pathLength);
      const current = action.articles[action.pathLength] ?? path.at(-1);
      if (!current) return state;
      if (path.length === 0) {
        return { levels: [{ anchor: null, items: [current], index: 0 }], journey: [] };
      }

      const levels: FeedLevel[] = [{ anchor: null, items: [path[0]], index: 0 }];
      for (let index = 0; index < path.length; index += 1) {
        const anchor = path[index];
        const candidate = path[index + 1] ?? current;
        if (anchor && candidate && keyOf(anchor) !== keyOf(candidate)) {
          levels.push({ anchor, items: [candidate], index: 0 });
        }
      }
      return { levels, journey: path };
    }
  }
}

export function activeLevel(state: FeedState): FeedLevel {
  return state.levels.at(-1) ?? initialExplorationState.levels[0];
}

export function currentItem(state: FeedState): TokItem | undefined {
  const level = activeLevel(state);
  return level.items[level.index];
}
