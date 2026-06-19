import { and, desc, eq, isNull, or } from 'drizzle-orm';
import type { Database } from '@game-lobby/db';
import { scriptMurderScripts } from '@game-lobby/db';
import {
  murderScriptContentSchema,
  officialSampleScriptInput,
  validateMurderScriptInput,
  type CreateMurderScriptInput,
  type MurderScriptContent,
  type MurderScriptDetail,
  type MurderScriptSummary,
  type UpdateMurderScriptInput,
} from '@game-lobby/script-murder-scripts';

function rowToSummary(row: typeof scriptMurderScripts.$inferSelect): MurderScriptSummary {
  let content: MurderScriptContent;
  try {
    content = murderScriptContentSchema.parse(JSON.parse(row.contentJson));
  } catch {
    content = { acts: [], characters: [], clues: [] };
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    characterCount: content.characters.length,
    actCount: content.acts.length,
    isOfficial: row.isOfficial,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToDetail(row: typeof scriptMurderScripts.$inferSelect): MurderScriptDetail {
  const content = murderScriptContentSchema.parse(JSON.parse(row.contentJson));
  return { ...rowToSummary(row), content };
}

export async function ensureOfficialScript(db: Database): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(scriptMurderScripts)
      .where(eq(scriptMurderScripts.isOfficial, true))
      .limit(1);
    if (existing.length > 0) return;

    const input = officialSampleScriptInput;
    const validation = validateMurderScriptInput(input);
    if (!validation.ok) return;

    await db.insert(scriptMurderScripts).values({
      title: input.title,
      description: input.description,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      contentJson: JSON.stringify(input.content),
      isOfficial: true,
      ownerUserId: null,
    });
  } catch {
    // table may not exist yet during first boot
  }
}

export async function listUserScripts(
  db: Database,
  userId: string,
): Promise<MurderScriptSummary[]> {
  const rows = await db
    .select()
    .from(scriptMurderScripts)
    .where(eq(scriptMurderScripts.ownerUserId, userId))
    .orderBy(desc(scriptMurderScripts.updatedAt));
  return rows.map(rowToSummary);
}

export async function listOfficialScripts(db: Database): Promise<MurderScriptSummary[]> {
  const rows = await db
    .select()
    .from(scriptMurderScripts)
    .where(eq(scriptMurderScripts.isOfficial, true))
    .orderBy(desc(scriptMurderScripts.updatedAt));
  return rows.map(rowToSummary);
}

export async function getScriptById(
  db: Database,
  scriptId: string,
  userId: string | null,
): Promise<MurderScriptDetail | MurderScriptSummary | null> {
  const rows = await db
    .select()
    .from(scriptMurderScripts)
    .where(eq(scriptMurderScripts.id, scriptId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const isOwner = row.ownerUserId === userId;
  const isPublic = row.isOfficial || row.ownerUserId == null;
  if (isOwner || isPublic) {
    return rowToDetail(row);
  }
  return rowToSummary(row);
}

export async function getScriptForGame(
  db: Database,
  scriptId: string,
  userId: string,
): Promise<MurderScriptDetail | null> {
  const rows = await db
    .select()
    .from(scriptMurderScripts)
    .where(
      and(
        eq(scriptMurderScripts.id, scriptId),
        or(eq(scriptMurderScripts.isOfficial, true), eq(scriptMurderScripts.ownerUserId, userId)),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToDetail(row);
}

export async function createUserScript(
  db: Database,
  userId: string,
  input: CreateMurderScriptInput,
): Promise<MurderScriptDetail | { error: string }> {
  const validation = validateMurderScriptInput(input);
  if (!validation.ok) {
    return { error: validation.errors.join('；') };
  }

  const rows = await db
    .insert(scriptMurderScripts)
    .values({
      ownerUserId: userId,
      title: input.title.trim(),
      description: input.description.trim(),
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      contentJson: JSON.stringify(input.content),
      isOfficial: false,
    })
    .returning();

  return rowToDetail(rows[0]!);
}

export async function updateUserScript(
  db: Database,
  userId: string,
  scriptId: string,
  input: UpdateMurderScriptInput,
): Promise<MurderScriptDetail | null | { error: string }> {
  const validation = validateMurderScriptInput(input);
  if (!validation.ok) {
    return { error: validation.errors.join('；') };
  }

  const rows = await db
    .update(scriptMurderScripts)
    .set({
      title: input.title.trim(),
      description: input.description.trim(),
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      contentJson: JSON.stringify(input.content),
      updatedAt: new Date(),
    })
    .where(
      and(eq(scriptMurderScripts.id, scriptId), eq(scriptMurderScripts.ownerUserId, userId)),
    )
    .returning();

  const row = rows[0];
  if (!row) return null;
  return rowToDetail(row);
}

export async function deleteUserScript(
  db: Database,
  userId: string,
  scriptId: string,
): Promise<boolean> {
  const rows = await db
    .delete(scriptMurderScripts)
    .where(
      and(
        eq(scriptMurderScripts.id, scriptId),
        eq(scriptMurderScripts.ownerUserId, userId),
        eq(scriptMurderScripts.isOfficial, false),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function listPlayableScripts(
  db: Database,
  userId: string,
): Promise<MurderScriptSummary[]> {
  const rows = await db
    .select()
    .from(scriptMurderScripts)
    .where(or(eq(scriptMurderScripts.isOfficial, true), eq(scriptMurderScripts.ownerUserId, userId)))
    .orderBy(desc(scriptMurderScripts.isOfficial), desc(scriptMurderScripts.updatedAt));
  return rows.map(rowToSummary);
}
