import type {
  SenseiCliCommandExecutionContext,
  SenseiCliCommandHandler,
  SenseiCliCommandResult,
} from "../types";

function createStderrLine(text: string) {
  return {
    channel: "stderr" as const,
    text,
  };
}

function createUnimplementedCommandResult(
  context: SenseiCliCommandExecutionContext,
): SenseiCliCommandResult {
  return {
    exitCode: 1,
    lines: [
      createStderrLine(`Command group '${context.command}' is not implemented yet.`),
      createStderrLine(
        `Thin shell for '${context.command}' is in place; dispatcher wiring lands in BEL-660.`,
      ),
    ],
  };
}

export function createUnimplementedCommandShell(): SenseiCliCommandHandler {
  return (context) => createUnimplementedCommandResult(context);
}
