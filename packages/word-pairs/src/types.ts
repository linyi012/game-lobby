import { z } from 'zod';

const pairTupleSchema = z.tuple([
  z.string().min(1).max(32),
  z.string().min(1).max(32),
]);

export const pairPackCategorySchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  pairs: z.array(pairTupleSchema).min(1),
});

export const pairPackManifestSchema = z.object({
  version: z.string().min(1).max(64),
  categories: z.array(pairPackCategorySchema).min(1),
});

export type PairPackCategory = z.infer<typeof pairPackCategorySchema>;
export type PairPackManifest = z.infer<typeof pairPackManifestSchema>;
export type WordPair = [string, string];

export interface PairPackCategorySummary {
  id: string;
  name: string;
  pairCount: number;
}

export interface UserPairPack {
  id: string;
  name: string;
  pairs: WordPair[];
  createdAt: string;
  updatedAt: string;
}

export interface PairPackSyncStatus {
  version: string | null;
  lastSyncedAt: string | null;
  success: boolean | null;
  addedCount: number;
  removedCount: number;
  error: string | null;
}

export interface MergePairPoolInput {
  categoryIds: string[];
  userPairPackIds?: string[];
  userPairPacks?: { id: string; pairs: WordPair[] }[];
  roomExtraPairs?: WordPair[];
  manifest: PairPackManifest;
}

function normalizePair(pair: WordPair): WordPair {
  return [pair[0].trim(), pair[1].trim()];
}

function pairKey(pair: WordPair): string {
  const [a, b] = normalizePair(pair);
  return `${a}\0${b}`;
}

export function mergePairPool(input: MergePairPoolInput): WordPair[] {
  const { categoryIds, userPairPacks = [], roomExtraPairs = [], manifest } = input;
  const selected = new Set(categoryIds);
  const seen = new Set<string>();
  const pairs: WordPair[] = [];

  const addPair = (pair: WordPair) => {
    const normalized = normalizePair(pair);
    if (!normalized[0] || !normalized[1]) return;
    const key = pairKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(normalized);
  };

  for (const cat of manifest.categories) {
    if (selected.has(cat.id)) {
      for (const pair of cat.pairs) {
        addPair(pair);
      }
    }
  }

  const userPackIdSet = new Set(input.userPairPackIds ?? []);
  for (const pack of userPairPacks) {
    if (userPackIdSet.has(pack.id)) {
      for (const pair of pack.pairs) {
        addPair(pair);
      }
    }
  }

  for (const pair of roomExtraPairs) {
    addPair(pair);
  }

  return pairs;
}

export function pickRandomPair(pool: WordPair[]): WordPair | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function parsePairLines(text: string): WordPair[] {
  const pairs: WordPair[] = [];
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      pairs.push([parts[0]!, parts[1]!]);
    }
  }
  return pairs;
}
