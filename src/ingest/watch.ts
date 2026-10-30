import type {
  IngestProviderRegistry,
  SessionIngestService,
  SessionIngestServiceOptions,
} from "./contracts.js";
import { createSessionIngestService } from "./service.js";

import type { SenseiRuntimeConfig } from "../config/index.js";
import {
  createSenseiPassiveIngestRegistries,
  createSenseiPassiveWatchRootsForConfig,
  type SenseiPassiveScanRoot,
} from "./provider-roots.js";
import {
  createSenseiWatchStorageBindings,
  type SenseiIngestWatchStorage,
} from "./watch-storage.js";

type CreateSenseiIngestWatchService = (
  options: SessionIngestServiceOptions,
) => SessionIngestService;

export type SenseiIngestWatchConfig = Pick<SenseiRuntimeConfig, "paths" | "ingest">;

export type SenseiIngestWatch = {
  roots: readonly SenseiPassiveScanRoot[];
  start(): Promise<void>;
  reconcileNow(): Promise<void>;
  stop(): Promise<void>;
};

export type CreateSenseiIngestWatchOptions = {
  storage: SenseiIngestWatchStorage;
  createRegistries?: () => IngestProviderRegistry[];
  createService?: CreateSenseiIngestWatchService;
};

export function createSenseiIngestWatch(
  config: SenseiIngestWatchConfig,
  options: CreateSenseiIngestWatchOptions,
): SenseiIngestWatch {
  const roots = createSenseiPassiveWatchRootsForConfig(config);
  const createRegistries =
    options.createRegistries ?? createSenseiPassiveIngestRegistries;
  const createService = options.createService ?? createSessionIngestService;

  const service = createService({
    roots,
    registries: createRegistries(),
    watchIntervalMs: config.ingest.watchIntervalMs,
    ...createSenseiWatchStorageBindings(options.storage),
  });

  return {
    roots,
    start() {
      return service.start();
    },
    reconcileNow() {
      return service.reconcileNow();
    },
    stop() {
      return service.stop();
    },
  };
}
