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
  const shutdownSignal = createShutdownSignalHarness();
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
    createShutdownSignalSubscription() {
      return shutdownSignal.subscription;
    },
    onStarted(startedSummary) {
      startedSummaries.push(startedSummary);
      shutdownSignal.resolve();
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
  const shutdownSignal = createRejectingShutdownSignalHarness(shutdownFailure);
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
      createShutdownSignalSubscription() {
        return shutdownSignal.subscription;
      },
    }),
  ).rejects.toThrow(shutdownFailure.message);

  expect(startCalls).toBe(1);
  expect(stopCalls).toBe(1);
  expect(closeCalls).toBe(1);
});

test("watch command closes storage if watch creation fails", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const creationFailure = new Error("watch creation failed");
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
        throw creationFailure;
      },
    }),
  ).rejects.toThrow(creationFailure.message);

  expect(closeCalls).toBe(1);
});

test("watch command stops partial startup and closes storage if watch start fails", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const startFailure = new Error("watch start failed");
  const shutdownSignal = createShutdownSignalHarness();
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
            shutdownSignal.resolve();
            throw startFailure;
          },
          async reconcileNow() {},
          async stop() {
            stopCalls += 1;
          },
        };
      },
      createShutdownSignalSubscription() {
        return shutdownSignal.subscription;
      },
    }),
  ).rejects.toThrow(startFailure.message);

  expect(stopCalls).toBe(1);
  expect(closeCalls).toBe(1);
});

test("watch command closes storage if watch shutdown fails", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const stopFailure = new Error("watch stop failed");
  const shutdownSignal = createResolvedShutdownSignalHarness();
  let closeCalls = 0;
  let stopCalls = 0;

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
          async start() {},
          async reconcileNow() {},
          async stop() {
            stopCalls += 1;
            throw stopFailure;
          },
        };
      },
      createShutdownSignalSubscription() {
        return shutdownSignal.subscription;
      },
    }),
  ).rejects.toThrow(stopFailure.message);

  expect(stopCalls).toBe(1);
  expect(closeCalls).toBe(1);
});

test("watch command closes storage if shutdown subscription setup fails", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const subscriptionFailure = new Error("subscription setup failed");
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
      createShutdownSignalSubscription() {
        throw subscriptionFailure;
      },
    }),
  ).rejects.toThrow(subscriptionFailure.message);

  expect(closeCalls).toBe(1);
});

test("watch command stops and closes storage when shutdown is requested during startup", async () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const shutdownSignal = createShutdownSignalHarness();
  let finishStart!: () => void;
  const startGate = new Promise<void>((resolve) => {
    finishStart = resolve;
  });
  let stopCalls = 0;
  let closeCalls = 0;
  let onStartedCalls = 0;

  const commandPromise = runSenseiIngestWatchCommand(config, {
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
          shutdownSignal.resolve();
          await startGate;
        },
        async reconcileNow() {},
        async stop() {
          stopCalls += 1;
        },
      };
    },
    createShutdownSignalSubscription() {
      return shutdownSignal.subscription;
    },
    onStarted() {
      onStartedCalls += 1;
    },
  });

  finishStart();

  await expect(commandPromise).resolves.toEqual({
    rootCount: 0,
    watchIntervalMs: config.ingest.watchIntervalMs,
    status: "running",
  });

  expect(onStartedCalls).toBe(0);
  expect(stopCalls).toBe(1);
  expect(closeCalls).toBe(1);
});

function createShutdownSignalHarness(): {
  resolve: () => void;
  subscription: {
    promise: Promise<void>;
    isTriggered(): boolean;
    dispose(): void;
  };
} {
  let triggered = false;
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = () => {
      triggered = true;
      resolve();
    };
  });

  return {
    resolve() {
      resolvePromise();
    },
    subscription: {
      promise,
      isTriggered() {
        return triggered;
      },
      dispose() {},
    },
  };
}

function createResolvedShutdownSignalHarness() {
  const harness = createShutdownSignalHarness();
  harness.resolve();
  return harness;
}

function createRejectingShutdownSignalHarness(error: Error): {
  subscription: {
    promise: Promise<void>;
    isTriggered(): boolean;
    dispose(): void;
  };
} {
  return {
    subscription: {
      promise: Promise.reject(error),
      isTriggered() {
        return false;
      },
      dispose() {},
    },
  };
}
