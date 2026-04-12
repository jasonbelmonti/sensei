import { afterEach, expect, test } from "bun:test";

import { openSenseiStorage } from "../../src/storage";
import { createIngestStateRepository } from "../../src/storage/repositories/ingest-state";
import { createStorageTestHarness } from "./helpers";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

test("conversation repository upserts canonical sessions, turns, usage, and tool event state", () => {
  const harness = createStorageTestHarness("sensei-storage-conversations");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  const session = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    workingDirectory: "/repo/sensei",
    metadata: {
      origin: "snapshot",
    },
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
      location: {
        line: 10,
      },
      metadata: {
        snapshotVersion: 1,
      },
    },
    completeness: "complete",
    observationReason: "snapshot",
  });

  const startedTurn = conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "started",
    input: {
      prompt: "Summarize the latest ingest changes.",
      attachments: [{ kind: "image", name: "diagram.png" }],
      metadata: {
        executionMode: "act",
      },
    },
    startedAt: "2026-04-11T12:00:00.000Z",
  });
  const completedTurn = conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    output: {
      text: "Storage foundation is ready.",
      structuredOutput: {
        ok: true,
      },
      stopReason: "end_turn",
    },
    extensions: {
      latencyMs: 42,
    },
    raw: {
      recordCount: 3,
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });
  const usage = conversations.upsertTurnUsage({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    inputTokens: 120,
    outputTokens: 80,
    cachedInputTokens: 40,
    costUsd: 0.015,
    providerUsage: {
      cacheWriteTokens: 2,
    },
  });
  conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "started",
    toolName: "exec_command",
    toolKind: "command",
    input: {
      cmd: "git status --short",
    },
    startedAt: "2026-04-11T12:00:01.000Z",
  });
  const toolEvent = conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "completed",
    statusText: "command finished",
    output: {
      stdout: "clean",
    },
    outcome: "success",
    completedAt: "2026-04-11T12:00:02.000Z",
  });

  expect(session).toMatchObject({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    workingDirectory: "/repo/sensei",
    completeness: "complete",
    observationReason: "snapshot",
  });
  expect(startedTurn).toMatchObject({
    provider: "claude",
    turnId: "turn-1",
    status: "started",
  });
  expect(completedTurn).toMatchObject({
    provider: "claude",
    turnId: "turn-1",
    status: "completed",
    input: {
      prompt: "Summarize the latest ingest changes.",
      attachments: [{ kind: "image", name: "diagram.png" }],
      metadata: {
        executionMode: "act",
      },
    },
    output: {
      text: "Storage foundation is ready.",
      structuredOutput: {
        ok: true,
      },
      stopReason: "end_turn",
    },
  });
  expect(usage).toMatchObject({
    inputTokens: 120,
    outputTokens: 80,
    cachedInputTokens: 40,
  });
  expect(toolEvent).toMatchObject({
    status: "completed",
    toolName: "exec_command",
    toolKind: "command",
    statusText: "command finished",
    outcome: "success",
    input: {
      cmd: "git status --short",
    },
    output: {
      stdout: "clean",
    },
  });
  expect(
    conversations.getSession("claude", "session-1")?.source.location,
  ).toEqual({ line: 10 });
  expect(conversations.getTurn("claude", "session-1", "turn-1")).toMatchObject({
    status: "completed",
    startedAt: "2026-04-11T12:00:00.000Z",
    completedAt: "2026-04-11T12:00:05.000Z",
  });
  expect(
    conversations.listToolEvents("claude", "session-1", "turn-1"),
  ).toHaveLength(1);
});

test("conversation repository preserves explicit session source provider", () => {
  const harness = createStorageTestHarness("sensei-storage-session-source-provider");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  const storedSession = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-foreign-source",
    identityState: "canonical",
    source: {
      provider: "codex",
      kind: "snapshot",
      discoveryPhase: "reconcile",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-foreign-source.json",
    },
    completeness: "complete",
    observationReason: "reconcile",
    observedAt: "2026-04-11T12:03:00.000Z",
  });

  expect(storedSession).toMatchObject({
    provider: "claude",
    source: {
      provider: "codex",
      kind: "snapshot",
      discoveryPhase: "reconcile",
      filePath: "/Users/test/.codex/sessions/session-foreign-source.json",
    },
  });
  expect(
    conversations.getSession("claude", "session-foreign-source"),
  ).toMatchObject({
    provider: "claude",
    source: {
      provider: "codex",
      kind: "snapshot",
      discoveryPhase: "reconcile",
      filePath: "/Users/test/.codex/sessions/session-foreign-source.json",
    },
  });
});

