import type { TokItem } from './types';

type RandomIndex = (upperExclusive: number) => number;

export function secureRandomIndex(upperExclusive: number): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
    throw new RangeError('upperExclusive must be a positive integer');
  }

  if (!globalThis.crypto?.getRandomValues) {
    return Math.floor(Math.random() * upperExclusive);
  }

  const range = 2 ** 32;
  const limit = range - (range % upperExclusive);
  const value = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % upperExclusive;
}

/**
 * Selects a random entry point while preserving Habr's ranked order cyclically.
 * The previous start is excluded when another article is available, so a fresh
 * launch never opens on the same article twice in a row.
 */
export function randomizeInitialFeed(
  items: TokItem[],
  previousStartId: string | null,
  randomIndex: RandomIndex = secureRandomIndex,
): TokItem[] {
  if (items.length < 2) return [...items];

  const eligibleIndexes = items.flatMap((item, index) =>
    item.id === previousStartId ? [] : [index],
  );
  const pool = eligibleIndexes.length > 0 ? eligibleIndexes : items.map((_, index) => index);
  const startIndex = pool[randomIndex(pool.length)] ?? 0;

  return [...items.slice(startIndex), ...items.slice(0, startIndex)];
}
