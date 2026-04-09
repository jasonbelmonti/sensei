import { resolve } from "node:path";

import type {
  ResolveSenseiRuntimePathsOptions,
  SenseiEnvironment,
  SenseiRuntimePaths,
} from "./runtime-paths";
import { resolveSenseiRuntimePaths } from "./runtime-paths";

export type SenseiEmbeddingConfig = {
  enabled: boolean;
  provider: string | null;
};

export type SenseiIngestConfig = {
  watchIntervalMs: number;
};

export type SenseiRuntimeConfig = {
  paths: SenseiRuntimePaths;
  ingest: SenseiIngestConfig;
  embeddings: SenseiEmbeddingConfig;
};

export type CreateSenseiConfigOptions = ResolveSenseiRuntimePathsOptions;

export function createSenseiConfig(
  options: CreateSenseiConfigOptions,
): SenseiRuntimeConfig {
  const env = options.env ?? process.env;
  const paths = resolveSenseiRuntimePaths(options);
  const embeddingProvider = normalizeOptionalString(env.SENSEI_EMBEDDING_PROVIDER);

  return {
    paths,
    ingest: {
      watchIntervalMs: parsePositiveInteger(
        env.SENSEI_INGEST_WATCH_INTERVAL_MS,
        250,
      ),
    },
    embeddings: {
      enabled: embeddingProvider !== null,
      provider: embeddingProvider,
    },
  };
}

export function createDefaultSenseiConfig(
  repoRoot: string,
  env: SenseiEnvironment = process.env,
): SenseiRuntimeConfig {
  return createSenseiConfig({
    repoRoot: resolve(repoRoot),
    env,
  });
}

function normalizeOptionalString(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function parsePositiveInteger(
  rawValue: string | undefined,
  defaultValue: number,
): number {
  const normalizedValue = rawValue?.trim();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return defaultValue;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

export type {
  ResolveSenseiRuntimePathsOptions,
  SenseiEnvironment,
  SenseiGeneratedPaths,
  SenseiProviderRoots,
  SenseiRuntimePaths,
} from "./runtime-paths";
export { resolveSenseiRuntimePaths } from "./runtime-paths";
