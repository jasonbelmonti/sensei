import {
  appendFileSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createStoredService } from "./owned-service.fixture.js";
import {
  createRealIngestFixture,
  legacyFixtureRoot,
} from "./real-ingest.fixture.js";

for (const family of ["codex", "claude", "index"] as const) {
  test(`${family} leaves an incomplete UTF-8 line pending and recovers it after append/restart`, async () => {
    const f = createRealIngestFixture(false);
    try {
      const provider = family === "claude" ? "claude" : "codex";
      const file = join(
        f.roots[provider],
        family === "index" ? "session_index.jsonl" : "transcript.jsonl",
      );
      const prefix =
        family === "codex"
          ? [
              { type: "session_meta", payload: { id: "partial-session" } },
              {
                type: "event_msg",
                payload: { type: "task_started", turn_id: "partial-turn" },
              },
            ]
              .map((r) => `${JSON.stringify(r)}\n`)
              .join("")
          : "";
      const record =
        family === "index"
          ? {
              id: "partial-session",
              thread_name: "Inspect café 🔍",
              updated_at: "2026-10-01T00:00:00.000Z",
            }
          : family === "claude"
            ? {
                type: "user",
                session_id: "partial-session",
                message: { content: "Inspect café 🔍" },
              }
            : {
                type: "event_msg",
                payload: { type: "user_message", message: "Inspect café 🔍" },
              };
      const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
      const split = bytes.indexOf(Buffer.from("🔍")) + 2;
      writeFileSync(
        file,
        Buffer.concat([Buffer.from(prefix), bytes.subarray(0, split)]),
      );
      await createStoredService(f).scanNow();
      expect(
        f.storage.ingestState.getCursor(provider, f.roots[provider], file)
          ?.byteOffset ?? 0,
      ).toBe(Buffer.byteLength(prefix));
      appendFileSync(file, bytes.subarray(split));
      const events: string[] = [];
      await createStoredService(f, {
        onRecord(record) {
          if (record.kind === "event" && record.event.type === "turn.started")
            events.push(record.event.input.prompt);
        },
      }).scanNow();
      if (family === "index")
        expect(
          f.storage.conversations.getSession("codex", "partial-session")
            ?.metadata,
        ).toMatchObject({ threadName: "Inspect café 🔍" });
      else expect(events).toEqual(["Inspect café 🔍"]);
      expect(
        f.storage.ingestState.getCursor(provider, f.roots[provider], file)
          ?.byteOffset,
      ).toBe(Buffer.byteLength(prefix) + bytes.length);
      expect(
        f.storage.ingestState.listWarnings().map((w) => w.message),
      ).toEqual(["Incomplete final JSONL record remains pending"]);
    } finally {
      f.cleanup();
    }
  });
}

test("malformed middle records are visible and do not swallow later valid records", async () => {
  const f = createRealIngestFixture(false);
  try {
    const file = join(f.roots.codex, "transcript.jsonl");
    const text = readFileSync(
      join(legacyFixtureRoot, "codex/transcript.jsonl"),
      "utf8",
    );
    writeFileSync(file, text.replace("\n", "\n{broken}\n"));
    await createStoredService(f).scanNow();
    expect(f.storage.ingestState.listWarnings().map((w) => w.code)).toEqual([
      "parse-failed",
    ]);
    expect(
      f.storage.conversations.getTurn("codex", "legacy-codex", "turn-ok")
        ?.status,
    ).toBe("completed");
  } finally {
    f.cleanup();
  }
});

for (const replacement of ["truncate", "rotate", "rewrite"] as const) {
  test(`${replacement} resets progress, stores a lower cursor and preserves prior rows`, async () => {
    const f = createRealIngestFixture(false);
    try {
      const file = join(f.roots.codex, "session_index.jsonl");
      const old = `${JSON.stringify({ id: "old", thread_name: "An intentionally long prior title", updated_at: "2026-10-01T00:00:00.000Z" })}\n`;
      writeFileSync(file, old);
      const service = createStoredService(f);
      await service.scanNow();
      if (replacement === "rotate") renameSync(file, `${file}.old`);
      const next = `${JSON.stringify({ id: "new", thread_name: "New", updated_at: "2026-10-01T00:00:00.000Z" })}\n`;
      writeFileSync(
        file,
        replacement === "rewrite" ? next.padEnd(old.length, " ") : next,
      );
      await service.reconcileNow();
      expect(f.storage.conversations.getSession("codex", "old")).not.toBeNull();
      expect(f.storage.conversations.getSession("codex", "new")).not.toBeNull();
      expect(
        f.storage.ingestState.getCursor("codex", f.roots.codex, file)
          ?.byteOffset,
      ).toBe(
        replacement === "rewrite"
          ? Buffer.byteLength(old)
          : Buffer.byteLength(next),
      );
      expect(f.storage.ingestState.listWarnings().map((w) => w.code)).toContain(
        replacement === "rotate"
          ? "rotated-file"
          : replacement === "truncate"
            ? "truncated-file"
            : "cursor-reset",
      );
      const warnings = f.storage.ingestState.listWarnings();
      await createStoredService(f).scanNow();
      expect(f.storage.ingestState.listWarnings()).toEqual(warnings);
    } finally {
      f.cleanup();
    }
  });
}
