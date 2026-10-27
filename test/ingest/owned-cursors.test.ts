import { appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { IngestCursor } from "../../src/ingest/contracts.js";
import { createStoredService } from "./owned-service.fixture.js";
import {
  createRealIngestFixture,
  legacyFixtureRoot,
} from "./real-ingest.fixture.js";

test("frozen incumbent EOF cursors visibly replay all four families without losing rows", async () => {
  const f = createRealIngestFixture();
  try {
    const cursors: IngestCursor[] = JSON.parse(
      readFileSync(
        join(legacyFixtureRoot, "legacy-cursors.json"),
        "utf8",
      ).replaceAll("<fixture>", f.rootDir),
    );
    for (const cursor of cursors) {
      const stat = statSync(cursor.filePath);
      f.storage.ingestState.setCursor({
        ...cursor,
        fingerprint: `${stat.dev}:${stat.ino}`,
      });
    }
    await createStoredService(f).scanNow();
    expect(
      f.storage.database.query("SELECT count(*) AS count FROM turns").get(),
    ).toEqual({ count: 2 });
    expect(
      f.storage.database
        .query("SELECT count(*) AS count FROM tool_events")
        .get(),
    ).toEqual({ count: 2 });
    expect(
      f.storage.database.query("SELECT count(*) AS count FROM sessions").get(),
    ).toEqual({ count: 6 });
    expect(
      f.storage.ingestState
        .listWarnings()
        .filter((w) => w.code === "cursor-reset"),
    ).toHaveLength(6);
    const warnings = f.storage.ingestState.listWarnings();
    await createStoredService(f).scanNow();
    expect(f.storage.ingestState.listWarnings()).toEqual(warnings);
  } finally {
    f.cleanup();
  }
});

test("owned cursors retain pending Codex tool/turn state across append and service restart", async () => {
  const f = createRealIngestFixture(false);
  try {
    const file = join(f.roots.codex, "transcript.jsonl");
    const lines = readFileSync(
      join(legacyFixtureRoot, "codex/transcript.jsonl"),
      "utf8",
    ).split("\n");
    writeFileSync(file, `${lines.slice(0, 5).join("\n")}\n`);
    await createStoredService(f).scanNow();
    const before = f.storage.ingestState.getCursor(
      "codex",
      f.roots.codex,
      file,
    );
    expect(before?.metadata?.senseiReaderVersion).toBe("codex/transcript/1");
    expect(before?.line).toBe(5);
    appendFileSync(file, lines.slice(5).join("\n"));
    await createStoredService(f).scanNow();
    expect(
      f.storage.conversations.getTurn("codex", "legacy-codex", "turn-ok"),
    ).toMatchObject({
      status: "completed",
      input: { prompt: "Check the saved search results." },
      output: { text: "Search results checked." },
    });
    expect(
      f.storage.database
        .query(
          "SELECT tool_name, outcome FROM tool_events WHERE tool_call_id = 'tool-ok'",
        )
        .get(),
    ).toEqual({ tool_name: "command_execution", outcome: "success" });
    expect(
      f.storage.database
        .query("SELECT input_tokens, output_tokens FROM turn_usage")
        .get(),
    ).toEqual({ input_tokens: 21, output_tokens: 8 });
    expect(f.storage.ingestState.listWarnings()).toEqual([]);
    // Reader upgrades must revisit an unchanged EOF; byte continuity alone cannot qualify state.
    const current = f.storage.ingestState.getCursor(
      "codex",
      f.roots.codex,
      file,
    );
    if (!current) throw new Error("Missing cursor");
    f.storage.ingestState.setCursor({
      ...current,
      metadata: {
        ...current.metadata,
        senseiReaderVersion: "codex/transcript/0",
      },
    });
    await createStoredService(f).scanNow();
    expect(f.storage.ingestState.listWarnings().map((w) => w.code)).toEqual([
      "cursor-reset",
    ]);
    expect(
      f.storage.database.query("SELECT count(*) AS count FROM turns").get(),
    ).toEqual({ count: 2 });
  } finally {
    f.cleanup();
  }
});

test("a real SQLite callback failure cannot acknowledge the failed tool record", async () => {
  const f = createRealIngestFixture(false);
  try {
    const file = join(f.roots.codex, "transcript.jsonl");
    const text = readFileSync(
      join(legacyFixtureRoot, "codex/transcript.jsonl"),
      "utf8",
    );
    writeFileSync(file, text);
    f.storage.database.exec(
      "CREATE TRIGGER fail_tool BEFORE INSERT ON tool_events WHEN NEW.tool_call_id = 'tool-error' BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END",
    );
    await expect(createStoredService(f).scanNow()).rejects.toThrow(
      "injected storage failure",
    );
    const cursor = f.storage.ingestState.getCursor(
      "codex",
      f.roots.codex,
      file,
    );
    expect(cursor?.byteOffset).toBe(
      Buffer.byteLength(`${text.split("\n").slice(0, 6).join("\n")}\n`),
    );
    expect(
      f.storage.database
        .query(
          "SELECT count(*) AS count FROM tool_events WHERE tool_call_id = 'tool-error'",
        )
        .get(),
    ).toEqual({ count: 0 });
    f.storage.database.exec("DROP TRIGGER fail_tool");
    await createStoredService(f).scanNow();
    expect(
      f.storage.database
        .query(
          "SELECT tool_name, outcome FROM tool_events WHERE tool_call_id = 'tool-error'",
        )
        .get(),
    ).toEqual({ tool_name: "apply_patch", outcome: "error" });
    expect(
      f.storage.conversations.getTurn("codex", "legacy-codex", "turn-ok")
        ?.status,
    ).toBe("completed");
  } finally {
    f.cleanup();
  }
});

test("snapshot replay at EOF resumes after a callback failure and clears pending replay", async () => {
  const f = createRealIngestFixture(false);
  try {
    const file = join(f.roots.claude, "snapshot.json");
    writeFileSync(
      file,
      readFileSync(join(legacyFixtureRoot, "claude/snapshot.json")),
    );
    const delivered: string[] = [];
    let fail = true;
    const options = {
      onRecord: async (
        record: import("../../src/ingest/contracts.js").ObservedIngestRecord,
      ) => {
        if (record.kind !== "event") return;
        if (fail && record.event.type === "message.completed")
          throw new Error("snapshot callback failed");
        delivered.push(record.event.type);
      },
    };
    await expect(createStoredService(f, options).scanNow()).rejects.toThrow(
      "snapshot callback failed",
    );
    expect(
      f.storage.ingestState.getCursor("claude", f.roots.claude, file)?.metadata
        ?.claudeSnapshotReplayIndex,
    ).toBe(1);
    fail = false;
    await createStoredService(f, options).scanNow();
    await createStoredService(f, options).scanNow();
    expect(delivered).toEqual([
      "turn.started",
      "message.completed",
      "turn.completed",
    ]);
    expect(
      f.storage.ingestState.getCursor("claude", f.roots.claude, file)?.metadata
        ?.claudeSnapshotReplayIndex,
    ).toBeUndefined();
  } finally {
    f.cleanup();
  }
});

test("failure in a second observation at the same JSONL offset replays the complete line", async () => {
  const f = createRealIngestFixture(false);
  try {
    const file = join(f.roots.codex, "transcript.jsonl");
    const text = `${JSON.stringify({ type: "session_meta", payload: { id: "single-line" } })}\n`;
    writeFileSync(file, text);
    await expect(
      createStoredService(f, {
        onRecord(record) {
          if (record.kind === "session")
            throw new Error("explicit session callback failed");
        },
      }).scanNow(),
    ).rejects.toThrow("explicit session callback failed");
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file),
    ).toBeNull();
    const delivered: string[] = [];
    await createStoredService(f, {
      onRecord(record) {
        delivered.push(record.kind);
      },
    }).scanNow();
    expect(delivered).toEqual(["event", "session"]);
    expect(
      f.storage.ingestState.getCursor("codex", f.roots.codex, file)?.byteOffset,
    ).toBe(Buffer.byteLength(text));
    expect(
      f.storage.database.query("SELECT count(*) AS count FROM sessions").get(),
    ).toEqual({ count: 1 });
  } finally {
    f.cleanup();
  }
});
