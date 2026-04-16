import type {
  SessionIngestService,
  SessionIngestServiceOptions,
} from "@jasonbelmonti/claudex/ingest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSenseiConfig } from "../../src/config";
import {
  createSenseiIngestWatch,
  createSenseiPassiveScanRoots,
  runSenseiIngestScanCommand,
  type SenseiPassiveScanResult,
} from "../../src/ingest";
import { openSenseiStorage, type SenseiStorage } from "../../src/storage";
import { fixtureCodexRoot } from "./scan-watch-contract-scenarios";

export function createScanWatchContractHarness(prefix: string) {
  const runtimeRoot = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: runtimeRoot,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: fixtureCodexRoot,
    },
  });
  const cleanups: Array<() => void> = [
    () => rmSync(runtimeRoot, { recursive: true, force: true }),
  ];

  return {
    cleanup() {
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
    },
    openStorage() {
      const storage = openSenseiStorage({
        databasePath: config.paths.databasePath,
      });
      cleanups.push(() => storage.close());

      return storage;
    },
    async runScan(createScanResult: (codexRoot: string) => SenseiPassiveScanResult) {
      await runSenseiIngestScanCommand(config, {
        createAdapterForConfig(scanConfig) {
          return {
            roots: createSenseiPassiveScanRoots(scanConfig.paths.providers),
            async scanNow() {
              return createScanResult(scanConfig.paths.providers.codex);
            },
          };
        },
      });
    },
    async runWatch(options: {
      createService: (options: SessionIngestServiceOptions) => SessionIngestService;
    }) {
      const storage = openSenseiStorage({
        databasePath: config.paths.databasePath,
      });

      try {
        const watch = createSenseiIngestWatch(config, {
          storage,
          createService: options.createService,
        });

        await watch.start();
        await watch.stop();
      } finally {
        storage.close();
      }
    },
  };
}

export function countRows(storage: SenseiStorage, table: string): number {
  const row = storage.database
    .query(`SELECT COUNT(*) as count FROM ${table}`)
    .get() as { count: number };

  return row.count;
}
