import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSenseiConfig } from "../../src/config/index.js";
import { createStorageTestHarness } from "../storage/helpers.js";

export const legacyFixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/legacy-ingest/compatibility",
);

export function createRealIngestFixture(copyInputs = true) {
  const harness = createStorageTestHarness("sensei-real-ingest");
  const roots = {
    claude: join(harness.rootDir, "claude"),
    codex: join(harness.rootDir, "codex"),
  };
  for (const provider of ["claude", "codex"] as const) {
    if (copyInputs)
      cpSync(join(legacyFixtureRoot, provider), roots[provider], {
        recursive: true,
      });
    else mkdirSync(roots[provider]);
  }
  const config = createSenseiConfig({
    repoRoot: harness.rootDir,
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: roots.claude,
      SENSEI_CODEX_ROOT: roots.codex,
      SENSEI_INGEST_WATCH_INTERVAL_MS: "60000",
    },
  });
  return { ...harness, roots, config };
}
