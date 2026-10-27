import type { SenseiRuntimeConfig } from "../config/index.js";
import type {
  DiscoveryEvent,
  DiscoveryRootConfig,
  IngestCursor,
  IngestProviderRegistry,
  IngestWarning,
  SessionIngestService,
  SessionIngestServiceOptions,
} from "./contracts.js";
import {
  createSenseiPassiveIngestRegistries,
  createSenseiPassiveScanRoots,
  createSenseiPassiveScanRootsForConfig,
  type SenseiPassiveScanRoot,
} from "./provider-roots.js";
import type {
  SenseiPassiveScanRecord,
  SenseiPassiveScanResult,
} from "./scan-result.js";
import { createSessionIngestService } from "./service.js";

type SessionIngestServiceFactory = (
  options: SessionIngestServiceOptions,
) => SessionIngestService;

export type CreateSenseiPassiveScanAdapterOptions = {
  roots: readonly SenseiPassiveScanRoot[];
  createRegistries?: () => IngestProviderRegistry[];
  createService?: SessionIngestServiceFactory;
};

export type SenseiPassiveScanAdapter = {
  roots: readonly SenseiPassiveScanRoot[];
  scanNow(): Promise<SenseiPassiveScanResult>;
};

type MutableSenseiPassiveScanResult = {
  records: SenseiPassiveScanRecord[];
  warnings: IngestWarning[];
  discoveryEvents: DiscoveryEvent[];
};

export function createSenseiPassiveScanAdapter(
  options: CreateSenseiPassiveScanAdapterOptions,
): SenseiPassiveScanAdapter {
  const roots: DiscoveryRootConfig[] = [...options.roots];
  const createRegistries =
    options.createRegistries ?? createSenseiPassiveIngestRegistries;
  const createService = options.createService ?? createSessionIngestService;

  return {
    roots,
    async scanNow() {
      const result = createMutableSenseiPassiveScanResult();
      const finalCursors: IngestCursor[] = [];

      const service = createService({
        roots,
        registries: createRegistries(),
        onCursor(cursor) {
          finalCursors.push(cursor);
        },
        onObservedEvent(observedEvent) {
          result.records.push({
            kind: "event",
            observedEvent,
          });
        },
        onObservedSession(observedSession) {
          result.records.push({
            kind: "session",
            observedSession,
          });
        },
        onWarning(warning) {
          result.warnings.push(warning);
        },
        onDiscoveryEvent(discoveryEvent) {
          result.discoveryEvents.push(discoveryEvent);
        },
      });

      await service.scanNow();

      // Publish the verified file checkpoint on the last buffered observation.
      // Storage commits this alongside the complete scan in its existing transaction.
      for (const cursor of finalCursors) {
        const record = result.records.findLast((entry) => {
          const observation =
            entry.kind === "event"
              ? entry.observedEvent
              : entry.observedSession;
          return (
            observation.source.provider === cursor.provider &&
            observation.source.rootPath === cursor.rootPath &&
            observation.source.filePath === cursor.filePath
          );
        });
        if (record?.kind === "event") record.observedEvent.cursor = cursor;
        else if (record) record.observedSession.cursor = cursor;
      }

      return result;
    },
  };
}

export function createSenseiPassiveScanAdapterForConfig(
  config: Pick<SenseiRuntimeConfig, "paths">,
  options: Omit<CreateSenseiPassiveScanAdapterOptions, "roots"> = {},
): SenseiPassiveScanAdapter {
  return createSenseiPassiveScanAdapter({
    ...options,
    roots: createSenseiPassiveScanRootsForConfig(config),
  });
}

export function createSenseiPassiveScanAdapterForProviderRoots(
  providerRoots: SenseiRuntimeConfig["paths"]["providers"],
  options: Omit<CreateSenseiPassiveScanAdapterOptions, "roots"> = {},
): SenseiPassiveScanAdapter {
  return createSenseiPassiveScanAdapter({
    ...options,
    roots: createSenseiPassiveScanRoots(providerRoots),
  });
}

function createMutableSenseiPassiveScanResult(): MutableSenseiPassiveScanResult {
  return {
    records: [],
    warnings: [],
    discoveryEvents: [],
  };
}
