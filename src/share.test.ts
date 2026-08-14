import { describe, expect, it } from 'vitest';
import { createShareUrl, parseShareHash } from './share';

describe('share routes', () => {
  it('encodes and parses a compact journey', () => {
    const url = createShareUrl(['101', '202'], '303', 'https://example.com/app?x=1');
    expect(url).toBe('https://example.com/app?x=1#p=101.202&c=303');
    expect(parseShareHash(new URL(url).hash)).toEqual({ pathIds: ['101', '202'], currentId: '303' });
  });

  it('rejects invalid current ids and filters invalid path segments', () => {
    expect(parseShareHash('#p=1.bad.2&c=3')).toEqual({ pathIds: ['1', '2'], currentId: '3' });
    expect(parseShareHash('#p=1.2&c=nope')).toBeNull();
  });
});
