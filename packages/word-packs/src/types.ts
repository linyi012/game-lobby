import { z } from 'zod';

export const wordPackCategorySchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  words: z.array(z.string().min(1).max(32)).min(1),
});

export const wordPackManifestSchema = z.object({
  version: z.string().min(1).max(64),
  categories: z.array(wordPackCategorySchema).min(1),
});

export type WordPackCategory = z.infer<typeof wordPackCategorySchema>;
export type WordPackManifest = z.infer<typeof wordPackManifestSchema>;

export interface WordPackCategorySummary {
  id: string;
  name: string;
  wordCount: number;
}

export interface UserWordPack {
  id: string;
  name: string;
  words: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WordPackSyncStatus {
  version: string | null;
  lastSyncedAt: string | null;
  success: boolean | null;
  addedCount: number;
  removedCount: number;
  error: string | null;
}

export interface MergeWordPoolInput {
  categoryIds: string[];
  userPackIds?: string[];
  userPacks?: { id: string; words: string[] }[];
  roomExtraWords?: string[];
  manifest: WordPackManifest;
}

export function mergeWordPool(input: MergeWordPoolInput): string[] {
  const { categoryIds, userPacks = [], roomExtraWords = [], manifest } = input;
  const selected = new Set(categoryIds);
  const words: string[] = [];

  for (const cat of manifest.categories) {
    if (selected.has(cat.id)) {
      words.push(...cat.words);
    }
  }

  const userPackIdSet = new Set(input.userPackIds ?? []);
  for (const pack of userPacks) {
    if (userPackIdSet.has(pack.id)) {
      words.push(...pack.words);
    }
  }

  if (roomExtraWords.length > 0) {
    words.push(...roomExtraWords);
  }

  return [...new Set(words.map((w) => w.trim()).filter(Boolean))];
}

export function pickRandomWords(pool: string[], count: number, exclude: string[] = []): string[] {
  const excludeSet = new Set(exclude);
  const available = pool.filter((w) => !excludeSet.has(w));
  if (available.length === 0) return [];
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function buildWordHint(word: string | null): string {
  if (!word) return '';
  return [...word].map(() => '_').join(' ');
}

export function normalizeGuess(text: string): string {
  return text.trim();
}

export function isGuessMatch(guess: string, answer: string): boolean {
  return normalizeGuess(guess) === normalizeGuess(answer);
}
