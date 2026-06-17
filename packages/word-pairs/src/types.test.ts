import { describe, it, expect } from 'vitest';
import { mergePairPool, parsePairLines, pairPackManifestSchema } from './types.js';

const manifest = pairPackManifestSchema.parse({
  version: '1',
  categories: [
    {
      id: 'food',
      name: '美食',
      pairs: [
        ['苹果', '梨'],
        ['咖啡', '奶茶'],
      ],
    },
    {
      id: 'sport',
      name: '运动',
      pairs: [['篮球', '足球']],
    },
  ],
});

describe('mergePairPool', () => {
  it('merges selected categories and dedupes pairs', () => {
    const pool = mergePairPool({
      categoryIds: ['food', 'sport'],
      manifest,
      roomExtraPairs: [['苹果', '梨']],
    });
    expect(pool).toHaveLength(3);
    expect(pool).toContainEqual(['苹果', '梨']);
    expect(pool).toContainEqual(['篮球', '足球']);
  });

  it('includes user pair packs when selected', () => {
    const pool = mergePairPool({
      categoryIds: [],
      userPairPackIds: ['pack-1'],
      userPairPacks: [{ id: 'pack-1', pairs: [['猫', '狗']] }],
      manifest,
    });
    expect(pool).toEqual([['猫', '狗']]);
  });
});

describe('parsePairLines', () => {
  it('parses comma-separated pairs per line', () => {
    expect(parsePairLines('苹果,梨\n咖啡，奶茶')).toEqual([
      ['苹果', '梨'],
      ['咖啡', '奶茶'],
    ]);
  });
});
