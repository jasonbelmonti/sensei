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
import type {
  SenseiPassiveScanObservedEvent,
  SenseiPassiveScanObservedSession,
  SenseiPassiveScanResult,
} from "./scan-result";

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

export function createSenseiPassiveScanAdapter(
  options: CreateSenseiPassiveScanAdapterOptions,
): SenseiPassiveScanAdapter {
  const roots = [...options.roots];
  const createRegistries =
    options.createRegistries ?? createSenseiPassiveIngestRegistries;
  const createService = options.createService ?? createSessionIngestService;

  return {
    roots,
    async scanNow() {
      const records: Array<
        SenseiPassiveScanObservedEvent | SenseiPassiveScanObservedSession
      > = [];
      const warnings: IngestWarning[] = [];
      const discoveryEvents: DiscoveryEvent[] = [];

      const service = createService({
        roots: roots as DiscoveryRootConfig[],
        registries: createRegistries(),
        onObservedEvent(observedEvent) {
          records.push({
            kind: "event",
            observedEvent,
          });
        },
        onObservedSession(observedSession) {
          records.push({
            kind: "session",
            observedSession,
          });
        },
        onWarning(warning) {
          warnings.push(warning);
        },
        onDiscoveryEvent(discoveryEvent) {
          discoveryEvents.push(discoveryEvent);
        },
      });

      await service.scanNow();

      return {
        records,
        warnings,
        discoveryEvents,
      };
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
