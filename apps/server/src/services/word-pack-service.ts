import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Database } from '@game-lobby/db';
import {
  wordEntries,
  wordPackCategories,
  wordPackSyncRuns,
  wordPacks,
} from '@game-lobby/db';
import {
  buildWordPoolFromBuiltin,
  loadBuiltinManifest,
  mergeWordPool,
  type WordPackManifest,
  type WordPackSyncStatus,
  wordPackManifestSchema,
} from '@game-lobby/word-packs';
import { readFileSync } from 'node:fs';
import { getManifestPath } from '@game-lobby/word-packs';

export interface ResolveWordPoolInput {
  categoryIds: string[];
  userPackIds: string[];
  roomExtraWords: string[];
}

function isMissingRelationError(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    (err as { cause?: { code?: string } })?.cause?.code;
  return code === '42P01';
}

async function wordPackTablesReady(db: Database): Promise<boolean> {
  try {
    await db.select().from(wordPackSyncRuns).limit(1);
    return true;
  } catch (err) {
    if (isMissingRelationError(err)) return false;
    throw err;
  }
}

export async function resolveWordPool(db: Database, input: ResolveWordPoolInput): Promise<string[]> {
  const { categoryIds, userPackIds, roomExtraWords } = input;

  let manifest: WordPackManifest;
  try {
    const cats = await db.select().from(wordPackCategories);
    if (cats.length === 0) {
      manifest = loadBuiltinManifest();
    } else {
      const officialPacks = await db
        .select()
        .from(wordPacks)
        .where(isNull(wordPacks.ownerUserId));
      const packIds = officialPacks.map((p) => p.id);
      const entries =
        packIds.length > 0
          ? await db.select().from(wordEntries).where(inArray(wordEntries.packId, packIds))
          : [];

      const categories = cats.map((cat) => {
        const pack = officialPacks.find((p) => p.categoryId === cat.id);
        const words = pack
          ? entries.filter((e) => e.packId === pack.id).map((e) => e.word)
          : [];
        return { id: cat.id, name: cat.name, words };
      });

      manifest = wordPackManifestSchema.parse({
        version: 'db',
        categories: categories.filter((c) => c.words.length > 0),
      });

      if (manifest.categories.length === 0) {
        manifest = loadBuiltinManifest();
      }
    }
  } catch {
    manifest = loadBuiltinManifest();
  }

  let userPacks: { id: string; words: string[] }[] = [];
  if (userPackIds.length > 0) {
    const packs = await db
      .select()
      .from(wordPacks)
      .where(and(inArray(wordPacks.id, userPackIds), isNotNull(wordPacks.ownerUserId)));
    const ids = packs.map((p) => p.id);
    const entries =
      ids.length > 0
        ? await db.select().from(wordEntries).where(inArray(wordEntries.packId, ids))
        : [];
    userPacks = packs.map((p) => ({
      id: p.id,
      words: entries.filter((e) => e.packId === p.id).map((e) => e.word),
    }));
  }

  const fromDb = mergeWordPool({
    categoryIds,
    userPackIds,
    userPacks,
    roomExtraWords,
    manifest,
  });

  if (fromDb.length > 0) return fromDb;

  return buildWordPoolFromBuiltin({
    categoryIds: categoryIds.length > 0 ? categoryIds : loadBuiltinManifest().categories.map((c) => c.id),
    userPackIds,
    userPacks,
    roomExtraWords,
  });
}

export async function listCategories(db: Database) {
  const rows = await db.select().from(wordPackCategories);
  if (rows.length === 0) {
    return loadBuiltinManifest().categories.map((c) => ({
      id: c.id,
      name: c.name,
      wordCount: c.words.length,
    }));
  }

  const officialPacks = await db.select().from(wordPacks).where(isNull(wordPacks.ownerUserId));
  const packIds = officialPacks.map((p) => p.id);
  const entries =
    packIds.length > 0
      ? await db.select().from(wordEntries).where(inArray(wordEntries.packId, packIds))
      : [];

  return rows.map((cat) => {
    const pack = officialPacks.find((p) => p.categoryId === cat.id);
    const count = pack ? entries.filter((e) => e.packId === pack.id).length : 0;
    return { id: cat.id, name: cat.name, wordCount: count };
  });
}

