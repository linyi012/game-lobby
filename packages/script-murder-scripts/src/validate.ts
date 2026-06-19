import {
  murderScriptContentSchema,
  type CreateMurderScriptInput,
  type MurderScriptContent,
} from './types.js';

export interface ScriptValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateScriptContent(content: unknown): ScriptValidationResult {
  const parsed = murderScriptContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return validateParsedContent(parsed.data);
}

export function validateMurderScriptInput(input: CreateMurderScriptInput): ScriptValidationResult {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('标题不能为空');
  if (input.minPlayers < 1) errors.push('最少人数须 ≥ 1');
  if (input.maxPlayers < input.minPlayers) errors.push('最多人数不能小于最少人数');
  const contentResult = validateScriptContent(input.content);
  if (!contentResult.ok) {
    errors.push(...contentResult.errors);
    return { ok: false, errors };
  }
  const charCount = input.content.characters.length;
  if (charCount < input.minPlayers || charCount > input.maxPlayers) {
    errors.push(`角色数（${charCount}）须在 ${input.minPlayers}–${input.maxPlayers} 之间`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

function validateParsedContent(content: MurderScriptContent): ScriptValidationResult {
  const errors: string[] = [];
  const charIds = new Set(content.characters.map((c) => c.id));
  if (charIds.size !== content.characters.length) {
    errors.push('角色 id 不能重复');
  }
  const actOrders = content.acts.map((a) => a.order);
  if (new Set(actOrders).size !== actOrders.length) {
    errors.push('幕次 order 不能重复');
  }
  const clueIds = new Set(content.clues.map((c) => c.id));
  if (clueIds.size !== content.clues.length) {
    errors.push('线索 id 不能重复');
  }
  const maxAct = Math.max(...content.acts.map((a) => a.order));
  for (const clue of content.clues) {
    if (clue.revealAct > maxAct) {
      errors.push(`线索「${clue.title}」的 revealAct 超出幕数`);
    }
    if (clue.characterId && !charIds.has(clue.characterId)) {
      errors.push(`线索「${clue.title}」关联了不存在的角色`);
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function matchPlayerCount(content: MurderScriptContent, playerCount: number): boolean {
  return content.characters.length === playerCount;
}
