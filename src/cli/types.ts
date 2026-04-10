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
};

export type SenseiCliApplication = {
  context: SenseiCliContext;
  run(argv: string[]): Promise<number>;
};