export async function listUserPacks(db: Database, userId: string) {
  const packs = await db.select().from(wordPacks).where(eq(wordPacks.ownerUserId, userId));
  const ids = packs.map((p) => p.id);
  const entries =
    ids.length > 0
      ? await db.select().from(wordEntries).where(inArray(wordEntries.packId, ids))
      : [];

  return packs.map((p) => ({
    id: p.id,
    name: p.name,
    words: entries.filter((e) => e.packId === p.id).map((e) => e.word),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function createUserPack(db: Database, userId: string, name: string, words: string[]) {
  const unique = [...new Set(words.map((w) => w.trim()).filter(Boolean))];
  const [pack] = await db
    .insert(wordPacks)
    .values({ ownerUserId: userId, name, categoryId: null })
    .returning();
  if (unique.length > 0) {
    await db.insert(wordEntries).values(unique.map((word) => ({ packId: pack!.id, word })));
  }
  return {
    id: pack!.id,
    name: pack!.name,
    words: unique,
    createdAt: pack!.createdAt.toISOString(),
    updatedAt: pack!.updatedAt.toISOString(),
  };
}

export async function updateUserPack(
  db: Database,
  userId: string,
  packId: string,
  name: string,
  words: string[],
) {
  const [pack] = await db.select().from(wordPacks).where(eq(wordPacks.id, packId));
  if (!pack || pack.ownerUserId !== userId) return null;

  const unique = [...new Set(words.map((w) => w.trim()).filter(Boolean))];
  await db.update(wordPacks).set({ name, updatedAt: new Date() }).where(eq(wordPacks.id, packId));
  await db.delete(wordEntries).where(eq(wordEntries.packId, packId));
  if (unique.length > 0) {
    await db.insert(wordEntries).values(unique.map((word) => ({ packId, word })));
  }

  const [updated] = await db.select().from(wordPacks).where(eq(wordPacks.id, packId));
  return {
    id: packId,
    name,
    words: unique,
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
  };
}

export async function deleteUserPack(db: Database, userId: string, packId: string) {
  const [pack] = await db.select().from(wordPacks).where(eq(wordPacks.id, packId));
  if (!pack || pack.ownerUserId !== userId) return false;
  await db.delete(wordPacks).where(eq(wordPacks.id, packId));
  return true;
}

async function fetchManifestFromUrl(url: string): Promise<WordPackManifest | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const json = await res.json();
    return wordPackManifestSchema.parse(json);
  } catch {
    return null;
  }
}

function loadLocalManifest(): WordPackManifest {
  const raw = readFileSync(getManifestPath(), 'utf-8');
  return wordPackManifestSchema.parse(JSON.parse(raw));
}

export async function getSyncStatus(db: Database): Promise<WordPackSyncStatus> {
  if (!(await wordPackTablesReady(db))) {
    return {
      version: null,
      lastSyncedAt: null,
      success: null,
      addedCount: 0,
      removedCount: 0,
      error: '词语包表未创建，请运行 pnpm db:migrate',
    };
  }

  const [last] = await db
    .select()
    .from(wordPackSyncRuns)
    .orderBy(desc(wordPackSyncRuns.syncedAt))
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

export async function syncOfficialWordPacks(db: Database): Promise<WordPackSyncStatus> {
  if (!(await wordPackTablesReady(db))) {
    return {
      version: null,
      lastSyncedAt: null,
      success: null,
      addedCount: 0,
      removedCount: 0,
      error: '词语包表未创建，请运行 pnpm db:migrate',
    };
  }

  const url = process.env.WORD_PACK_UPDATE_URL;
  let manifest = url ? await fetchManifestFromUrl(url) : null;
  if (!manifest) manifest = loadLocalManifest();

  const [lastSuccess] = await db
    .select()
    .from(wordPackSyncRuns)
    .where(eq(wordPackSyncRuns.success, true))
    .orderBy(desc(wordPackSyncRuns.syncedAt))
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
        .insert(wordPackCategories)
        .values({ id: cat.id, name: cat.name, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: wordPackCategories.id,
          set: { name: cat.name, updatedAt: new Date() },
        });

      const [existingPack] = await db
        .select()
        .from(wordPacks)
        .where(and(eq(wordPacks.categoryId, cat.id), isNull(wordPacks.ownerUserId)));

      let packId = existingPack?.id;
      if (!packId) {
        const [created] = await db
          .insert(wordPacks)
          .values({ name: cat.name, categoryId: cat.id, ownerUserId: null })
          .returning();
        packId = created!.id;
      }

      const existingEntries = await db
        .select()
        .from(wordEntries)
        .where(eq(wordEntries.packId, packId));
      const existingWords = new Set(existingEntries.map((e) => e.word));
      const targetWords = new Set(cat.words.map((w) => w.trim()).filter(Boolean));

      for (const word of targetWords) {
        if (!existingWords.has(word)) {
          await db.insert(wordEntries).values({ packId, word });
          addedCount++;
        }
      }

      for (const entry of existingEntries) {
        if (!targetWords.has(entry.word)) {
          await db.delete(wordEntries).where(eq(wordEntries.id, entry.id));
          removedCount++;
        }
      }
    }

    await db.insert(wordPackSyncRuns).values({
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
    await db.insert(wordPackSyncRuns).values({
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

export function startWordPackSyncScheduler(db: Database) {
  const onStart = process.env.WORD_PACK_SYNC_ON_START !== 'false';
  const intervalMs = Number(process.env.WORD_PACK_SYNC_INTERVAL_MS ?? 86_400_000);

  const run = () => {
    syncOfficialWordPacks(db)
      .then((status) => {
        if (status.error?.includes('pnpm db:migrate')) {
          console.warn(`[word-pack-sync] ${status.error}；暂用内置词库`);
        }
      })
      .catch((err) => {
        console.error('[word-pack-sync]', err);
      });
  };

  if (onStart) run();

  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
