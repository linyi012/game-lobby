import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Database } from '@game-lobby/db';
import {
  pairEntries,
  pairPackCategories,
  pairPackSyncRuns,
  pairPacks,
} from '@game-lobby/db';
import {
  buildPairPoolFromBuiltin,
  loadBuiltinManifest,
  mergePairPool,
  type PairPackManifest,
  type PairPackSyncStatus,
  type WordPair,
  pairPackManifestSchema,
} from '@game-lobby/word-pairs';
import { readFileSync } from 'node:fs';
import { getManifestPath } from '@game-lobby/word-pairs';

export interface ResolvePairPoolInput {
  categoryIds: string[];
  userPairPackIds: string[];
  roomExtraPairs: WordPair[];
}

function isMissingRelationError(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    (err as { cause?: { code?: string } })?.cause?.code;
  return code === '42P01';
}

async function pairPackTablesReady(db: Database): Promise<boolean> {
  try {
    await db.select().from(pairPackSyncRuns).limit(1);
    return true;
  } catch (err) {
    if (isMissingRelationError(err)) return false;
    throw err;
  }
}

function entryToPair(entry: { civilianWord: string; undercoverWord: string }): WordPair {
  return [entry.civilianWord, entry.undercoverWord];
}

export async function resolvePairPool(db: Database, input: ResolvePairPoolInput): Promise<WordPair[]> {
  const { categoryIds, userPairPackIds, roomExtraPairs } = input;

  let manifest: PairPackManifest;
  try {
    const cats = await db.select().from(pairPackCategories);
    if (cats.length === 0) {
      manifest = loadBuiltinManifest();
    } else {
      const officialPacks = await db
        .select()
        .from(pairPacks)
        .where(isNull(pairPacks.ownerUserId));
      const packIds = officialPacks.map((p) => p.id);
      const entries =
        packIds.length > 0
          ? await db.select().from(pairEntries).where(inArray(pairEntries.packId, packIds))
          : [];

      const categories = cats.map((cat) => {
        const pack = officialPacks.find((p) => p.categoryId === cat.id);
        const pairs = pack
          ? entries.filter((e) => e.packId === pack.id).map(entryToPair)
          : [];
        return { id: cat.id, name: cat.name, pairs };
      });

      manifest = pairPackManifestSchema.parse({
        version: 'db',
        categories: categories.filter((c) => c.pairs.length > 0),
      });

      if (manifest.categories.length === 0) {
        manifest = loadBuiltinManifest();
      }
    }
  } catch {
    manifest = loadBuiltinManifest();
  }

  let userPairPacks: { id: string; pairs: WordPair[] }[] = [];
  if (userPairPackIds.length > 0) {
    const packs = await db
      .select()
      .from(pairPacks)
      .where(and(inArray(pairPacks.id, userPairPackIds), isNotNull(pairPacks.ownerUserId)));
    const ids = packs.map((p) => p.id);
    const entries =
      ids.length > 0
        ? await db.select().from(pairEntries).where(inArray(pairEntries.packId, ids))
        : [];
    userPairPacks = packs.map((p) => ({
      id: p.id,
      pairs: entries.filter((e) => e.packId === p.id).map(entryToPair),
    }));
  }

  const fromDb = mergePairPool({
    categoryIds,
    userPairPackIds,
    userPairPacks,
    roomExtraPairs,
    manifest,
  });

  if (fromDb.length > 0) return fromDb;

  return buildPairPoolFromBuiltin({
    categoryIds:
      categoryIds.length > 0 ? categoryIds : loadBuiltinManifest().categories.map((c) => c.id),
    userPairPackIds,
    userPairPacks,
    roomExtraPairs,
  });
}

function builtinCategorySummaries() {
  return loadBuiltinManifest().categories.map((c) => ({
    id: c.id,
    name: c.name,
    pairCount: c.pairs.length,
  }));
}

export async function listPairCategories(db: Database) {
  if (!(await pairPackTablesReady(db))) {
    return builtinCategorySummaries();
  }

  try {
    const rows = await db.select().from(pairPackCategories);
    if (rows.length === 0) {
      return builtinCategorySummaries();
    }

    const officialPacks = await db.select().from(pairPacks).where(isNull(pairPacks.ownerUserId));
    const packIds = officialPacks.map((p) => p.id);
    const entries =
      packIds.length > 0
        ? await db.select().from(pairEntries).where(inArray(pairEntries.packId, packIds))
        : [];

    return rows.map((cat) => {
      const pack = officialPacks.find((p) => p.categoryId === cat.id);
      const count = pack ? entries.filter((e) => e.packId === pack.id).length : 0;
      return { id: cat.id, name: cat.name, pairCount: count };
    });
  } catch (err) {
    if (isMissingRelationError(err)) return builtinCategorySummaries();
    throw err;
  }
}

