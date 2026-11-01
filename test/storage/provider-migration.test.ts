import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Database } from "../../src/storage/sqlite-driver.js";
import { openSenseiStorage } from "../../src/storage/database.js";
import { STORAGE_MIGRATIONS } from "../../src/storage/schema.js";
import { TURN_FEATURE_STORAGE_MIGRATION } from "../../src/storage/turn-feature-schema.js";
import { WORKFLOW_STORAGE_MIGRATION } from "../../src/storage/workflow-storage-schema.js";
import { createConversationRepository } from "../../src/storage/repositories/conversations.js";
import { migrateSenseiDatabase } from "../../src/storage/migrations.js";

function legacyDatabase() {
	const root = mkdtempSync(join(tmpdir(), "sensei-provider-migration-"));
	const path = join(root, "legacy.sqlite");
	const db = new Database(path);
	for (const m of [
		...STORAGE_MIGRATIONS,
		TURN_FEATURE_STORAGE_MIGRATION,
		WORKFLOW_STORAGE_MIGRATION,
	])
		for (const sql of m.statements) db.exec(sql.replaceAll(", 'copilot'", ""));
	const conversations = createConversationRepository(db);
	const session = {
		provider: "codex" as const,
		sessionId: "legacy",
		identityState: "canonical" as const,
		source: {
			provider: "codex" as const,
			kind: "transcript" as const,
			discoveryPhase: "initial_scan" as const,
			rootPath: "/fixture",
			filePath: "/fixture/session.jsonl",
		},
		completeness: "complete" as const,
		observationReason: "transcript" as const,
	};
	conversations.upsertSession(session);
	conversations.upsertTurn({
		provider: "codex",
		sessionId: "legacy",
		turnId: "turn",
		status: "completed",
		input: { prompt: "Retain this legacy row." },
	});
	conversations.upsertToolEvent({
		provider: "codex",
		sessionId: "legacy",
		turnId: "turn",
		toolCallId: "tool",
		status: "completed",
		outcome: "error",
	});
	return {
		root,
		path,
		db,
		session,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
}

test("provider migration preserves legacy rows, constraints, indexes and foreign keys", () => {
	const f = legacyDatabase();
	try {
		const before = {
			sessions: f.db.query("SELECT * FROM sessions").all(),
			turns: f.db.query("SELECT * FROM turns").all(),
			tools: f.db.query("SELECT * FROM tool_events").all(),
		};
		expect(
			(
				f.db
					.query("SELECT sql FROM sqlite_master WHERE name='sessions'")
					.get() as { sql: string }
			).sql,
		).not.toContain("copilot");
		f.db.close();
		const storage = openSenseiStorage({ databasePath: f.path });
		try {
			expect(storage.database.query("SELECT * FROM sessions").all()).toEqual(
				before.sessions,
			);
			expect(storage.database.query("SELECT * FROM turns").all()).toEqual(
				before.turns,
			);
			expect(storage.database.query("SELECT * FROM tool_events").all()).toEqual(
				before.tools,
			);
			storage.conversations.upsertSession({
				...f.session,
				provider: "copilot",
				source: { ...f.session.source, provider: "copilot" },
			});
			expect(storage.database.query("PRAGMA foreign_key_check").all()).toEqual(
				[],
			);
			expect(storage.database.query("PRAGMA foreign_keys").get()).toEqual({
				foreign_keys: 1,
			});
			expect(() =>
				storage.database.exec(
					"INSERT INTO turns(provider,session_id,turn_id,status,updated_at) VALUES('copilot','missing','t','started','now')",
				),
			).toThrow();
			expect(
				storage.database
					.query(
						"SELECT name FROM sqlite_master WHERE type='index' AND name='turns_session_updated_at_idx'",
					)
					.get(),
			).toEqual({ name: "turns_session_updated_at_idx" });
		} finally {
			storage.close();
		}
	} finally {
		f.cleanup();
	}
});

test("failed migration rolls back rebuilt provider tables and restores foreign-key enforcement", () => {
	const f = legacyDatabase();
	try {
		f.db.exec(
			"PRAGMA foreign_keys=ON; CREATE TABLE evidence_observations (conflict TEXT)",
		);
		const before = f.db
			.query("SELECT name,sql FROM sqlite_master ORDER BY name")
			.all();
		expect(() => migrateSenseiDatabase(f.db)).toThrow();
		expect(
			f.db.query("SELECT name,sql FROM sqlite_master ORDER BY name").all(),
		).toEqual(before);
		expect(f.db.query("PRAGMA foreign_keys").get()).toEqual({
			foreign_keys: 1,
		});
		expect(f.db.query("SELECT count(*) AS n FROM turns").get()).toEqual({
			n: 1,
		});
	} finally {
		f.db.close();
		f.cleanup();
	}
});
