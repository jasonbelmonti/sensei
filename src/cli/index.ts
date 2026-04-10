#!/usr/bin/env bun

import { resolve } from "node:path";

import { createSenseiConfig } from "../config";
import { senseiCommandGroups } from "./command-groups";
import {
  createCommandResult,
  stderrLine,
  stdoutLine,
  writeCliResult,
} from "./command-results";
import { senseiCliCommandHandlers } from "./commands";
import type {
  CreateSenseiCliApplicationOptions,
  SenseiCliApplication,
  SenseiCliCommandResult,
  SenseiCliWriter,
} from "./types";
import { senseiCommandNames } from "./types";

export { senseiCommandGroups } from "./command-groups";

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
    stdout,
    stderr,
  };

  return {
    context,
    async run(argv) {
      const [firstArg, ...remainingArgs] = argv;
      const result = await resolveCliResult(context, firstArg, remainingArgs);

      writeCliResult(context, result);
      return result.exitCode;
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
  context: SenseiCliApplication["context"],
): SenseiCliCommandResult {
  return createCommandResult(0, [
    stdoutLine("sensei CLI"),
    stdoutLine("Usage: sensei <command> [args]"),
    stdoutLine(""),
    stdoutLine("Registered command groups:"),
    ...context.commands.map((command) =>
      stdoutLine(`  ${command.name.padEnd(7)} ${command.summary}`),
    ),
    stdoutLine(""),
    stdoutLine(`Repository root: ${context.repoRoot}`),
    stdoutLine(`Sensei home: ${context.config.paths.homeRoot}`),
  ]);
}

function isHelpArgument(value: string): boolean {
  return value === "--help" || value === "-h" || value === "help";
}

function isKnownCommand(value: string): value is (typeof senseiCommandNames)[number] {
  return senseiCommandNames.includes(value as (typeof senseiCommandNames)[number]);
}

async function resolveCliResult(
  context: SenseiCliApplication["context"],
  firstArg: string | undefined,
  remainingArgs: readonly string[],
): Promise<SenseiCliCommandResult> {
  if (!firstArg || isHelpArgument(firstArg)) {
    return renderHelp(context);
  }

  if (isKnownCommand(firstArg)) {
    return senseiCliCommandHandlers[firstArg]({
      command: firstArg,
      args: remainingArgs,
      cli: context,
    });
  }

  return createUnknownCommandResult(firstArg);
}

function createUnknownCommandResult(commandName: string): SenseiCliCommandResult {
  return createCommandResult(1, [
    stderrLine(`Unknown command '${commandName}'.`),
    stderrLine("Run 'sensei --help' to inspect the registered command groups."),
  ]);
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
