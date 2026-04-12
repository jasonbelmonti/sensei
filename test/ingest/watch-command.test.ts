import { expect, test } from "bun:test";

import { createSenseiConfig } from "../../src/config";
import { runSenseiIngestWatchCommand } from "../../src/ingest";

test("watch command starts the watch seam, waits for shutdown, and closes storage", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const roots = [
    {
      provider: "claude" as const,
      path: "/Users/test/.claude",
      recursive: true,
      watch: true,
    },
    {
      provider: "codex" as const,
      path: "/Users/test/.codex",
      recursive: true,
      watch: true,
    },
  ];
  const startedSummaries: unknown[] = [];
  const capturedDatabasePaths: string[] = [];
  let resolveShutdown!: () => void;
  const shutdownPromise = new Promise<void>((resolve) => {
    resolveShutdown = resolve;
  });
  let startCalls = 0;
  let stopCalls = 0;
  let closeCalls = 0;

  const summary = await runSenseiIngestWatchCommand(config, {
    openStorage(options) {
      capturedDatabasePaths.push(options.databasePath);

      return {
        transaction(callback) {
          return callback({} as never);
        },
        ingestState: {} as never,
        close() {
          closeCalls += 1;
        },
      };
    },
    createWatch() {
      return {
        roots,
        async start() {
          startCalls += 1;
        },
        async reconcileNow() {},
        async stop() {
          stopCalls += 1;
        },
      };
    },
    waitForShutdownSignal() {
      return shutdownPromise;
    },
    onStarted(startedSummary) {
      startedSummaries.push(startedSummary);
      resolveShutdown();
    },
  });

  expect(capturedDatabasePaths).toEqual([config.paths.databasePath]);
  expect(startCalls).toBe(1);
  expect(stopCalls).toBe(1);
  expect(closeCalls).toBe(1);
  expect(startedSummaries).toEqual([
    {
      rootCount: 2,
      watchIntervalMs: config.ingest.watchIntervalMs,
      status: "running",
    },
  ]);
  expect(summary).toEqual({
    rootCount: 2,
    watchIntervalMs: config.ingest.watchIntervalMs,
    status: "running",
  });
});

test("watch command stops and closes storage if shutdown waiting fails", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const shutdownFailure = new Error("shutdown wait failed");
  let startCalls = 0;
  let stopCalls = 0;
  let closeCalls = 0;

  await expect(
    runSenseiIngestWatchCommand(config, {
      openStorage() {
        return {
          transaction(callback) {
            return callback({} as never);
          },
          ingestState: {} as never,
          close() {
            closeCalls += 1;
          },
        };
      },
      createWatch() {
        return {
          roots: [],
          async start() {
            startCalls += 1;
          },
          async reconcileNow() {},
          async stop() {
            stopCalls += 1;
          },
        };
      },
      waitForShutdownSignal() {
        return Promise.reject(shutdownFailure);
      },
    }),
  ).rejects.toThrow(shutdownFailure.message);

  expect(startCalls).toBe(1);
  expect(stopCalls).toBe(1);
  expect(closeCalls).toBe(1);
});