test("conversation repository keeps stronger session, turn, and tool states during replay", () => {
  const harness = createStorageTestHarness("sensei-storage-monotonic-replay");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
    observedAt: "2026-04-11T12:00:00.000Z",
  });
  const replayedSession = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "provisional",
    source: {
      provider: "claude",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1-transcript.jsonl",
    },
    completeness: "partial",
    observationReason: "transcript",
    observedAt: "2026-04-11T12:01:00.000Z",
  });

  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    output: {
      text: "done",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });
  const replayedTurn = conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "started",
    startedAt: "2026-04-11T12:00:00.000Z",
  });

  conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "completed",
    toolName: "exec_command",
    statusText: "finished",
    output: {
      stdout: "done",
    },
    outcome: "success",
    completedAt: "2026-04-11T12:00:04.000Z",
  });
  const replayedToolEvent = conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "updated",
    statusText: "older replay",
  });

  expect(replayedSession).toMatchObject({
    identityState: "canonical",
    completeness: "complete",
    observationReason: "snapshot",
    source: {
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    observedAt: "2026-04-11T12:00:00.000Z",
  });
  expect(replayedTurn).toMatchObject({
    status: "completed",
    output: {
      text: "done",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });
  expect(replayedToolEvent).toMatchObject({
    status: "completed",
    outcome: "success",
    completedAt: "2026-04-11T12:00:04.000Z",
    statusText: "finished",
    output: {
      stdout: "done",
    },
  });
});

test("conversation repository ignores weaker session payload replays", () => {
  const harness = createStorageTestHarness("sensei-storage-session-weaker-payload");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    workingDirectory: "/repo/canonical",
    metadata: {
      origin: "snapshot",
    },
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
    observedAt: "2026-04-11T12:00:00.000Z",
  });

  const replayedSession = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "provisional",
    workingDirectory: "/repo/weaker",
    metadata: {
      origin: "transcript",
    },
    source: {
      provider: "claude",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.jsonl",
    },
    completeness: "partial",
    observationReason: "transcript",
    observedAt: "2026-04-11T12:01:00.000Z",
  });

  expect(replayedSession).toMatchObject({
    identityState: "canonical",
    workingDirectory: "/repo/canonical",
    metadata: {
      origin: "snapshot",
    },
    observationReason: "snapshot",
  });
});

test("conversation repository clears stale failure state when a turn completes", () => {
  const harness = createStorageTestHarness("sensei-storage-turn-failure-reset");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
  });

  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "failed",
    error: {
      code: "provider_failure",
      message: "command failed",
      details: {
        exitCode: 1,
      },
    },
    failedAt: "2026-04-11T12:00:03.000Z",
  });

  const completedTurn = conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    output: {
      text: "done",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });

  expect(completedTurn).toMatchObject({
    status: "completed",
    output: {
      text: "done",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
    error: undefined,
    failedAt: undefined,
  });
});

test("conversation repository keeps completed turns clear of weaker failure replays", () => {
  const harness = createStorageTestHarness("sensei-storage-turn-weaker-failure");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
  });

  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    output: {
      text: "done",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });

  const replayedTurn = conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "failed",
    error: {
      code: "provider_failure",
      message: "late failure replay",
      details: {
        exitCode: 1,
      },
    },
    failedAt: "2026-04-11T12:00:06.000Z",
  });

  expect(replayedTurn).toMatchObject({
    status: "completed",
    output: {
      text: "done",
    },
    error: undefined,
    failedAt: undefined,
    completedAt: "2026-04-11T12:00:05.000Z",
  });
});

