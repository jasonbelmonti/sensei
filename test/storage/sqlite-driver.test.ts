import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

import { Database } from "../../src/storage/sqlite-driver.js";
import { createStorageTestHarness } from "./helpers.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length > 0) cleanups.pop()?.();
});

test("SQLite missing rows return null while writes retain RETURNING values", () => {
	const database = new Database(":memory:");
	cleanups.push(() => database.close());
	database.exec(
		"CREATE TABLE entries (id TEXT PRIMARY KEY, value TEXT NOT NULL)",
	);
	expect(
		database.query("SELECT * FROM entries WHERE id = ?").get("missing"),
	).toBeNull();
	expect(
		database
			.query("INSERT INTO entries VALUES (?, ?) RETURNING value")
			.get("a", "first"),
	).toEqual({ value: "first" });
	expect(
		database
			.query(
				"INSERT INTO entries VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value RETURNING value",
			)
			.get("a", "updated"),
	).toEqual({ value: "updated" });
});

test("readonly and no-create opens reject absent files without creating them", () => {
	const root = mkdtempSync(join(tmpdir(), "sensei-no-create-"));
	cleanups.push(() => rmSync(root, { recursive: true, force: true }));
	for (const options of [{ readonly: true }, { create: false }]) {
		const path = join(root, "missing.sqlite");
		expect(() => new Database(path, options)).toThrow();
		expect(existsSync(path)).toBe(false);
	}
});

test("readonly storage rejects writes and preserves the database bytes", () => {
	const harness = createStorageTestHarness("sensei-readonly-driver");
	cleanups.push(harness.cleanup);
	harness.storage.close();
	const before = readFileSync(harness.databasePath);
	const database = new Database(harness.databasePath, { readonly: true });
	try {
		expect(
			database.query("SELECT count(*) AS count FROM _sensei_migrations").get(),
		).toEqual({ count: 3 });
		expect(() =>
			database.exec("CREATE TABLE forbidden (id INTEGER)"),
		).toThrow();
	} finally {
		database.close();
	}
	expect(readFileSync(harness.databasePath)).toEqual(before);
});

test("nested transaction failure rolls back its writes while the outer transaction commits", () => {
	const harness = createStorageTestHarness("sensei-nested-rollback");
	cleanups.push(harness.cleanup);
	const { database } = harness.storage;
	database.exec("CREATE TABLE entries (id TEXT PRIMARY KEY)");
	harness.storage.transaction(() => {
		database.query("INSERT INTO entries VALUES (?)").run("before");
		expect(() =>
			harness.storage.transaction(() => {
				database.query("INSERT INTO entries VALUES (?)").run("inner");
				throw new Error("rollback inner");
			}),
		).toThrow("rollback inner");
		database.query("INSERT INTO entries VALUES (?)").run("after");
	});
	expect(database.query("SELECT id FROM entries ORDER BY id").all()).toEqual([
		{ id: "after" },
		{ id: "before" },
	]);
});

test("outer transaction failure rolls back successful nested writes", () => {
	const harness = createStorageTestHarness("sensei-outer-rollback");
	cleanups.push(harness.cleanup);
	const { database } = harness.storage;
	database.exec("CREATE TABLE entries (id TEXT PRIMARY KEY)");
	expect(() =>
		harness.storage.transaction(() => {
			database.query("INSERT INTO entries VALUES (?)").run("outer");
			harness.storage.transaction(() => {
				database.query("INSERT INTO entries VALUES (?)").run("inner");
			});
			throw new Error("rollback outer");
		}),
	).toThrow("rollback outer");
	expect(database.query("SELECT * FROM entries").all()).toEqual([]);
});
