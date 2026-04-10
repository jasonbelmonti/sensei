import type { SenseiEnvironment, SenseiRuntimeConfig } from "../config";

export const senseiCommandNames = [
  "ingest",
  "analyze",
  "report",
  "draft",
] as const;

export type SenseiCliCommandName = (typeof senseiCommandNames)[number];

export type SenseiCliCommandDefinition = {
  name: SenseiCliCommandName;
  summary: string;
};

export type SenseiCliWriter = (line: string) => void;
export type SenseiCliOutputChannel = "stdout" | "stderr";

export type SenseiCliOutputLine = {
  channel: SenseiCliOutputChannel;
  text: string;
};

export type SenseiCliCommandResult = {
  exitCode: number;
  lines: readonly SenseiCliOutputLine[];
};

export type CreateSenseiCliApplicationOptions = {
  cwd?: string;
  repoRoot?: string;
  homeDir?: string;
  env?: SenseiEnvironment;
  stdout?: SenseiCliWriter;
  stderr?: SenseiCliWriter;
};

export type SenseiCliContext = {
  repoRoot: string;
  config: SenseiRuntimeConfig;
  commands: readonly SenseiCliCommandDefinition[];
  stdout: SenseiCliWriter;
  stderr: SenseiCliWriter;
};

export type SenseiCliCommandExecutionContext = {
  command: SenseiCliCommandName;
  args: readonly string[];
  cli: SenseiCliContext;
};

export type SenseiCliCommandHandler = (
  context: SenseiCliCommandExecutionContext,
) => Promise<SenseiCliCommandResult> | SenseiCliCommandResult;

export type SenseiCliApplication = {
  context: SenseiCliContext;
  run(argv: string[]): Promise<number>;
};