export async function listUserPairPacks(db: Database, userId: string) {
  if (!(await pairPackTablesReady(db))) {
    return [];
  }

  try {
    const packs = await db.select().from(pairPacks).where(eq(pairPacks.ownerUserId, userId));
    const ids = packs.map((p) => p.id);
    const entries =
      ids.length > 0
        ? await db.select().from(pairEntries).where(inArray(pairEntries.packId, ids))
        : [];

    return packs.map((p) => ({
      id: p.id,
      name: p.name,
      pairs: entries.filter((e) => e.packId === p.id).map(entryToPair),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

function dedupePairs(pairs: WordPair[]): WordPair[] {
  const seen = new Set<string>();
  const result: WordPair[] = [];
  for (const pair of pairs) {
    const key = `${pair[0].trim()}\0${pair[1].trim()}`;
    if (!pair[0].trim() || !pair[1].trim() || seen.has(key)) continue;
    seen.add(key);
    result.push([pair[0].trim(), pair[1].trim()]);
  }
  return result;
}

export async function createUserPairPack(
  db: Database,
  userId: string,
  name: string,
  pairs: WordPair[],
) {
  const unique = dedupePairs(pairs);
  const [pack] = await db
    .insert(pairPacks)
    .values({ ownerUserId: userId, name, categoryId: null })
    .returning();
  if (unique.length > 0) {
    await db.insert(pairEntries).values(
      unique.map((pair) => ({
        packId: pack!.id,
        civilianWord: pair[0],
        undercoverWord: pair[1],
      })),
    );
  }
  return {
    id: pack!.id,
    name: pack!.name,
    pairs: unique,
    createdAt: pack!.createdAt.toISOString(),
    updatedAt: pack!.updatedAt.toISOString(),
  };
}

export async function updateUserPairPack(
  db: Database,
  userId: string,
  packId: string,
  name: string,
  pairs: WordPair[],
) {
  const [pack] = await db.select().from(pairPacks).where(eq(pairPacks.id, packId));
  if (!pack || pack.ownerUserId !== userId) return null;

  const unique = dedupePairs(pairs);
  await db.update(pairPacks).set({ name, updatedAt: new Date() }).where(eq(pairPacks.id, packId));
  await db.delete(pairEntries).where(eq(pairEntries.packId, packId));
  if (unique.length > 0) {
    await db.insert(pairEntries).values(
      unique.map((pair) => ({
        packId,
        civilianWord: pair[0],
        undercoverWord: pair[1],
      })),
    );
  }

  const [updated] = await db.select().from(pairPacks).where(eq(pairPacks.id, packId));
  return {
    id: packId,
    name,
    pairs: unique,
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
  };
}

export async function deleteUserPairPack(db: Database, userId: string, packId: string) {
  const [pack] = await db.select().from(pairPacks).where(eq(pairPacks.id, packId));
  if (!pack || pack.ownerUserId !== userId) return false;
  await db.delete(pairPacks).where(eq(pairPacks.id, packId));
  return true;
}

async function fetchManifestFromUrl(url: string): Promise<PairPackManifest | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const json = await res.json();
    return pairPackManifestSchema.parse(json);
  } catch {
    return null;
  }
}

function loadLocalManifest(): PairPackManifest {
  const raw = readFileSync(getManifestPath(), 'utf-8');
  return pairPackManifestSchema.parse(JSON.parse(raw));
}

export async function getPairSyncStatus(db: Database): Promise<PairPackSyncStatus> {
  if (!(await pairPackTablesReady(db))) {
    return {
      version: null,
      lastSyncedAt: null,
      success: null,
      addedCount: 0,
      removedCount: 0,
      error: '词对包表未创建，请运行 pnpm db:migrate',
    };
  }

  const [last] = await db
    .select()
    .from(pairPackSyncRuns)
    .orderBy(desc(pairPackSyncRuns.syncedAt))
    .limit(1);

  if (!last) {
    return {
      version: null,
      lastSyncedAt: null,
      success: null,
      addedCount: 0,
      removedCount: 0,
      error: null,
    };
  }

  return {
    version: last.version,
    lastSyncedAt: last.syncedAt.toISOString(),
    success: last.success,
    addedCount: last.addedCount,
    removedCount: last.removedCount,
    error: last.error,
  };
}

function pairEntryKey(civilian: string, undercover: string): string {
  return `${civilian}\0${undercover}`;
}

export async function syncOfficialPairPacks(db: Database): Promise<PairPackSyncStatus> {
  if (!(await pairPackTablesReady(db))) {
    return {
      version: null,
      lastSyncedAt: null,
      success: null,
      addedCount: 0,
      removedCount: 0,
      error: '词对包表未创建，请运行 pnpm db:migrate',
    };
  }

  const url = process.env.WORD_PAIR_UPDATE_URL;
  let manifest = url ? await fetchManifestFromUrl(url) : null;
  if (!manifest) manifest = loadLocalManifest();

  const [lastSuccess] = await db
    .select()
    .from(pairPackSyncRuns)
    .where(eq(pairPackSyncRuns.success, true))
    .orderBy(desc(pairPackSyncRuns.syncedAt))
    .limit(1);

  if (lastSuccess?.version === manifest.version) {
    return {
      version: manifest.version,
      lastSyncedAt: lastSuccess.syncedAt.toISOString(),
      success: true,
      addedCount: 0,
      removedCount: 0,
      error: null,
    };
  }

  let addedCount = 0;
  let removedCount = 0;

  try {
    for (const cat of manifest.categories) {
      await db
        .insert(pairPackCategories)
        .values({ id: cat.id, name: cat.name, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: pairPackCategories.id,
          set: { name: cat.name, updatedAt: new Date() },
        });

      const [existingPack] = await db
        .select()
        .from(pairPacks)
        .where(and(eq(pairPacks.categoryId, cat.id), isNull(pairPacks.ownerUserId)));

      let packId = existingPack?.id;
      if (!packId) {
        const [created] = await db
          .insert(pairPacks)
          .values({ name: cat.name, categoryId: cat.id, ownerUserId: null })
          .returning();
        packId = created!.id;
      }

      const existingEntries = await db
        .select()
        .from(pairEntries)
        .where(eq(pairEntries.packId, packId));
      const existingKeys = new Set(
        existingEntries.map((e) => pairEntryKey(e.civilianWord, e.undercoverWord)),
      );
      const targetPairs = cat.pairs.map(([a, b]) => [a.trim(), b.trim()] as WordPair).filter(
        ([a, b]) => a && b,
      );
      const targetKeys = new Set(targetPairs.map(([a, b]) => pairEntryKey(a, b)));

      for (const [civilian, undercover] of targetPairs) {
        const key = pairEntryKey(civilian, undercover);
        if (!existingKeys.has(key)) {
          await db.insert(pairEntries).values({ packId, civilianWord: civilian, undercoverWord: undercover });
          addedCount++;
        }
      }

      for (const entry of existingEntries) {
        const key = pairEntryKey(entry.civilianWord, entry.undercoverWord);
        if (!targetKeys.has(key)) {
          await db.delete(pairEntries).where(eq(pairEntries.id, entry.id));
          removedCount++;
        }
      }
    }

    await db.insert(pairPackSyncRuns).values({
      version: manifest.version,
      success: true,
      addedCount,
      removedCount,
      error: null,
    });

    return {
      version: manifest.version,
      lastSyncedAt: new Date().toISOString(),
      success: true,
      addedCount,
      removedCount,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '同步失败';
    await db.insert(pairPackSyncRuns).values({
      version: manifest.version,
      success: false,
      addedCount: 0,
      removedCount: 0,
      error: message,
    });
    return {
      version: manifest.version,
      lastSyncedAt: new Date().toISOString(),
      success: false,
      addedCount: 0,
      removedCount: 0,
      error: message,
    };
  }
}

export function startPairPackSyncScheduler(db: Database) {
  const onStart = process.env.WORD_PAIR_SYNC_ON_START !== 'false';
  const intervalMs = Number(process.env.WORD_PAIR_SYNC_INTERVAL_MS ?? 86_400_000);

  const run = () => {
    syncOfficialPairPacks(db)
      .then((status) => {
        if (status.error?.includes('pnpm db:migrate')) {
          console.warn(`[word-pair-sync] ${status.error}；暂用内置词对库`);
        }
      })
      .catch((err) => {
        console.error('[word-pair-sync]', err);
      });
  };

  if (onStart) run();

  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
