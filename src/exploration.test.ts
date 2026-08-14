import { describe, expect, it } from 'vitest';
import { explorationReducer, initialExplorationState, uniqueItems } from './exploration';
import type { FeedState, TokItem } from './types';

function item(id: string, title = `Статья ${id}`): TokItem {
  return {
    id,
    source: 'Habr',
    title,
    summary: `Достаточно подробный анонс технической публикации номер ${id}.`,
    canonicalUrl: `https://habr.com/ru/articles/${id}/`,
  };
}

describe('explorationReducer', () => {
  it('keeps next and previous inside boundaries', () => {
    const seeded = explorationReducer(initialExplorationState, { type: 'SET_ROOT', items: [item('1'), item('2')] });
    expect(explorationReducer(seeded, { type: 'PREVIOUS' })).toBe(seeded);
    const next = explorationReducer(seeded, { type: 'NEXT' });
    expect(next.levels[0].index).toBe(1);
    expect(explorationReducer(next, { type: 'NEXT' })).toBe(next);
    expect(explorationReducer(next, { type: 'PREVIOUS' }).levels[0].index).toBe(0);
  });

  it('pushes nested levels, filters the anchor, and records only committed anchors', () => {
    let state = explorationReducer(initialExplorationState, { type: 'SET_ROOT', items: [item('1'), item('2')] });
    state = explorationReducer(state, { type: 'NEXT' });
    state = explorationReducer(state, { type: 'EXPLORE', anchor: item('2'), items: [item('2'), item('3'), item('3')] });
    expect(state.levels).toHaveLength(2);
    expect(state.levels[1].items.map((entry) => entry.id)).toEqual(['3']);
    expect(state.journey.map((entry) => entry.id)).toEqual(['2']);
    state = explorationReducer(state, { type: 'EXPLORE', anchor: item('3'), items: [item('4')] });
    expect(state.journey.map((entry) => entry.id)).toEqual(['2', '3']);
  });

  it('restores the exact parent index on back and home', () => {
    let state = explorationReducer(initialExplorationState, { type: 'SET_ROOT', items: [item('1'), item('2'), item('3')] });
    state = explorationReducer(state, { type: 'NEXT' });
    state = explorationReducer(state, { type: 'EXPLORE', anchor: item('2'), items: [item('4'), item('5')] });
    state = explorationReducer(state, { type: 'NEXT' });
    const back = explorationReducer(state, { type: 'BACK' });
    expect(back.levels[0].index).toBe(1);
    const nestedAgain = explorationReducer(state, { type: 'EXPLORE', anchor: item('5'), items: [item('6')] });
    const home = explorationReducer(nestedAgain, { type: 'HOME' });
    expect(home.levels).toHaveLength(1);
    expect(home.levels[0].index).toBe(1);
    expect(home.journey.map((entry) => entry.id)).toEqual(['2', '5']);
  });

  it('appends and deduplicates without reordering', () => {
    expect(uniqueItems([item('1'), item('2')], [item('2'), item('3')]).map((entry) => entry.id)).toEqual(['1', '2', '3']);
  });

  it('keeps an active child when a late root response arrives', () => {
    let state = explorationReducer(initialExplorationState, { type: 'SET_ROOT', items: [item('1'), item('2')] });
    state = explorationReducer(state, { type: 'EXPLORE', anchor: item('1'), items: [item('3')] });
    const nextState = explorationReducer(state, { type: 'SET_ROOT', items: [item('4')] });
    expect(nextState.levels).toHaveLength(2);
    expect(nextState.levels[1].items[0].id).toBe('3');
    expect(nextState.levels[0].items.map((entry) => entry.id)).toEqual(['1', '2', '4']);
  });

  it('rehydrates a shared journey into a navigable chain', () => {
    const state = explorationReducer(initialExplorationState, {
      type: 'HYDRATE_SHARED',
      articles: [item('1'), item('2'), item('3')],
      pathLength: 2,
    });
    expect(state.levels.map((level) => level.items[0].id)).toEqual(['1', '2', '3']);
    expect(state.journey.map((entry) => entry.id)).toEqual(['1', '2']);
  });

  it('does not push an empty child', () => {
    const state: FeedState = { levels: [{ anchor: null, items: [item('1')], index: 0 }], journey: [] };
    expect(explorationReducer(state, { type: 'EXPLORE', anchor: item('1'), items: [item('1')] })).toBe(state);
  });
});
