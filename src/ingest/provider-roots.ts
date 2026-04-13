import type { DiscoveryRootConfig, IngestProviderRegistry } from "@jasonbelmonti/claudex/ingest";
import {
  createClaudeIngestRegistries,
  createCodexIngestRegistries,
} from "@jasonbelmonti/claudex/ingest";

import type { SenseiProviderRoots, SenseiRuntimeConfig } from "../config";

export type SenseiPassiveScanRoot = Pick<
  DiscoveryRootConfig,
  "provider" | "path" | "recursive" | "watch"
>;

export function createSenseiPassiveScanRoots(
  providerRoots: SenseiProviderRoots,
): SenseiPassiveScanRoot[] {
  return [
    createSenseiPassiveRoot("claude", providerRoots.claude, false),
    createSenseiPassiveRoot("codex", providerRoots.codex, false),
  ];
}

export function createSenseiPassiveScanRootsForConfig(
  config: Pick<SenseiRuntimeConfig, "paths">,
): SenseiPassiveScanRoot[] {
  return createSenseiPassiveScanRoots(config.paths.providers);
}

export function createSenseiPassiveWatchRoots(
  providerRoots: SenseiProviderRoots,
): SenseiPassiveScanRoot[] {
  return [
    createSenseiPassiveRoot("claude", providerRoots.claude, true),
    createSenseiPassiveRoot("codex", providerRoots.codex, true),
  ];
}

export function createSenseiPassiveWatchRootsForConfig(
  config: Pick<SenseiRuntimeConfig, "paths">,
): SenseiPassiveScanRoot[] {
  return createSenseiPassiveWatchRoots(config.paths.providers);
}

export function createSenseiPassiveIngestRegistries(): IngestProviderRegistry[] {
  return [
    ...createClaudeIngestRegistries(),
    ...createCodexIngestRegistries(),
  ];
}

function createSenseiPassiveRoot(
  provider: SenseiPassiveScanRoot["provider"],
  path: string,
  watch: boolean,
): SenseiPassiveScanRoot {
  return {
    provider,
    path,
    recursive: true,
    watch,
  };
}
