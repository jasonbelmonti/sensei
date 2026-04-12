import {
  createSessionIngestService,
  type DiscoveryEvent,
  type DiscoveryRootConfig,
  type IngestProviderRegistry,
  type IngestWarning,
  type SessionIngestService,
  type SessionIngestServiceOptions,
} from "@jasonbelmonti/claudex/ingest";

import type { SenseiRuntimeConfig } from "../config";
import {
  createSenseiPassiveIngestRegistries,
  createSenseiPassiveScanRoots,
  createSenseiPassiveScanRootsForConfig,
  type SenseiPassiveScanRoot,
} from "./provider-roots";
import type { SenseiPassiveScanRecord, SenseiPassiveScanResult } from "./scan-result";

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

      const service = createService({
        roots,
        registries: createRegistries(),
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
