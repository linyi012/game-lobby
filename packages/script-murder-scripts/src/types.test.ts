import { describe, expect, it } from 'vitest';
import { officialSampleContent } from './builtin.js';
import { matchPlayerCount, validateScriptContent, validateMurderScriptInput } from './validate.js';

describe('validateScriptContent', () => {
  it('accepts official sample', () => {
    const result = validateScriptContent(officialSampleContent);
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate character ids', () => {
    const bad = {
      ...officialSampleContent,
      characters: [
        officialSampleContent.characters[0],
        { ...officialSampleContent.characters[1], id: officialSampleContent.characters[0]!.id },
      ],
    };
    expect(validateScriptContent(bad).ok).toBe(false);
  });
});

describe('validateMurderScriptInput', () => {
  it('validates player count range', () => {
    const result = validateMurderScriptInput({
      title: '测试',
      description: 'desc',
      minPlayers: 4,
      maxPlayers: 4,
      content: officialSampleContent,
    });
    expect(result.ok).toBe(true);
  });
});

describe('matchPlayerCount', () => {
  it('matches exact character count', () => {
    expect(matchPlayerCount(officialSampleContent, 4)).toBe(true);
    expect(matchPlayerCount(officialSampleContent, 3)).toBe(false);
  });
});
