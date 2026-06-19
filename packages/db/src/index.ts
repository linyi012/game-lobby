import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export * from './schema.js';

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDb>['db'];

// Test/e2e database backed by an in-memory PGlite instance. PGlite and its
// drizzle adapter are imported lazily so they stay out of the production path.
// Returns the same { db, pool } shape as createDb so callers can stay agnostic;
// pool.end() closes the underlying client.
export async function createPgliteDb(): Promise<{
  db: Database;
  pool: { end: () => Promise<void> };
}> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { createHash } = await import('node:crypto');
  const { readFileSync } = await import('node:fs');

  const client = new PGlite();
  const db = drizzlePglite(client, { schema });

  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, '..', 'drizzle');

  // PGlite cannot run multi-statement SQL via prepared queries (drizzle's default
  // pglite migrator path). Use exec() per migration file instead.
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const applied = await client.query<{ hash: string }>(
    'SELECT hash FROM "__drizzle_migrations" ORDER BY created_at',
  );
  const appliedHashes = new Set(applied.rows.map((row) => row.hash));

  const journalPath = resolve(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { tag: string; when: number }[];
  };

  for (const entry of journal.entries) {
    const sqlPath = resolve(migrationsFolder, `${entry.tag}.sql`);
    const sql = readFileSync(sqlPath, 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    if (appliedHashes.has(hash)) continue;
    await client.exec(sql);
    await client.query(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
      [hash, entry.when],
    );
  }

  return {
    db: db as unknown as Database,
    pool: { end: () => client.close() },
  };
}
