import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { openSenseiStorage } from "../../src/storage";
import { createStorageTestHarness } from "./helpers";

const cleanups: Array<() => void> = [];

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
    expect.arrayContaining([
      "_sensei_migrations",
      "ingest_cursors",
      "ingest_warnings",
      "sessions",
      "tool_events",
      "turn_usage",
      "turns",
    ]),
  );
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

  expect(initialMigrations).toEqual([
    {
      id: "0001_canonical_storage",
      appliedAt: expect.any(String),
    },
  ]);
  expect(reopenedStorage.migrations).toHaveLength(1);
  expect(migrationRows).toEqual([{ id: "0001_canonical_storage" }]);
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

  const [firstExitCode, secondExitCode, firstError, secondError] = await Promise.all([
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
