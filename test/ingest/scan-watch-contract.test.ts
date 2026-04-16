import { afterEach, expect, test } from "bun:test";
import type { IngestCursor } from "@jasonbelmonti/claudex/ingest";

import {
  countRows,
  createBaselineScanResult,
  createScanWatchContractHarness,
  createWarningOnlyScanResult,
  createWarningWatchService,
  createWatchContinuationService,
  fixtureCodexRoot,
  fixtureSessionId,
  fixtureThreadName,
  fixtureTranscriptPath,
} from "./scan-watch-contract.fixture";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

test("scan replay seeds watch cursor continuity without duplicating canonical rows", async () => {
  const harness = createScanWatchContractHarness("sensei-ingest-scan-watch-contract");
  cleanups.push(() => harness.cleanup());
  const observedCursors: Array<IngestCursor | null> = [];

  await harness.runScan(createBaselineScanResult);
  await harness.runScan(createBaselineScanResult);
  await harness.runWatch({
    createService(options) {
      return createWatchContinuationService(options, observedCursors);
    },
  });

  const storage = harness.openStorage();

  expect(observedCursors).toEqual([
    expect.objectContaining({
      provider: "codex",
      filePath: fixtureTranscriptPath,
      byteOffset: 20,
      line: 2,
    }),
  ]);
  expect(countRows(storage, "sessions")).toBe(1);
  expect(countRows(storage, "turns")).toBe(1);
  expect(countRows(storage, "turn_usage")).toBe(1);
  expect(countRows(storage, "ingest_cursors")).toBe(2);
  expect(storage.conversations.getSession("codex", fixtureSessionId)).toMatchObject({
    provider: "codex",
    sessionId: fixtureSessionId,
    metadata: {
      threadName: fixtureThreadName,
    },
    source: {
      kind: "session-index",
      discoveryPhase: "initial_scan",
    },
  });
  expect(
    storage.conversations.getTurn("codex", fixtureSessionId, "turn-1"),
  ).toMatchObject({
    provider: "codex",
    turnId: "turn-1",
    status: "completed",
    startedAt: "2026-04-11T12:00:01.000Z",
    completedAt: "2026-04-11T12:00:04.000Z",
  });
  expect(
    storage.ingestState.getCursor("codex", fixtureCodexRoot, fixtureTranscriptPath),
  ).toMatchObject({
    byteOffset: 40,
    line: 4,
  });
});

test("scan and watch warnings both persist as canonical ingest warning rows", async () => {
  const harness = createScanWatchContractHarness("sensei-ingest-warning-contract");
  cleanups.push(() => harness.cleanup());

  await harness.runScan(createWarningOnlyScanResult);
  await harness.runWatch({
    createService(options) {
      return createWarningWatchService(options, "watch-failed");
    },
  });

  const warnings = harness.openStorage().ingestState.listWarnings();

  expect(warnings.map((warning) => warning.code)).toEqual([
    "parse-failed",
    "watch-failed",
  ]);
  expect(warnings[0]).toMatchObject({
    provider: "codex",
    filePath: fixtureTranscriptPath,
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "initial_scan",
    },
  });
  expect(warnings[1]).toMatchObject({
    provider: "codex",
    filePath: fixtureTranscriptPath,
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "watch",
    },
  });
});
