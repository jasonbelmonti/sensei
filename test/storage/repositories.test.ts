import { afterEach, expect, test } from "bun:test";

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
    statusText: "older replay",
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
