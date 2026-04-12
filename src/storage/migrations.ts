import type { Database } from "bun:sqlite";

import { STORAGE_MIGRATIONS } from "./schema";

export type StorageMigrationRecord = {
  id: string;
  appliedAt: string;
};

export function migrateSenseiDatabase(database: Database): StorageMigrationRecord[] {
  let transactionStarted = false;

  try {
    database.exec("BEGIN IMMEDIATE;");
    transactionStarted = true;

    database.exec(`
      CREATE TABLE IF NOT EXISTS _sensei_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedMigrationIds = new Set(loadAppliedMigrationIds(database));

    for (const migration of STORAGE_MIGRATIONS) {
      if (appliedMigrationIds.has(migration.id)) {
        continue;
      }

      const appliedAt = new Date().toISOString();

      for (const statement of migration.statements) {
        database.exec(statement);
      }

      database
        .query(
          `
            INSERT INTO _sensei_migrations (id, applied_at)
            VALUES (?, ?)
          `,
        )
        .run(migration.id, appliedAt);

      appliedMigrationIds.add(migration.id);
    }

    database.exec("COMMIT;");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      database.exec("ROLLBACK;");
    }

    throw error;
  }

  return database.query(
    `
      SELECT
        id,
        applied_at as appliedAt
      FROM _sensei_migrations
      ORDER BY id
    `,
  ).all() as StorageMigrationRecord[];
}

function loadAppliedMigrationIds(database: Database): string[] {
  return database
    .query("SELECT id FROM _sensei_migrations ORDER BY id")
    .all()
    .map((row) => (row as { id: string }).id);
}
