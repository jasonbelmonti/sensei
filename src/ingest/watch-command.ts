import type { SenseiRuntimeConfig } from "../config";
import {
  openSenseiStorage,
  type OpenSenseiStorageOptions,
  type SenseiStorage,
} from "../storage";
import { createSenseiIngestWatch, type SenseiIngestWatch } from "./watch";

type SenseiIngestWatchCommandConfig = Pick<SenseiRuntimeConfig, "paths" | "ingest">;
type OpenSenseiIngestWatchStorage = (
  options: Pick<OpenSenseiStorageOptions, "databasePath">,
) => SenseiIngestWatchCommandStorage;
type CreateSenseiIngestWatchRunner = (
  config: SenseiIngestWatchCommandConfig,
  options: { storage: SenseiIngestWatchCommandStorage },
) => SenseiIngestWatch;
type SenseiIngestWatchCommandStorage = Pick<
  SenseiStorage,
  "transaction" | "ingestState" | "close"
>;
type ShutdownSignalSubscription = {
  promise: Promise<void>;
  isTriggered(): boolean;
  dispose(): void;
};
type CreateShutdownSignalSubscription = () => ShutdownSignalSubscription;

export type SenseiIngestWatchCommandSummary = {
  rootCount: number;
  watchIntervalMs: number;
  status: "running";
};

export type RunSenseiIngestWatchCommandOptions = {
  openStorage?: OpenSenseiIngestWatchStorage;
  createWatch?: CreateSenseiIngestWatchRunner;
  createShutdownSignalSubscription?: CreateShutdownSignalSubscription;
  onStarted?: (summary: SenseiIngestWatchCommandSummary) => Promise<void> | void;
};

export async function runSenseiIngestWatchCommand(
  config: SenseiIngestWatchCommandConfig,
  options: RunSenseiIngestWatchCommandOptions = {},
): Promise<SenseiIngestWatchCommandSummary> {
  const openStorage = options.openStorage ?? openSenseiStorage;
  const createWatch = options.createWatch ?? createSenseiIngestWatch;
  const createShutdownSignalSubscription =
    options.createShutdownSignalSubscription ?? createProcessSignalSubscription;
  const storage = openStorage({
    databasePath: config.paths.databasePath,
  });

  try {
    const shutdownSignal = createShutdownSignalSubscription();
    let watch: SenseiIngestWatch | null = null;
    let watchNeedsStop = false;

    try {
      watch = createWatch(config, { storage });
      const summary = createWatchCommandSummary(config, watch);

      watchNeedsStop = true;
      await watch.start();
      if (!shutdownSignal.isTriggered()) {
        await options.onStarted?.(summary);
      }
      await shutdownSignal.promise;
      watchNeedsStop = false;
      await stopWatch(watch);

      return summary;
    } finally {
      shutdownSignal.dispose();

      if (watchNeedsStop && watch) {
        await stopWatch(watch);
      }
    }
  } finally {
    storage.close();
  }
}

function createWatchCommandSummary(
  config: SenseiIngestWatchCommandConfig,
  watch: SenseiIngestWatch,
): SenseiIngestWatchCommandSummary {
  return {
    rootCount: watch.roots.length,
    watchIntervalMs: config.ingest.watchIntervalMs,
    status: "running",
  };
}

async function stopWatch(watch: SenseiIngestWatch): Promise<void> {
  await watch.stop();
}

function createProcessSignalSubscription(): ShutdownSignalSubscription {
  let triggered = false;
  let disposed = false;
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  const cleanup = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  };
  const handleSignal = () => {
    triggered = true;
    cleanup();
    resolvePromise();
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  return {
    promise,
    isTriggered() {
      return triggered;
    },
    dispose() {
      cleanup();
    },
  };
}
