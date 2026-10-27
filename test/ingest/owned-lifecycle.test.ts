import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createStoredService } from "./owned-service.fixture.js";
import { createRealIngestFixture } from "./real-ingest.fixture.js";

const indexRecord = (id: string) =>
  JSON.stringify({
    id,
    thread_name: id,
    updated_at: "2026-10-01T00:00:00.000Z",
  });

test("JSONL line coordinates stay stable across EOF without a newline and later appends", async () => {
  const f = createRealIngestFixture(false);
  try {
    const file = join(f.roots.codex, "session_index.jsonl");
    writeFileSync(file, indexRecord("one"));
    await createStoredService(f).scanNow();
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file)?.line,
    ).toBe(1);
    appendFileSync(file, `\n${indexRecord("two")}\n`);
    await createStoredService(f).scanNow();
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file)?.line,
    ).toBe(2);
    appendFileSync(
      file,
      `${JSON.stringify({ thread_name: "three", updated_at: "2026-10-01T00:00:00.000Z" })}\n`,
    );
    await createStoredService(f).scanNow();
    const cursor = f.storage.ingestState.getCursor(
      "codex",
      f.roots.codex,
      file,
    );
    expect(cursor?.line).toBe(3);
    expect(
      f.storage.conversations.getSession("codex", `file:${file}:line:3`),
    ).not.toBeNull();
  } finally {
    f.cleanup();
  }
});

test("timer ticks and manual reconcile serialize, and shutdown waits for the active write", async () => {
  const f = createRealIngestFixture(false);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const service = createStoredService(f, {
    watchIntervalMs: 5,
    async onRecord() {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      entered.resolve();
      await release.promise;
      active -= 1;
    },
  });
  try {
    await service.start();
    const file = join(f.roots.codex, "session_index.jsonl");
    writeFileSync(file, `${indexRecord("watched")}\n`);
    await entered.promise;
    const reconcile = service.reconcileNow();
    let stopped = false;
    const stop = service.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file),
    ).toBeNull();
    release.resolve();
    await Promise.all([reconcile, stop]);
    expect(maxActive).toBe(1);
    expect(calls).toBe(1);
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file)?.byteOffset,
    ).toBe(Buffer.byteLength(`${indexRecord("watched")}\n`));
  } finally {
    release.resolve();
    await service.stop();
    f.cleanup();
  }
});

test("a scheduled write failure stops the watcher visibly and can be retried on restart", async () => {
  const f = createRealIngestFixture(false);
  const failed = Promise.withResolvers<void>();
  let rejectWrite = true;
  const warnings: { code: string; provider?: string }[] = [];
  const service = createStoredService(f, {
    watchIntervalMs: 5,
    onRecord() {
      if (rejectWrite) throw new Error("scheduled write failure");
    },
    onWarning(warning) {
      warnings.push({ code: warning.code, provider: warning.provider });
      if (warning.code === "watch-failed") failed.resolve();
    },
  });
  try {
    await service.start();
    const file = join(f.roots.codex, "session_index.jsonl");
    writeFileSync(file, `${indexRecord("retry")}\n`);
    await failed.promise;
    await service.stop();
    expect(warnings).toEqual([
      { code: "watch-failed", provider: "claude" },
      { code: "watch-failed", provider: "codex" },
    ]);
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file),
    ).toBeNull();
    rejectWrite = false;
    await service.start();
    await service.stop();
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file)?.byteOffset,
    ).toBeGreaterThan(0);
  } finally {
    await service.stop();
    f.cleanup();
  }
});
