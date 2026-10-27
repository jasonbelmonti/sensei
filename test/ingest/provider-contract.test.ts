import { expect, test } from "vitest";
import type {
  IngestCursorKey,
  ObservedSessionRecord,
} from "../../src/ingest/contracts.js";

import { writePassiveScanResultToStorage } from "../../src/ingest/storage-writer.js";
import { createSenseiWatchStorageBindings } from "../../src/ingest/watch-storage.js";
import { createStorageTestHarness } from "../storage/helpers.js";

test("unsupported runtime providers cannot partially populate Sensei storage or advance cursors", async () => {
  const harness = createStorageTestHarness("sensei-provider-contract");
  try {
    const record = {
      kind: "session",
      observedSession: {
        provider: "copilot",
        sessionId: "unsupported",
        state: "canonical",
      },
      source: {
        provider: "copilot",
        kind: "transcript",
        discoveryPhase: "initial_scan",
        rootPath: "/fixture",
        filePath: "/fixture/session.jsonl",
      },
      completeness: "complete",
      reason: "transcript",
    } as unknown as ObservedSessionRecord;
    expect(() =>
      writePassiveScanResultToStorage(harness.storage, {
        records: [{ kind: "session", observedSession: record }],
        warnings: [],
        discoveryEvents: [],
      }),
    ).toThrow("Unsupported Sensei ingest provider: copilot");
    const { cursorStore } = createSenseiWatchStorageBindings(harness.storage);
    const key = {
      provider: "copilot",
      rootPath: "/fixture",
      filePath: "/fixture/session.jsonl",
    } as unknown as IngestCursorKey;
    await expect(
      cursorStore?.set({ ...key, byteOffset: 10, line: 1 }),
    ).rejects.toThrow("Unsupported Sensei ingest provider: copilot");
    await expect(cursorStore?.get(key)).rejects.toThrow(
      "Unsupported Sensei ingest provider: copilot",
    );
    await expect(cursorStore?.delete(key)).rejects.toThrow(
      "Unsupported Sensei ingest provider: copilot",
    );
    expect(
      harness.storage.database
        .query("SELECT count(*) AS count FROM sessions")
        .get(),
    ).toEqual({ count: 0 });
    expect(
      harness.storage.database
        .query("SELECT count(*) AS count FROM ingest_cursors")
        .get(),
    ).toEqual({ count: 0 });
  } finally {
    harness.cleanup();
  }
});
