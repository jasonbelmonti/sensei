import { expect, test } from "bun:test";
import type {
  DiscoveryEvent,
  IngestProviderRegistry,
  IngestWarning,
  ObservedAgentEvent,
  ObservedSessionRecord,
  SessionIngestService,
  SessionIngestServiceOptions,
} from "@jasonbelmonti/claudex/ingest";

import { createSenseiConfig } from "../../src/config";
import {
  createSenseiPassiveIngestRegistries,
  createSenseiPassiveScanAdapter,
  createSenseiPassiveScanAdapterForConfig,
  createSenseiPassiveScanRoots,
} from "../../src/ingest";

test("passive scan roots and registries are derived from runtime config", () => {
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
  });
  const expectedRoots = createExpectedRoots();
  const registries = createSenseiPassiveIngestRegistries();

  expect(createSenseiPassiveScanRoots(config.paths.providers)).toEqual(expectedRoots);
  expect(createSenseiPassiveScanAdapterForConfig(config).roots).toEqual(expectedRoots);

  expect(
    registries.map((registry) => [registry.provider, registry.matchFile.name]),
  ).toHaveLength(4);
  expect(new Set(registries.map((registry) => registry.provider))).toEqual(
    new Set(["claude", "codex"]),
  );
});

test("passive scan adapter collects observed records and service side channels", async () => {
  const roots = createExpectedRoots();
  const registries: IngestProviderRegistry[] = [
    {
      provider: "claude",
      matchFile() {
        return null;
      },
      parseFile() {
        return {
          async *[Symbol.asyncIterator]() {},
        };
      },
    },
  ];

  const capturedOptions: SessionIngestServiceOptions[] = [];

  const adapter = createSenseiPassiveScanAdapter({
    roots,
    createRegistries() {
      return registries;
    },
    createService(options) {
      capturedOptions.push(options);
      return createFakeService(options);
    },
  });

  const result = await adapter.scanNow();

  const [serviceOptions] = capturedOptions;

  if (!serviceOptions) {
    throw new Error("Expected the fake service factory to receive options.");
  }

  expect(serviceOptions.roots).toEqual(roots);
  expect(serviceOptions.registries).toEqual(registries);
  expect(result).toEqual({
    records: [
      {
        kind: "session",
        observedSession: createObservedSessionRecord(),
      },
      {
        kind: "event",
        observedEvent: createObservedAgentEvent(),
      },
    ],
    warnings: [createIngestWarning()],
    discoveryEvents: [createDiscoveryEvent()],
  });
});

function createFakeService(
  options: SessionIngestServiceOptions,
): SessionIngestService {
  return {
    roots: options.roots,
    async start() {},
    async stop() {},
    async reconcileNow() {},
    async scanNow() {
      options.onObservedSession?.(createObservedSessionRecord());
      options.onObservedEvent?.(createObservedAgentEvent());
      options.onWarning?.(createIngestWarning());
      options.onDiscoveryEvent?.(createDiscoveryEvent());
    },
  };
}

function createObservedSessionRecord(): ObservedSessionRecord {
  return {
    kind: "session",
    observedSession: {
      provider: "claude",
      sessionId: "session-1",
      state: "canonical",
      workingDirectory: "/repo/sensei",
    },
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    reason: "snapshot",
  };
}

function createObservedAgentEvent(): ObservedAgentEvent {
  return {
    kind: "event",
    event: {
      type: "status",
      provider: "claude",
      session: null,
      status: "indexed",
    },
    source: {
      provider: "claude",
      kind: "transcript",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.jsonl",
    },
    observedSession: {
      provider: "claude",
      sessionId: "session-1",
      state: "canonical",
    },
    completeness: "complete",
  };
}

function createIngestWarning(): IngestWarning {
  return {
    code: "parse-failed",
    message: "record skipped",
    provider: "claude",
    filePath: "/Users/test/.claude/projects/session-1.jsonl",
  };
}

function createDiscoveryEvent(): DiscoveryEvent {
  return {
    type: "scan.completed",
    provider: "claude",
    rootPath: "/Users/test/.claude",
    discoveryPhase: "initial_scan",
  };
}

function createExpectedRoots() {
  return createSenseiPassiveScanRoots({
    claude: "/Users/test/.claude",
    codex: "/Users/test/.codex",
  });
}
