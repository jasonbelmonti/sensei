import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSenseiCliApplication,
  senseiCommandGroups,
} from "../../src/cli/index";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function runPackageCliCommand(args: readonly string[]) {
  return spawnSync(process.execPath, ["run", "sensei", "--", ...args], {
    cwd: rootDir,
    encoding: "utf8",
  });
}

test("cli help renders the registered command groups with injected config", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const app = createSenseiCliApplication({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/sensei",
    env: {
      SENSEI_HOME: ".sensei-dev",
    },
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });

  const exitCode = await app.run(["--help"]);

  expect(exitCode).toBe(0);
  expect(stderr).toEqual([]);
  expect(app.context.config.paths.homeRoot).toBe("/Users/sensei/.sensei-dev");
  expect(stdout.join("\n")).toContain("sensei CLI");
  expect(stdout.join("\n")).toContain("Registered command groups:");

  for (const command of senseiCommandGroups) {
    expect(stdout.join("\n")).toContain(command.name);
    expect(stdout.join("\n")).toContain(command.summary);
  }
});

test("cli rejects unknown commands with a useful error", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const app = createSenseiCliApplication({
    repoRoot: "/repo/sensei",
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });

  const exitCode = await app.run(["mystery"]);

  expect(exitCode).toBe(1);
  expect(stdout).toEqual([]);
  expect(stderr).toEqual([
    "Unknown command 'mystery'.",
    "Run 'sensei --help' to inspect the registered command groups.",
  ]);
});

test("registered command groups dispatch through the command shell modules", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const app = createSenseiCliApplication({
    repoRoot: "/repo/sensei",
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });

  const exitCode = await app.run(["ingest"]);

  expect(exitCode).toBe(1);
  expect(stdout).toEqual([]);
  expect(stderr).toEqual([
    "Command group 'ingest' is not implemented yet.",
    "Command dispatch is active; 'ingest' still uses a placeholder shell.",
  ]);
});

test("package-level CLI script renders help from the repo root", () => {
  const result = runPackageCliCommand(["--help"]);

  expect(result.status).toBe(0);
  expect(result.stderr).not.toContain('error: script "sensei" exited');
  expect(result.stdout).toContain("sensei CLI");
  expect(result.stdout).toContain("Registered command groups:");

  for (const command of senseiCommandGroups) {
    expect(result.stdout).toContain(command.name);
    expect(result.stdout).toContain(command.summary);
  }
});

test("package-level CLI script dispatches a placeholder command shell", () => {
  const result = runPackageCliCommand(["ingest"]);
  const stderrLines = result.stderr.trim().split("\n");

  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(stderrLines).toContain("Command group 'ingest' is not implemented yet.");
  expect(stderrLines).toContain(
    "Command dispatch is active; 'ingest' still uses a placeholder shell.",
  );
});
