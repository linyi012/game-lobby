import { z } from 'zod';

export const scriptPhaseTypeSchema = z.enum([
  'intro',
  'reading',
  'discussion',
  'search',
  'vote',
  'reveal',
]);

export const clueVisibilitySchema = z.enum(['public', 'character', 'search']);

export const scriptActSchema = z.object({
  order: z.number().int().min(1),
  title: z.string().min(1).max(128),
  publicText: z.string().min(1).max(8000),
  phases: z.array(scriptPhaseTypeSchema).min(1),
  autoAdvanceSec: z.number().int().min(10).max(3600).optional(),
});

export const scriptCharacterSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  publicProfile: z.string().min(1).max(2000),
  privateScript: z.string().min(1).max(8000),
  objectives: z.string().max(2000).default(''),
});

export const scriptClueSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  content: z.string().min(1).max(4000),
  revealAct: z.number().int().min(1),
  visibility: clueVisibilitySchema,
  characterId: z.string().max(64).optional(),
});

export const murderScriptContentSchema = z.object({
  acts: z.array(scriptActSchema).min(1),
  characters: z.array(scriptCharacterSchema).min(1).max(8),
  clues: z.array(scriptClueSchema),
});

export type ScriptPhaseType = z.infer<typeof scriptPhaseTypeSchema>;
export type ClueVisibility = z.infer<typeof clueVisibilitySchema>;
export type ScriptAct = z.infer<typeof scriptActSchema>;
export type ScriptCharacter = z.infer<typeof scriptCharacterSchema>;
export type ScriptClue = z.infer<typeof scriptClueSchema>;
export type MurderScriptContent = z.infer<typeof murderScriptContentSchema>;

export interface MurderScriptSummary {
  id: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  characterCount: number;
  actCount: number;
  isOfficial: boolean;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MurderScriptDetail extends MurderScriptSummary {
  content: MurderScriptContent;
}

export interface CreateMurderScriptInput {
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  content: MurderScriptContent;
}

export interface UpdateMurderScriptInput extends CreateMurderScriptInput {}
