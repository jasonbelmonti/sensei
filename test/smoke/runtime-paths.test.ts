import { expect, test } from "bun:test";

import {
  createSenseiConfig,
  resolveSenseiRuntimePaths,
} from "../../src/index";

const repoRoot = "/repo/sensei";
const homeDir = "/Users/sensei";

test("runtime paths default to local-first provider and output roots", () => {
  const paths = resolveSenseiRuntimePaths({
    repoRoot,
    homeDir,
    env: {},
  });

  expect(paths).toEqual({
    repoRoot,
    homeRoot: "/Users/sensei/.sensei",
    dataRoot: "/Users/sensei/.sensei/data",
    cacheRoot: "/Users/sensei/.sensei/cache",
    reportsRoot: "/Users/sensei/.sensei/reports",
    databasePath: "/Users/sensei/.sensei/data/sensei.sqlite",
    providers: {
      claude: "/Users/sensei/.claude",
      codex: "/Users/sensei/.codex",
    },
    generated: {
      root: "/repo/sensei/generated",
      skills: "/repo/sensei/generated/skills",
      scripts: "/repo/sensei/generated/scripts",
      automations: "/repo/sensei/generated/automations",
    },
  });
});

test("config honors path overrides and leaves room for optional embeddings", () => {
  const config = createSenseiConfig({
    repoRoot,
    homeDir,
    env: {
      SENSEI_HOME: ".sensei-dev",
      SENSEI_CLAUDE_ROOT: "state/claude",
      SENSEI_CODEX_ROOT: "/tmp/codex-state",
      SENSEI_GENERATED_ROOT: ".out",
      SENSEI_INGEST_WATCH_INTERVAL_MS: "5000",
      SENSEI_EMBEDDING_PROVIDER: "local-ollama",
    },
  });

  expect(config.paths.homeRoot).toBe("/Users/sensei/.sensei-dev");
  expect(config.paths.providers).toEqual({
    claude: "/Users/sensei/state/claude",
    codex: "/tmp/codex-state",
  });
  expect(config.paths.generated.root).toBe("/repo/sensei/.out");
  expect(config.ingest.watchIntervalMs).toBe(5000);
  expect(config.embeddings).toEqual({
    enabled: true,
    provider: "local-ollama",
  });
});

test("config rejects partially numeric ingest interval values", () => {
  const scientificNotationConfig = createSenseiConfig({
    repoRoot,
    homeDir,
    env: {
      SENSEI_INGEST_WATCH_INTERVAL_MS: "5e3",
    },
  });
  const suffixedValueConfig = createSenseiConfig({
    repoRoot,
    homeDir,
    env: {
      SENSEI_INGEST_WATCH_INTERVAL_MS: "100ms",
    },
  });

  expect(scientificNotationConfig.ingest.watchIntervalMs).toBe(250);
  expect(suffixedValueConfig.ingest.watchIntervalMs).toBe(250);
});