test("conversation repository ignores weaker turn payload replays", () => {
  const harness = createStorageTestHarness("sensei-storage-turn-weaker-payload");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
  });

  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    output: {
      text: "canonical output",
    },
    raw: {
      event: "canonical",
    },
    extensions: {
      source: "snapshot",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });

  const replayedTurn = conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "started",
    output: {
      text: "weaker output",
    },
    raw: {
      event: "weaker",
    },
    extensions: {
      source: "transcript",
    },
    startedAt: "2026-04-11T12:00:01.000Z",
  });

  expect(replayedTurn).toMatchObject({
    status: "completed",
    output: {
      text: "canonical output",
    },
    raw: {
      event: "canonical",
    },
    extensions: {
      source: "snapshot",
    },
    completedAt: "2026-04-11T12:00:05.000Z",
  });
});

test("conversation repository clears stale tool error text after success", () => {
  const harness = createStorageTestHarness("sensei-storage-tool-error-reset");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
  });
  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    completedAt: "2026-04-11T12:00:05.000Z",
  });

  conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "updated",
    errorMessage: "previous failure",
  });

  const completedToolEvent = conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "completed",
    outcome: "success",
    completedAt: "2026-04-11T12:00:06.000Z",
  });

  expect(completedToolEvent).toMatchObject({
    status: "completed",
    outcome: "success",
    completedAt: "2026-04-11T12:00:06.000Z",
    errorMessage: undefined,
  });
});

test("conversation repository ignores weaker tool-event payload replays", () => {
  const harness = createStorageTestHarness("sensei-storage-tool-weaker-payload");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
  });
  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    completedAt: "2026-04-11T12:00:05.000Z",
  });

  conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "completed",
    statusText: "canonical event",
    output: {
      stdout: "canonical",
    },
    outcome: "success",
    completedAt: "2026-04-11T12:00:06.000Z",
  });

  const replayedToolEvent = conversations.upsertToolEvent({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    toolCallId: "tool-1",
    status: "updated",
    statusText: "weaker event",
    output: {
      stdout: "weaker",
    },
    outcome: "error",
    errorMessage: "weaker error",
  });

  expect(replayedToolEvent).toMatchObject({
    status: "completed",
    statusText: "canonical event",
    output: {
      stdout: "canonical",
    },
    outcome: "success",
    errorMessage: undefined,
    completedAt: "2026-04-11T12:00:06.000Z",
  });
});

test("conversation repository keeps usage counters monotonic", () => {
  const harness = createStorageTestHarness("sensei-storage-usage-monotonic");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
  });
  conversations.upsertTurn({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    completedAt: "2026-04-11T12:00:05.000Z",
  });

  const initialUsage = conversations.upsertTurnUsage({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    inputTokens: 100,
    outputTokens: 80,
    cachedInputTokens: 40,
    costUsd: 0.01,
    providerUsage: {
      cacheWriteTokens: 2,
    },
  });

  const replayedUsage = conversations.upsertTurnUsage({
    provider: "claude",
    sessionId: "session-1",
    turnId: "turn-1",
    inputTokens: 10,
    outputTokens: 8,
    cachedInputTokens: 4,
    costUsd: 0.001,
    providerUsage: {
      cacheWriteTokens: 1,
    },
  });

  expect(initialUsage).toMatchObject({
    inputTokens: 100,
    outputTokens: 80,
    cachedInputTokens: 40,
    costUsd: 0.01,
  });
  expect(replayedUsage).toMatchObject({
    inputTokens: 100,
    outputTokens: 80,
    cachedInputTokens: 40,
    costUsd: 0.01,
    providerUsage: {
      cacheWriteTokens: 2,
    },
  });
});

test("conversation repository keeps session provenance stable for equal-strength replays", () => {
  const harness = createStorageTestHarness("sensei-storage-session-provenance");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    completeness: "complete",
    observationReason: "snapshot",
    observedAt: "2026-04-11T12:00:00.000Z",
  });
  const replayedSession = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1-transcript.jsonl",
    },
    completeness: "complete",
    observationReason: "transcript",
    observedAt: "2026-04-11T12:01:00.000Z",
  });

  expect(replayedSession).toMatchObject({
    identityState: "canonical",
    completeness: "complete",
    observationReason: "snapshot",
    source: {
      kind: "snapshot",
      discoveryPhase: "initial_scan",
      filePath: "/Users/test/.claude/projects/session-1.json",
    },
    observedAt: "2026-04-11T12:00:00.000Z",
  });
});

