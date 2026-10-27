import { createClaudeIngestRegistries } from "../../src/ingest/claude/registry.js";
import { createCodexIngestRegistries } from "../../src/ingest/codex/registry.js";
import type { SessionIngestServiceOptions } from "../../src/ingest/contracts.js";
import { createSessionIngestService } from "../../src/ingest/service.js";
import { createSenseiWatchStorageBindings } from "../../src/ingest/watch-storage.js";
import type { createRealIngestFixture } from "./real-ingest.fixture.js";

export function createStoredService(
  fixture: ReturnType<typeof createRealIngestFixture>,
  overrides: Partial<SessionIngestServiceOptions> = {},
) {
  const bindings = createSenseiWatchStorageBindings(fixture.storage);
  return createSessionIngestService({
    roots: (["claude", "codex"] as const).map((provider) => ({
      provider,
      path: fixture.roots[provider],
      recursive: true,
      watch: true,
    })),
    registries: [
      ...createClaudeIngestRegistries(),
      ...createCodexIngestRegistries(),
    ],
    watchIntervalMs: 60000,
    onObservedEvent: bindings.onObservedEvent,
    onObservedSession: bindings.onObservedSession,
    onWarning: bindings.onWarning,
    cursorStore: {
      async get(key) {
        return fixture.storage.ingestState.getCursor(
          key.provider,
          key.rootPath,
          key.filePath,
        );
      },
      async set(cursor) {
        fixture.storage.ingestState.setCursor(cursor);
      },
      async delete(key) {
        fixture.storage.ingestState.deleteCursor(
          key.provider,
          key.rootPath,
          key.filePath,
        );
      },
    },
    ...overrides,
  });
}
