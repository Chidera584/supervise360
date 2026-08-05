import { Pool } from 'mysql2/promise';

export interface Migration {
  id: string;
  description: string;
  up: (db: Pool) => Promise<void>;
}

async function ensureMigrationsTable(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      description VARCHAR(500) NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

async function getAppliedMigrationIds(db: Pool): Promise<Set<string>> {
  const [rows] = await db.execute('SELECT id FROM schema_migrations');
  return new Set((rows as { id: string }[]).map((r) => r.id));
}

/**
 * Runs all pending migrations, in the order given, tracked in `schema_migrations` so each one
 * runs exactly once. Throws on the first failure rather than logging a warning and continuing -
 * a partially-applied schema should abort startup (or the deploy, via `npm run db:migrate`), not
 * silently serve 500s for whatever depended on the column/table that never got created. That
 * exact failure mode (see commit history: `ensureSupervisionMeetingsColumns` had to be added as
 * a "redundant ensure" after a partial `ensureFeatureExpansionSchema` failure reached production)
 * is what this replaces.
 */
export async function runMigrations(
  db: Pool,
  migrations: Migration[]
): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  await ensureMigrationsTable(db);
  const applied = await getAppliedMigrationIds(db);
  const newlyApplied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      alreadyApplied.push(migration.id);
      continue;
    }
    console.log(`⏳ Running migration: ${migration.id} - ${migration.description}`);
    try {
      await migration.up(db);
      await db.execute('INSERT INTO schema_migrations (id, description) VALUES (?, ?)', [
        migration.id,
        migration.description,
      ]);
      newlyApplied.push(migration.id);
      console.log(`✅ Migration applied: ${migration.id}`);
    } catch (err) {
      console.error(`❌ Migration FAILED: ${migration.id} - ${migration.description}`);
      throw new Error(
        `Migration "${migration.id}" failed: ${(err as Error).message}. ` +
          'Startup aborted - fix the migration (or the data blocking it) and redeploy. ' +
          `Migrations already applied before this one are unaffected: [${newlyApplied.join(', ') || 'none this run'}].`
      );
    }
  }

  if (newlyApplied.length === 0) {
    console.log(`✅ Schema up to date (${alreadyApplied.length} migration(s) already applied, none pending)`);
  } else {
    console.log(`✅ Applied ${newlyApplied.length} migration(s): ${newlyApplied.join(', ')}`);
  }

  return { applied: newlyApplied, alreadyApplied };
}