test("conversation repository updates provenance when session identity strengthens", () => {
  const harness = createStorageTestHarness("sensei-storage-session-identity");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "provisional",
    source: {
      provider: "claude",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.jsonl",
    },
    completeness: "complete",
    observationReason: "transcript",
    observedAt: "2026-04-11T12:00:00.000Z",
  });
  const replayedSession = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "reconcile",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.snapshot.json",
    },
    completeness: "partial",
    observationReason: "snapshot",
    observedAt: "2026-04-11T12:01:00.000Z",
  });

  expect(replayedSession).toMatchObject({
    identityState: "canonical",
    completeness: "complete",
    observationReason: "snapshot",
    source: {
      kind: "snapshot",
      discoveryPhase: "reconcile",
      filePath: "/Users/test/.claude/projects/session-1.snapshot.json",
    },
    observedAt: "2026-04-11T12:01:00.000Z",
  });
});

test("conversation repository clears stale source details when provenance changes", () => {
  const harness = createStorageTestHarness("sensei-storage-session-source-details");
  cleanups.push(harness.cleanup);

  const { conversations } = harness.storage;

  conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "provisional",
    source: {
      provider: "claude",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.jsonl",
      location: {
        line: 42,
      },
      metadata: {
        transcriptChunk: 7,
      },
    },
    completeness: "partial",
    observationReason: "transcript",
    observedAt: "2026-04-11T12:00:00.000Z",
  });

  const replayedSession = conversations.upsertSession({
    provider: "claude",
    sessionId: "session-1",
    identityState: "canonical",
    source: {
      provider: "claude",
      kind: "snapshot",
      discoveryPhase: "reconcile",
      rootPath: "/Users/test/.claude",
      filePath: "/Users/test/.claude/projects/session-1.snapshot.json",
    },
    completeness: "partial",
    observationReason: "snapshot",
    observedAt: "2026-04-11T12:01:00.000Z",
  });

  expect(replayedSession).toMatchObject({
    identityState: "canonical",
    observationReason: "snapshot",
    source: {
      kind: "snapshot",
      discoveryPhase: "reconcile",
      filePath: "/Users/test/.claude/projects/session-1.snapshot.json",
      location: undefined,
      metadata: undefined,
    },
  });
});

test("ingest state repository stores cursors and append-only warnings", () => {
  const harness = createStorageTestHarness("sensei-storage-ingest-state");
  cleanups.push(harness.cleanup);

  const { ingestState } = harness.storage;

  const cursor = ingestState.setCursor({
    provider: "codex",
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/abc.jsonl",
    byteOffset: 128,
    line: 9,
    fingerprint: "fp-1",
    continuityToken: "cont-1",
    metadata: {
      inode: 42,
    },
    updatedAt: "2026-04-11T12:01:00.000Z",
  });
  const warning = ingestState.recordWarning({
    code: "parse-failed",
    message: "Could not parse record",
    provider: "codex",
    filePath: "/Users/test/.codex/sessions/abc.jsonl",
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/abc.jsonl",
      location: {
        byteOffset: 128,
      },
      metadata: {
        parser: "jsonl",
      },
    },
    cause: {
      name: "SyntaxError",
    },
    raw: {
      preview: "{oops",
    },
    detectedAt: "2026-04-11T12:02:00.000Z",
  });

  expect(cursor).toEqual({
    provider: "codex",
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/abc.jsonl",
    byteOffset: 128,
    line: 9,
    fingerprint: "fp-1",
    continuityToken: "cont-1",
    metadata: {
      inode: 42,
    },
    updatedAt: "2026-04-11T12:01:00.000Z",
  });
  expect(ingestState.getCursor("codex", "/Users/test/.codex", "/Users/test/.codex/sessions/abc.jsonl")).toEqual(cursor);
  expect(warning).toMatchObject({
    code: "parse-failed",
    provider: "codex",
    filePath: "/Users/test/.codex/sessions/abc.jsonl",
    detectedAt: "2026-04-11T12:02:00.000Z",
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "watch",
      location: {
        byteOffset: 128,
      },
    },
  });
  expect(ingestState.listWarnings()).toHaveLength(1);

  ingestState.deleteCursor(
    "codex",
    "/Users/test/.codex",
    "/Users/test/.codex/sessions/abc.jsonl",
  );

  expect(
    ingestState.getCursor(
      "codex",
      "/Users/test/.codex",
      "/Users/test/.codex/sessions/abc.jsonl",
    ),
  ).toBeNull();
});

