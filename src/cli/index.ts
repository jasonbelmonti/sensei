#!/usr/bin/env bun

import { resolve } from "node:path";

import { createSenseiConfig } from "../config";
import type {
  CreateSenseiCliApplicationOptions,
  SenseiCliApplication,
  SenseiCliCommandDefinition,
  SenseiCliWriter,
} from "./types";
import { senseiCommandNames } from "./types";

export const senseiCommandGroups = [
  {
    name: "ingest",
    summary: "Backfill or observe local Claude and Codex history.",
  },
  {
    name: "analyze",
    summary: "Run deterministic feature extraction and mentoring analysis.",
  },
  {
    name: "report",
    summary: "Render operator-facing summaries over stored insights.",
  },
  {
    name: "draft",
    summary: "Prepare reviewable draft skills, scripts, and automations.",
  },
] as const satisfies ReadonlyArray<SenseiCliCommandDefinition>;

export function createSenseiCliApplication(
  options: CreateSenseiCliApplicationOptions = {},
): SenseiCliApplication {
  const repoRoot = resolve(options.repoRoot ?? options.cwd ?? process.cwd());
  const stdout = options.stdout ?? createStreamWriter(process.stdout);
  const stderr = options.stderr ?? createStreamWriter(process.stderr);

  const context = {
    repoRoot,
    config: createSenseiConfig({
      repoRoot,
      homeDir: options.homeDir,
      env: options.env,
    }),
    commands: [...senseiCommandGroups],
  };

  return {
    context,
    async run(argv) {
      const [firstArg] = argv;

      if (!firstArg || isHelpArgument(firstArg)) {
        renderHelp(stdout, context);
        return 0;
      }

      if (isKnownCommand(firstArg)) {
        stdout(
          `Command group '${firstArg}' is registered. Command shell wiring lands in BEL-648.`,
        );
        return 0;
      }

      stderr(`Unknown command '${firstArg}'.`);
      stderr("Run 'sensei --help' to inspect the registered command groups.");
      return 1;
    },
  };
}

export async function runSenseiCli(
  argv: string[],
  options?: CreateSenseiCliApplicationOptions,
): Promise<number> {
  const application = createSenseiCliApplication(options);
  return application.run(argv);
}

function renderHelp(
  writeLine: SenseiCliWriter,
  context: SenseiCliApplication["context"],
): void {
  writeLine("sensei CLI");
  writeLine("Usage: sensei <command> [args]");
  writeLine("");
  writeLine("Registered command groups:");

  for (const command of context.commands) {
    writeLine(`  ${command.name.padEnd(7)} ${command.summary}`);
  }

  writeLine("");
  writeLine(`Repository root: ${context.repoRoot}`);
  writeLine(`Sensei home: ${context.config.paths.homeRoot}`);
}

function isHelpArgument(value: string): boolean {
  return value === "--help" || value === "-h" || value === "help";
}

function isKnownCommand(value: string): value is (typeof senseiCommandNames)[number] {
  return senseiCommandNames.includes(value as (typeof senseiCommandNames)[number]);
}

function createStreamWriter(stream: NodeJS.WriteStream): SenseiCliWriter {
  return (line) => {
    stream.write(`${line}\n`);
  };
}

if (import.meta.main) {
  const exitCode = await runSenseiCli(Bun.argv.slice(2));
  process.exitCode = exitCode;
}
