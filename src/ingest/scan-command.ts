import type { SenseiRuntimeConfig } from "../config";
import {
  openSenseiStorage,
  type OpenSenseiStorageOptions,
  type SenseiStorage,
} from "../storage";
import {
  createSenseiPassiveScanAdapterForConfig,
  type SenseiPassiveScanAdapter,
} from "./passive-scan";
import type { SenseiPassiveScanResult } from "./scan-result";
import {
  writePassiveScanResultToStorage,
  type PassiveScanWriteSummary,
} from "./storage-writer";

type SenseiIngestScanConfig = Pick<SenseiRuntimeConfig, "paths">;
type SenseiIngestScanStorage = Pick<SenseiStorage, "close" | "transaction">;
type SenseiIngestScanWriteStorage = Pick<SenseiStorage, "transaction">;

type CreateSenseiIngestScanAdapter = (
  config: SenseiIngestScanConfig,
) => SenseiPassiveScanAdapter;

type OpenSenseiIngestScanStorage = (
  options: Pick<OpenSenseiStorageOptions, "databasePath">,
) => SenseiIngestScanStorage;

type WriteSenseiIngestScanResult = (
  storage: SenseiIngestScanWriteStorage,
  result: SenseiPassiveScanResult,
) => PassiveScanWriteSummary;

export type SenseiIngestScanCommandSummary = {
  rootCount: number;
  discoveryEventCount: number;
  writeSummary: PassiveScanWriteSummary;
};

export type RunSenseiIngestScanCommandOptions = {
  createAdapterForConfig?: CreateSenseiIngestScanAdapter;
  openStorage?: OpenSenseiIngestScanStorage;
  writeResultToStorage?: WriteSenseiIngestScanResult;
};

export async function runSenseiIngestScanCommand(
  config: SenseiIngestScanConfig,
  options: RunSenseiIngestScanCommandOptions = {},
): Promise<SenseiIngestScanCommandSummary> {
  const createAdapterForConfig =
    options.createAdapterForConfig ?? createSenseiPassiveScanAdapterForConfig;
  const openStorage = options.openStorage ?? openSenseiStorage;
  const writeResultToStorage =
    options.writeResultToStorage ?? writePassiveScanResultToStorage;

  const adapter = createAdapterForConfig(config);
  const result = await adapter.scanNow();
  const storage = openStorage({
    databasePath: config.paths.databasePath,
  });

  try {
    const writeSummary = writeResultToStorage(storage, result);

    return {
      rootCount: adapter.roots.length,
      discoveryEventCount: result.discoveryEvents.length,
      writeSummary,
    };
  } finally {
    storage.close();
  }
}
