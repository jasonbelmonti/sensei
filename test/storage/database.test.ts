import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { openSenseiStorage, STORAGE_MIGRATIONS } from "../../src/storage";
import { createStorageTestHarness } from "./helpers";
import {
	createWorkflowFamiliesInput,
	createWorkflowSearchDocumentInput,
	seedWorkflowStorageFixture,
} from "./workflow-storage-fixture";

const cleanups: Array<() => void> = [];
const WORKFLOW_STORAGE_TABLES = [
	"turn_search_documents",
	"turn_search_documents_fts",
	"workflow_families",
	"workflow_family_members",
] as const;
const STORAGE_TABLES = [
	"_sensei_migrations",
	"ingest_cursors",
	"ingest_warnings",
	"sessions",
	"turn_features",
	"tool_events",
	"turn_usage",
	"turns",
	...WORKFLOW_STORAGE_TABLES,
] as const;
const EXPECTED_MIGRATION_IDS = [
	"0001_canonical_storage",
	"0002_turn_features",
	"0003_workflow_storage",
] as const;

afterEach(() => {
	while (cleanups.length > 0) {
		cleanups.pop()?.();
	}
});

test("storage bootstrap creates the configured sqlite database and canonical tables", () => {
	const harness = createStorageTestHarness("sensei-storage-bootstrap");
	cleanups.push(harness.cleanup);

	expect(existsSync(harness.databasePath)).toBe(true);

	const tables = harness.storage.database
		.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `)
		.all() as Array<{ name: string }>;

	expect(tables.map((table) => table.name)).toEqual(
		expect.arrayContaining([...STORAGE_TABLES]),
	);
	expectWorkflowStorageRepositoriesEmpty(harness.storage);
});

test("storage bootstrap can be invoked repeatedly without duplicating migrations", () => {
	const harness = createStorageTestHarness("sensei-storage-repeatable");
	cleanups.push(harness.cleanup);

	const initialMigrations = [...harness.storage.migrations];
	harness.storage.close();

	const reopenedStorage = openSenseiStorage({
		databasePath: harness.databasePath,
	});
	cleanups.push(() => reopenedStorage.close());

	const migrationRows = reopenedStorage.database
		.query(`
      SELECT id
      FROM _sensei_migrations
      ORDER BY id
    `)
		.all() as Array<{ id: string }>;

	expect(initialMigrations).toEqual(
		EXPECTED_MIGRATION_IDS.map((id) => ({
			id,
			appliedAt: expect.any(String),
		})),
	);
	expect(reopenedStorage.migrations).toHaveLength(
		EXPECTED_MIGRATION_IDS.length,
	);
	expect(migrationRows).toEqual(EXPECTED_MIGRATION_IDS.map((id) => ({ id })));
});

test("workflow storage surfaces persist version-scoped search documents and family outputs", () => {
	const harness = createStorageTestHarness("sensei-storage-workflow-storage");
	cleanups.push(harness.cleanup);

	seedWorkflowStorageFixture(harness.storage);

	harness.storage.workflowSearch.replaceFeatureVersion(1, [
		createWorkflowSearchDocumentInput(1),
	]);
	harness.storage.workflowSearch.replaceFeatureVersion(2, [
		createWorkflowSearchDocumentInput(2),
	]);
	harness.storage.workflowSearch.replaceFeatureVersion(1, [
		createWorkflowSearchDocumentInput(1),
	]);

	expect(harness.storage.workflowSearch.listAll()).toEqual([
		expect.objectContaining({
			featureVersion: 1,
			exactFingerprint: "exact-v1-stable",
			tags: ["storage", "bel-805", "stable"],
		}),
		expect.objectContaining({
			featureVersion: 2,
			exactFingerprint: "exact-v2",
			tags: ["storage", "bel-805", "refresh"],
		}),
	]);
	expect(
		harness.storage.database
			.query(`
        SELECT count(*) as count
        FROM turn_search_documents_fts
      `)
			.get(),
	).toEqual({ count: 2 });

	harness.storage.workflowFamilies.replaceFeatureVersion(
		1,
		createWorkflowFamiliesInput(1),
	);
	harness.storage.workflowFamilies.replaceFeatureVersion(
		2,
		createWorkflowFamiliesInput(2),
	);
	harness.storage.workflowFamilies.replaceFeatureVersion(
		1,
		createWorkflowFamiliesInput(1),
	);

	expect(harness.storage.workflowFamilies.listAll()).toEqual([
		expect.objectContaining({
			featureVersion: 1,
			familyId: "family-stable",
			evidence: {
				reason: "stable prompt family rerun",
			},
		}),
		expect.objectContaining({
			featureVersion: 2,
			familyId: "family-refreshed",
			evidence: {
				reason: "refreshed prompt family",
			},
		}),
	]);
	expect(harness.storage.workflowFamilies.listMembers()).toEqual([
		expect.objectContaining({
			featureVersion: 1,
			familyId: "family-stable",
			turnId: "turn-001",
			evidence: {
				match: "exact-rerun",
			},
		}),
		expect.objectContaining({
			featureVersion: 2,
			familyId: "family-refreshed",
			turnId: "turn-001",
			evidence: {
				match: "near",
			},
		}),
	]);
});

test("fresh bootstrap tolerates concurrent storage opens", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "sensei-storage-concurrent-"));
	const databasePath = join(rootDir, "sensei.sqlite");
	cleanups.push(() => rmSync(rootDir, { recursive: true, force: true }));

	const storageModulePath = fileURLToPath(
		new URL("../../src/storage/index.ts", import.meta.url),
	);
	const openScript = `
    import { openSenseiStorage } from ${JSON.stringify(storageModulePath)};
    const databasePath = Bun.argv[Bun.argv.length - 1];
    const storage = openSenseiStorage({ databasePath });
    await Bun.sleep(100);
    storage.close();
    console.log("ok");
  `;

	const firstProcess = Bun.spawn(["bun", "-e", openScript, databasePath], {
		stderr: "pipe",
		stdout: "pipe",
	});
	const secondProcess = Bun.spawn(["bun", "-e", openScript, databasePath], {
		stderr: "pipe",
		stdout: "pipe",
	});

	const [firstExitCode, secondExitCode, firstError, secondError] =
		await Promise.all([
			firstProcess.exited,
			secondProcess.exited,
			new Response(firstProcess.stderr).text(),
			new Response(secondProcess.stderr).text(),
		]);

	expect({
		firstExitCode,
		secondExitCode,
		firstError,
		secondError,
	}).toEqual({
		firstExitCode: 0,
		secondExitCode: 0,
		firstError: "",
		secondError: "",
	});
});

test("readonly opens tolerate legacy databases without turn_features", () => {
	const databasePath = createLegacyCanonicalDatabasePath(
		"sensei-storage-readonly-legacy-",
	);

	const storage = openSenseiStorage({
		databasePath,
		readonly: true,
	});
	cleanups.push(() => storage.close());

	expect(storage.migrations).toEqual([]);
	expect(storage.turnFeatures.listAll()).toEqual([]);
	expectWorkflowStorageRepositoriesEmpty(storage);
	expect(
		listTables(storage.database, "turn_features", ...WORKFLOW_STORAGE_TABLES),
	).toEqual([]);
});

test("writable opens upgrade legacy databases without replaying canonical storage", () => {
	const databasePath = createLegacyCanonicalDatabasePath(
		"sensei-storage-writable-legacy-",
	);

	const storage = openSenseiStorage({
		databasePath,
	});
	cleanups.push(() => storage.close());

	expect(storage.migrations).toEqual(
		EXPECTED_MIGRATION_IDS.map((id) => ({
			id,
			appliedAt: expect.any(String),
		})),
	);
	expect(storage.turnFeatures.listAll()).toEqual([]);
	expectWorkflowStorageRepositoriesEmpty(storage);
	expect(loadMigrationRows(storage.database)).toEqual(
		EXPECTED_MIGRATION_IDS.map((id) => ({ id })),
	);
	expect(
		listTables(storage.database, "turn_features", ...WORKFLOW_STORAGE_TABLES),
	).toEqual([
		{ name: "turn_features" },
		...WORKFLOW_STORAGE_TABLES.map((name) => ({ name })),
	]);
});

function createLegacyCanonicalDatabasePath(prefix: string): string {
	const rootDir = mkdtempSync(join(tmpdir(), prefix));
	const databasePath = join(rootDir, "sensei.sqlite");
	cleanups.push(() => rmSync(rootDir, { recursive: true, force: true }));

	const legacyDatabase = new Database(databasePath);

	try {
		for (const statement of STORAGE_MIGRATIONS[0].statements) {
			legacyDatabase.exec(statement);
		}
	} finally {
		legacyDatabase.close();
	}

	return databasePath;
}

function expectWorkflowStorageRepositoriesEmpty(
	storage: ReturnType<typeof openSenseiStorage>,
): void {
	expect(storage.workflowSearch.listAll()).toEqual([]);
	expect(storage.workflowFamilies.listAll()).toEqual([]);
	expect(storage.workflowFamilies.listMembers()).toEqual([]);
}

function loadMigrationRows(
	database: ReturnType<typeof openSenseiStorage>["database"],
) {
	return database
		.query(`
      SELECT id
      FROM _sensei_migrations
      ORDER BY id
    `)
		.all();
}

function listTables(
	database: ReturnType<typeof openSenseiStorage>["database"],
	...tableNames: readonly string[]
) {
	const placeholders = tableNames.map(() => "?").join(", ");

	return database
		.query(
			`
				SELECT name
				FROM sqlite_master
				WHERE type = 'table'
					AND name IN (${placeholders})
				ORDER BY name
			`,
		)
		.all(...tableNames);
}
