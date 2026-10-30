import { spawn } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { openSenseiStorage } from "../../src/storage/index.js";
import { runPackageCliCommand, smokeTestRootDir } from "./helpers.js";

test("compiled scan/watch resumes real files, completes a partial line and shuts down cleanly", async () => {
  const root = mkdtempSync(join(tmpdir(), "sensei-cli-watch-"));
  const env = {
    ...process.env,
    SENSEI_HOME: join(root, "home"),
    SENSEI_CLAUDE_ROOT: join(root, "claude"),
    SENSEI_CODEX_ROOT: join(root, "codex"),
    SENSEI_INGEST_WATCH_INTERVAL_MS: "10",
  };
  for (const provider of ["claude", "codex"]) {
    cpSync(
      join(
        smokeTestRootDir,
        "test/fixtures/legacy-ingest/compatibility",
        provider,
      ),
      join(root, provider),
      { recursive: true },
    );
  }
  const databasePath = join(env.SENSEI_HOME, "data/sensei.sqlite");
  const inspect = <T>(
    read: (storage: ReturnType<typeof openSenseiStorage>) => T,
  ) => {
    const storage = openSenseiStorage({ databasePath, readonly: true });
    try {
      return read(storage);
    } finally {
      storage.close();
    }
  };
  try {
    const scan = runPackageCliCommand(["ingest", "scan"], { env, cwd: root });
    expect(scan.status, scan.stderr).toBe(0);
    expect(
      inspect((s) =>
        s.database.query("SELECT count(*) AS count FROM sessions").get(),
      ),
    ).toEqual({ count: 6 });
    const beforeWarnings = inspect((s) => s.ingestState.listWarnings().length);
    for (let run = 0; run < 2; run += 1) {
      const child = spawn(
        process.execPath,
        [join(smokeTestRootDir, "dist/cli/main.js"), "ingest", "watch"],
        { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      const exited = new Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      try {
        await vi.waitFor(
          () => {
            expect(stdout).toContain("sensei ingest watch is running.");
          },
          { timeout: 3000, interval: 10 },
        );
        if (run === 0) {
          // Verified scan checkpoints must transfer to watch without replay warnings.
          expect(inspect((s) => s.ingestState.listWarnings().length)).toBe(
            beforeWarnings,
          );
          appendFileSync(
            join(root, "codex/session_index.jsonl"),
            '{"id":"appended",',
          );
          await vi.waitFor(
            () => {
              expect(
                inspect((s) =>
                  s.ingestState
                    .listWarnings()
                    .some((w) => w.message.includes("remains pending")),
                ),
              ).toBe(true);
            },
            { timeout: 3000, interval: 10 },
          );
          expect(
            inspect((s) => s.conversations.getSession("codex", "appended")),
          ).toBeNull();
        } else {
          appendFileSync(
            join(root, "codex/session_index.jsonl"),
            '"thread_name":"Appended task","updated_at":"2026-10-01T00:00:00.000Z"}\n',
          );
          await vi.waitFor(
            () => {
              expect(
                inspect(
                  (s) =>
                    s.conversations.getSession("codex", "appended")?.metadata,
                ),
              ).toMatchObject({ threadName: "Appended task" });
            },
            { timeout: 3000, interval: 10 },
          );
        }
        child.kill("SIGTERM");
        await vi.waitFor(
          () => {
            expect(child.exitCode).toBe(0);
          },
          { timeout: 3000, interval: 10 },
        );
        expect(await exited).toEqual({ code: 0, signal: null });
        expect(stderr).toBe("");
        expect(stdout).toContain("sensei ingest watch stopped.");
      } finally {
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
        await exited;
      }
    }
    expect(
      inspect((s) =>
        s.database.query("SELECT count(*) AS count FROM turns").get(),
      ),
    ).toEqual({ count: 2 });
    expect(
      inspect((s) =>
        s.database.query("SELECT count(*) AS count FROM sessions").get(),
      ),
    ).toEqual({ count: 7 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 10000);
