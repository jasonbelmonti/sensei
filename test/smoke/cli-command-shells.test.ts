import { expect, test } from "bun:test";

import {
  runAnalyzeCommand,
  runDraftCommand,
  runIngestCommand,
  runReportCommand,
} from "../../src/cli/commands";
import { createSenseiCliApplication } from "../../src/cli";
import type { SenseiCliCommandExecutionContext } from "../../src/cli/types";

const commandHandlers = [
  ["ingest", runIngestCommand],
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
        text: `Thin shell for '${commandName}' is in place; dispatcher wiring lands in BEL-660.`,
      },
    ]);
  });
}
