import { afterEach, expect, test } from "bun:test";
import type { DiscoveryEvent, ObservedSessionRecord } from "@jasonbelmonti/claudex/ingest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSenseiConfig } from "../../src/config";
import {
  createSenseiPassiveScanRoots,
  runSenseiIngestScanCommand,
  type SenseiPassiveScanResult,
} from "../../src/ingest";
import { openSenseiStorage, type SenseiStorage } from "../../src/storage";

const cleanups: Array<() => void> = [];
const fixtureThreadName = "BEL-718 fixture session";
const fixtureSessionId = "session-1";
type FixtureScanConfig = Pick<ReturnType<typeof createSenseiConfig>, "paths">;

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

test("scan command resolves config, runs the adapter, writes storage, and returns a summary", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const roots = createSenseiPassiveScanRoots(config.paths.providers);
  const scanResult = createScanResult(config.paths.providers.codex);
  const expectedWriteSummary = {
    processedRecords: 1,
    sessionWrites: 1,
    turnWrites: 0,
    turnUsageWrites: 0,
    toolEventWrites: 0,
    cursorWrites: 1,
    warningWrites: 0,
  };

  let didCloseStorage = false;
  const capturedConfigs: Array<Pick<typeof config, "paths">> = [];
  const capturedDatabasePaths: string[] = [];

  const summary = await runSenseiIngestScanCommand(config, {
    createAdapterForConfig(scanConfig) {
      capturedConfigs.push(scanConfig);

      return {
        roots,
        async scanNow() {
          return scanResult;
        },
      };
    },
    openStorage(options) {
      capturedDatabasePaths.push(options.databasePath);

      return {
        transaction(callback) {
          return callback({} as never);
        },
        close() {
          didCloseStorage = true;
        },
      };
    },
    writeResultToStorage(storage, result) {
      expect(result).toBe(scanResult);
      expect(storage).toMatchObject({
        transaction: expect.any(Function),
      });

      return expectedWriteSummary;
    },
  });

  expect(capturedConfigs).toEqual([config]);
  expect(capturedDatabasePaths).toEqual([config.paths.databasePath]);
  expect(didCloseStorage).toBe(true);
  expect(summary).toEqual({
    rootCount: roots.length,
    discoveryEventCount: 1,
    writeSummary: expectedWriteSummary,
  });
});

test("scan command closes storage if the write step fails", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const writeFailure = new Error("write failed");
  let didCloseStorage = false;

  await expect(
    runSenseiIngestScanCommand(config, {
      createAdapterForConfig: createFixtureAdapterForConfig,
      openStorage() {
        return {
          transaction(callback) {
            return callback({} as never);
          },
          close() {
            didCloseStorage = true;
          },
        };
      },
      writeResultToStorage() {
        throw writeFailure;
      },
    }),
  ).rejects.toThrow(writeFailure.message);

  expect(didCloseStorage).toBe(true);
});

test("scan command replay keeps canonical rows stable across repeated executions", async () => {
  const runtimeRoot = mkdtempSync(join(tmpdir(), "sensei-scan-command-"));
  cleanups.push(() => rmSync(runtimeRoot, { recursive: true, force: true }));

  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: runtimeRoot,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });

  await runFixtureScan(config);
  await runFixtureScan(config);

  const storage = openSenseiStorage({
    databasePath: config.paths.databasePath,
  });
  cleanups.push(() => storage.close());

  expect(countRows(storage, "sessions")).toBe(1);
  expect(countRows(storage, "ingest_cursors")).toBe(1);
  expect(storage.conversations.getSession("codex", fixtureSessionId)).toMatchObject({
    provider: "codex",
    sessionId: fixtureSessionId,
    metadata: {
      threadName: fixtureThreadName,
    },
  });
});

async function runFixtureScan(
  config: ReturnType<typeof createSenseiConfig>,
): Promise<void> {
  await runSenseiIngestScanCommand(config, {
    createAdapterForConfig: createFixtureAdapterForConfig,
  });
}

function createFixtureAdapterForConfig(
  config: FixtureScanConfig,
) {
  return {
    roots: createSenseiPassiveScanRoots(config.paths.providers),
    async scanNow() {
      return createScanResult(config.paths.providers.codex);
    },
  };
}

function createScanResult(codexRoot: string): SenseiPassiveScanResult {
  return {
    records: [
      {
        kind: "session",
        observedSession: createObservedSessionRecord(codexRoot),
      },
    ],
    warnings: [],
    discoveryEvents: [createDiscoveryEvent(codexRoot)],
  };
}

function createObservedSessionRecord(codexRoot: string): ObservedSessionRecord {
  return {
    kind: "session",
    observedSession: {
      provider: "codex",
      sessionId: fixtureSessionId,
      state: "provisional",
      metadata: {
        threadName: fixtureThreadName,
      },
    },
    source: {
      provider: "codex",
      kind: "session-index",
      discoveryPhase: "initial_scan",
      rootPath: codexRoot,
      filePath: join(codexRoot, "session-index.jsonl"),
      location: {
        line: 1,
        byteOffset: 90,
      },
    },
    completeness: "best-effort",
    reason: "index",
    cursor: {
      provider: "codex",
      rootPath: codexRoot,
      filePath: join(codexRoot, "session-index.jsonl"),
      byteOffset: 90,
      line: 1,
      metadata: {
        threadName: fixtureThreadName,
      },
    },
  };
}

function createDiscoveryEvent(codexRoot: string): DiscoveryEvent {
  return {
    type: "scan.completed",
    provider: "codex",
    rootPath: codexRoot,
    discoveryPhase: "initial_scan",
  };
}

function countRows(storage: SenseiStorage, table: string): number {
  const row = storage.database
    .query(`SELECT COUNT(*) as count FROM ${table}`)
    .get() as { count: number };

  return row.count;
}
