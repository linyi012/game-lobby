import { readFileSync } from 'node:fs';
import {
  mergePairPool,
  type MergePairPoolInput,
  type PairPackCategorySummary,
  type PairPackManifest,
  type WordPair,
  pairPackManifestSchema,
} from './types.js';
import { getManifestPath } from './builtin.js';

let cachedManifest: PairPackManifest | null = null;

export function loadBuiltinManifest(): PairPackManifest {
  if (cachedManifest) return cachedManifest;
  const raw = readFileSync(getManifestPath(), 'utf-8');
  const parsed = pairPackManifestSchema.parse(JSON.parse(raw));
  cachedManifest = parsed;
  return parsed;
}

export function setBuiltinManifest(manifest: PairPackManifest): void {
  cachedManifest = pairPackManifestSchema.parse(manifest);
}

export function listBuiltinCategories(): PairPackCategorySummary[] {
  const manifest = loadBuiltinManifest();
  return manifest.categories.map((c) => ({
    id: c.id,
    name: c.name,
    pairCount: c.pairs.length,
  }));
}

export function buildPairPoolFromBuiltin(input: Omit<MergePairPoolInput, 'manifest'>): WordPair[] {
  return mergePairPool({ ...input, manifest: loadBuiltinManifest() });
}

export { getManifestPath } from './builtin.js';
export * from './types.js';
