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
    createSenseiPassiveScanRoot("claude", providerRoots.claude),
    createSenseiPassiveScanRoot("codex", providerRoots.codex),
  ];
}

export function createSenseiPassiveScanRootsForConfig(
  config: Pick<SenseiRuntimeConfig, "paths">,
): SenseiPassiveScanRoot[] {
  return createSenseiPassiveScanRoots(config.paths.providers);
}

export function createSenseiPassiveIngestRegistries(): IngestProviderRegistry[] {
  return [
    ...createClaudeIngestRegistries(),
    ...createCodexIngestRegistries(),
  ];
}

function createSenseiPassiveScanRoot(
  provider: SenseiPassiveScanRoot["provider"],
  path: string,
): SenseiPassiveScanRoot {
  return {
    provider,
    path,
    recursive: true,
    watch: false,
  };
}
