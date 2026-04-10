import { expect, test } from "bun:test";

import {
  createSenseiCliApplication,
  senseiCommandGroups,
} from "../../src/cli/index";

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
    "Thin shell for 'ingest' is in place; dispatcher wiring lands in BEL-660.",
  ]);
});
