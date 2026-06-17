import { readFileSync } from 'node:fs';
import {
  mergeWordPool,
  type MergeWordPoolInput,
  type WordPackCategorySummary,
  type WordPackManifest,
  wordPackManifestSchema,
} from './types.js';
import { getManifestPath } from './builtin.js';

let cachedManifest: WordPackManifest | null = null;

export function loadBuiltinManifest(): WordPackManifest {
  if (cachedManifest) return cachedManifest;
  const raw = readFileSync(getManifestPath(), 'utf-8');
  const parsed = wordPackManifestSchema.parse(JSON.parse(raw));
  cachedManifest = parsed;
  return parsed;
}

export function setBuiltinManifest(manifest: WordPackManifest): void {
  cachedManifest = wordPackManifestSchema.parse(manifest);
}

export function listBuiltinCategories(): WordPackCategorySummary[] {
  const manifest = loadBuiltinManifest();
  return manifest.categories.map((c) => ({
    id: c.id,
    name: c.name,
    wordCount: c.words.length,
  }));
}

export function buildWordPoolFromBuiltin(input: Omit<MergeWordPoolInput, 'manifest'>): string[] {
  return mergeWordPool({ ...input, manifest: loadBuiltinManifest() });
}

export { getManifestPath } from './builtin.js';
export * from './types.js';
