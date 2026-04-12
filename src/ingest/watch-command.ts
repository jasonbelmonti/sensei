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
type WaitForShutdownSignal = () => Promise<void>;
type SenseiIngestWatchCommandStorage = Pick<
  SenseiStorage,
  "transaction" | "ingestState" | "close"
>;

export type SenseiIngestWatchCommandSummary = {
  rootCount: number;
  watchIntervalMs: number;
  status: "running";
};

export type RunSenseiIngestWatchCommandOptions = {
  openStorage?: OpenSenseiIngestWatchStorage;
  createWatch?: CreateSenseiIngestWatchRunner;
  waitForShutdownSignal?: WaitForShutdownSignal;
  onStarted?: (summary: SenseiIngestWatchCommandSummary) => Promise<void> | void;
};

export async function runSenseiIngestWatchCommand(
  config: SenseiIngestWatchCommandConfig,
  options: RunSenseiIngestWatchCommandOptions = {},
): Promise<SenseiIngestWatchCommandSummary> {
  const openStorage = options.openStorage ?? openSenseiStorage;
  const createWatch = options.createWatch ?? createSenseiIngestWatch;
  const waitForShutdownSignal =
    options.waitForShutdownSignal ?? waitForProcessSignal;
  const storage = openStorage({
    databasePath: config.paths.databasePath,
  });
  const watch = createWatch(config, { storage });
  const summary = createWatchCommandSummary(config, watch);
  let watchStarted = false;

  try {
    await watch.start();
    watchStarted = true;
    await options.onStarted?.(summary);
    await waitForShutdownSignal();
    await stopWatch(watch);
    watchStarted = false;

    return summary;
  } finally {
    if (watchStarted) {
      await stopWatch(watch);
    }

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

function waitForProcessSignal(): Promise<void> {
  return new Promise((resolve) => {
    const handleSignal = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      process.off("SIGINT", handleSignal);
      process.off("SIGTERM", handleSignal);
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
  });
}
