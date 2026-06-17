import { describe, expect, it } from 'vitest';
import { mergeWordPool, isGuessMatch, buildWordHint } from './types.js';

const manifest = {
  version: '1',
  categories: [
    { id: 'a', name: 'A', words: ['苹果', '梨'] },
    { id: 'b', name: 'B', words: ['猫', '狗'] },
  ],
};

describe('mergeWordPool', () => {
  it('merges categories, user packs, and room words with dedup', () => {
    const pool = mergeWordPool({
      categoryIds: ['a'],
      userPackIds: ['u1'],
      userPacks: [{ id: 'u1', words: ['苹果', '游泳'] }],
      roomExtraWords: ['游泳', '  跑步  '],
      manifest,
    });
    expect([...pool].sort()).toEqual(['苹果', '梨', '游泳', '跑步'].sort());
  });
});

describe('guess helpers', () => {
  it('matches trimmed guess', () => {
    expect(isGuessMatch(' 苹果 ', '苹果')).toBe(true);
    expect(isGuessMatch('梨', '苹果')).toBe(false);
  });

  it('builds word hint', () => {
    expect(buildWordHint('苹果')).toBe('_ _');
    expect(buildWordHint(null)).toBe('');
  });
});
