import type { Database } from "bun:sqlite";

import { STORAGE_MIGRATIONS } from "./schema";
import { TURN_FEATURE_STORAGE_MIGRATION } from "./turn-feature-schema";
import { WORKFLOW_STORAGE_MIGRATION } from "./workflow-storage-schema";

export type StorageMigrationRecord = {
	id: string;
	appliedAt: string;
};

const ALL_STORAGE_MIGRATIONS = [
	...STORAGE_MIGRATIONS,
	TURN_FEATURE_STORAGE_MIGRATION,
	WORKFLOW_STORAGE_MIGRATION,
] as const;

const LEGACY_MIGRATION_FOOTPRINTS = {
	"0001_canonical_storage": {
		tables: [
			"sessions",
			"turns",
			"turn_usage",
			"tool_events",
			"ingest_cursors",
			"ingest_warnings",
		],
		indexes: [
			"sessions_source_file_path_idx",
			"turns_session_updated_at_idx",
			"tool_events_turn_updated_at_idx",
			"ingest_warnings_detected_at_idx",
			"ingest_warnings_provider_file_idx",
		],
		triggers: [],
	},
	"0002_turn_features": {
		tables: ["turn_features"],
		indexes: [
			"turn_features_session_version_turn_sequence_idx",
			"turn_features_provider_version_status_idx",
		],
		triggers: [],
	},
	"0003_workflow_storage": {
		tables: [
			"turn_search_documents",
			"turn_search_documents_fts",
			"workflow_families",
			"workflow_family_members",
		],
		indexes: [
			"turn_search_documents_feature_version_idx",
			"turn_search_documents_exact_fingerprint_idx",
			"turn_search_documents_near_fingerprint_idx",
			"workflow_families_family_id_idx",
			"workflow_family_members_turn_key_idx",
		],
		triggers: [
			"turn_search_documents_ai",
			"turn_search_documents_ad",
			"turn_search_documents_au",
		],
	},
} as const satisfies Record<
	(typeof ALL_STORAGE_MIGRATIONS)[number]["id"],
	{
		tables: readonly string[];
		indexes: readonly string[];
		triggers: readonly string[];
	}
>;

export function migrateSenseiDatabase(
	database: Database,
): StorageMigrationRecord[] {
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

		bootstrapLegacyMigrationHistory(database);

		const appliedMigrationIds = new Set(loadAppliedMigrationIds(database));

		for (const migration of ALL_STORAGE_MIGRATIONS) {
			if (appliedMigrationIds.has(migration.id)) {
				continue;
			}

			const appliedAt = new Date().toISOString();

			for (const statement of migration.statements) {
				database.exec(statement);
			}

			recordAppliedMigration(database, migration.id, appliedAt);

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

	return database
		.query(
			`
      SELECT
        id,
        applied_at as appliedAt
      FROM _sensei_migrations
      ORDER BY id
    `,
		)
		.all() as StorageMigrationRecord[];
}

function loadAppliedMigrationIds(database: Database): string[] {
	return database
		.query("SELECT id FROM _sensei_migrations ORDER BY id")
		.all()
		.map((row) => (row as { id: string }).id);
}

function bootstrapLegacyMigrationHistory(database: Database): void {
	if (loadAppliedMigrationIds(database).length > 0) {
		return;
	}

	for (const migration of ALL_STORAGE_MIGRATIONS) {
		if (
			!hasSchemaFootprint(database, LEGACY_MIGRATION_FOOTPRINTS[migration.id])
		) {
			continue;
		}

		recordAppliedMigration(database, migration.id, new Date().toISOString());
	}
}

function hasSchemaFootprint(
	database: Database,
	footprint: {
		tables: readonly string[];
		indexes: readonly string[];
		triggers: readonly string[];
	},
): boolean {
	return (
		footprint.tables.every((tableName) =>
			hasSchemaObject(database, "table", tableName),
		) &&
		footprint.indexes.every((indexName) =>
			hasSchemaObject(database, "index", indexName),
		) &&
		footprint.triggers.every((triggerName) =>
			hasSchemaObject(database, "trigger", triggerName),
		)
	);
}

function hasSchemaObject(
	database: Database,
	type: "table" | "index" | "trigger",
	name: string,
): boolean {
	const row = database
		.query(
			`
				SELECT 1 as found
				FROM sqlite_master
				WHERE type = ? AND name = ?
			`,
		)
		.get(type, name) as { found: number } | null;

	return row?.found === 1;
}

function recordAppliedMigration(
	database: Database,
	id: string,
	appliedAt: string,
): void {
	database
		.query(
			`
				INSERT INTO _sensei_migrations (id, applied_at)
				VALUES (?, ?)
			`,
		)
		.run(id, appliedAt);
}
