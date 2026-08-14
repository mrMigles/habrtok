import { describe, expect, it, vi } from 'vitest';
import { randomizeInitialFeed, secureRandomIndex } from './randomizeFeed';
import type { TokItem } from './types';

function item(id: string): TokItem {
  return {
    id,
    source: 'Habr',
    title: `Article ${id}`,
    summary: `A sufficiently descriptive article summary for ${id}.`,
    canonicalUrl: `https://habr.com/ru/articles/${id}/`,
  };
}

describe('randomizeInitialFeed', () => {
  const items = ['1', '2', '3', '4'].map(item);

  it('rotates from a random entry point without changing the ranked cycle', () => {
    expect(randomizeInitialFeed(items, null, () => 2).map(({ id }) => id)).toEqual([
      '3',
      '4',
      '1',
      '2',
    ]);
    expect(items.map(({ id }) => id)).toEqual(['1', '2', '3', '4']);
  });

  it('excludes the previous starting article when alternatives exist', () => {
    const next = randomizeInitialFeed(items, '1', () => 0);
    expect(next[0]?.id).toBe('2');
    expect(next.map(({ id }) => id).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('keeps empty and single-item feeds safe', () => {
    expect(randomizeInitialFeed([], null)).toEqual([]);
    expect(randomizeInitialFeed([items[0]], '1')).toEqual([items[0]]);
  });
});

describe('secureRandomIndex', () => {
  it('maps browser entropy into the requested range', () => {
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        new Uint32Array(array.buffer, array.byteOffset, 1)[0] = 7;
        return array;
      });

    expect(secureRandomIndex(4)).toBe(3);
    getRandomValues.mockRestore();
  });

  it('rejects invalid ranges', () => {
    expect(() => secureRandomIndex(0)).toThrow(RangeError);
  });
});