test("ingest state repository keeps cursor progress monotonic", () => {
  const harness = createStorageTestHarness("sensei-storage-cursor-monotonic");
  cleanups.push(harness.cleanup);

  const { ingestState } = harness.storage;
  const cursorKey = {
    provider: "codex",
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/abc.jsonl",
  } as const;

  ingestState.setCursor({
    ...cursorKey,
    byteOffset: 200,
    line: 20,
    fingerprint: "fp-200",
    continuityToken: "cont-200",
    metadata: {
      inode: 200,
    },
    updatedAt: "2026-04-11T12:02:00.000Z",
  });

  const replayedCursor = ingestState.setCursor({
    ...cursorKey,
    byteOffset: 50,
    line: 5,
    fingerprint: "fp-50",
    continuityToken: "cont-50",
    metadata: {
      inode: 50,
    },
    updatedAt: "2026-04-11T12:03:00.000Z",
  });

  expect(replayedCursor).toEqual({
    ...cursorKey,
    byteOffset: 200,
    line: 20,
    fingerprint: "fp-200",
    continuityToken: "cont-200",
    metadata: {
      inode: 200,
    },
    updatedAt: "2026-04-11T12:02:00.000Z",
  });
});

test("ingest state repository keeps advanced cursor progress during a stale writer interleave", () => {
  const harness = createStorageTestHarness("sensei-storage-cursor-stale-writer");
  cleanups.push(harness.cleanup);
  const cursorKey = {
    provider: "codex",
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/abc.jsonl",
  } as const;

  harness.storage.ingestState.setCursor({
    ...cursorKey,
    byteOffset: 50,
    line: 5,
    fingerprint: "fp-50",
    continuityToken: "cont-50",
    metadata: {
      inode: 50,
    },
    updatedAt: "2026-04-11T12:01:00.000Z",
  });

  const competingStorage = openSenseiStorage({
    databasePath: harness.databasePath,
  });
  cleanups.push(() => competingStorage.close());

  let injectedConcurrentWrite = false;

  const ingestState = createIngestStateRepository({
    query(sql: string) {
      const statement = harness.storage.database.query(sql);
      const all = statement.all.bind(statement);
      const get = statement.get.bind(statement);
      const run = statement.run.bind(statement);
      const wrappedStatement = {
        all,
        get,
        run,
      };

      if (!sql.includes("INSERT INTO ingest_cursors")) {
        return wrappedStatement;
      }

      return {
        ...wrappedStatement,
        get: (...args: Parameters<typeof get>) => {
          if (!injectedConcurrentWrite) {
            injectedConcurrentWrite = true;
            competingStorage.ingestState.setCursor({
              ...cursorKey,
              byteOffset: 200,
              line: 20,
              fingerprint: "fp-200",
              continuityToken: "cont-200",
              metadata: {
                inode: 200,
              },
              updatedAt: "2026-04-11T12:02:00.000Z",
            });
          }

          return get(...args);
        },
      };
    },
  } as Parameters<typeof createIngestStateRepository>[0]);

  const replayedCursor = ingestState.setCursor({
    ...cursorKey,
    byteOffset: 60,
    line: 6,
    fingerprint: "fp-60",
    continuityToken: "cont-60",
    metadata: {
      inode: 60,
    },
    updatedAt: "2026-04-11T12:03:00.000Z",
  });

  expect(injectedConcurrentWrite).toBe(true);
  expect(replayedCursor).toEqual({
    ...cursorKey,
    byteOffset: 200,
    line: 20,
    fingerprint: "fp-200",
    continuityToken: "cont-200",
    metadata: {
      inode: 200,
    },
    updatedAt: "2026-04-11T12:02:00.000Z",
  });
  expect(
    harness.storage.ingestState.getCursor(
      cursorKey.provider,
      cursorKey.rootPath,
      cursorKey.filePath,
    ),
  ).toEqual(replayedCursor);
});
