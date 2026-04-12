import { expect, test } from "bun:test";

import {
  createIngestCommandHandler,
  runAnalyzeCommand,
  runDraftCommand,
  runReportCommand,
} from "../../src/cli/commands";
import { createSenseiCliApplication } from "../../src/cli";
import type { SenseiCliCommandExecutionContext } from "../../src/cli/types";

const commandHandlers = [
  ["analyze", runAnalyzeCommand],
  ["report", runReportCommand],
  ["draft", runDraftCommand],
] as const;

function createExecutionContext(
  command: SenseiCliCommandExecutionContext["command"],
): SenseiCliCommandExecutionContext {
  return {
    command,
    args: [],
    cli: createSenseiCliApplication({
      repoRoot: "/repo/sensei",
    }).context,
  };
}

test("ingest command requires the explicit scan subcommand", async () => {
  const result = await createIngestCommandHandler()(createExecutionContext("ingest"));

  expect(result.exitCode).toBe(1);
  expect(result.lines).toEqual([
    {
      channel: "stderr",
      text: "Missing ingest subcommand.",
    },
    {
      channel: "stderr",
      text: "Usage: sensei ingest scan",
    },
    {
      channel: "stderr",
      text: "Run 'sensei ingest --help' to inspect the available subcommands.",
    },
  ]);
});

test("ingest command rejects unsupported subcommands", async () => {
  const result = await createIngestCommandHandler()({
    ...createExecutionContext("ingest"),
    args: ["watch"],
  });

  expect(result.exitCode).toBe(1);
  expect(result.lines).toEqual([
    {
      channel: "stderr",
      text: "Unsupported ingest subcommand 'watch'.",
    },
    {
      channel: "stderr",
      text: "Usage: sensei ingest scan",
    },
    {
      channel: "stderr",
      text: "Run 'sensei ingest --help' to inspect the available subcommands.",
    },
  ]);
});

test("ingest command renders scan summaries returned by the scan service", async () => {
  const result = await createIngestCommandHandler({
    async runSenseiIngestScanCommand() {
      return {
        rootCount: 2,
        discoveryEventCount: 1,
        writeSummary: {
          processedRecords: 3,
          sessionWrites: 1,
          turnWrites: 1,
          turnUsageWrites: 1,
          toolEventWrites: 0,
          cursorWrites: 2,
          warningWrites: 0,
        },
      };
    },
  })({
    ...createExecutionContext("ingest"),
    args: ["scan"],
  });

  expect(result.exitCode).toBe(0);
  expect(result.lines).toEqual([
    {
      channel: "stdout",
      text: "sensei ingest scan completed.",
    },
    {
      channel: "stdout",
      text: "Roots scanned: 2",
    },
    {
      channel: "stdout",
      text: "Discovery events: 1",
    },
    {
      channel: "stdout",
      text: "Processed records: 3",
    },
    {
      channel: "stdout",
      text: "Sessions written: 1",
    },
    {
      channel: "stdout",
      text: "Turns written: 1",
    },
    {
      channel: "stdout",
      text: "Turn usage written: 1",
    },
    {
      channel: "stdout",
      text: "Tool events written: 0",
    },
    {
      channel: "stdout",
      text: "Cursors written: 2",
    },
    {
      channel: "stdout",
      text: "Warnings recorded: 0",
    },
  ]);
});

for (const [commandName, handler] of commandHandlers) {
  test(`${commandName} command shell returns a failing placeholder result`, async () => {
    const result = await handler(createExecutionContext(commandName));

    expect(result.exitCode).toBe(1);
    expect(result.lines).toEqual([
      {
        channel: "stderr",
        text: `Command group '${commandName}' is not implemented yet.`,
      },
      {
        channel: "stderr",
        text: `Command dispatch is active; '${commandName}' still uses a placeholder shell.`,
      },
    ]);
  });
}
