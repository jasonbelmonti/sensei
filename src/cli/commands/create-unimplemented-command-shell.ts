import { createCommandResult, stderrLine } from "../command-results";
import type {
  SenseiCliCommandExecutionContext,
  SenseiCliCommandHandler,
} from "../types";

export function createUnimplementedCommandShell(): SenseiCliCommandHandler {
  return (context: SenseiCliCommandExecutionContext) =>
    createCommandResult(1, [
      stderrLine(`Command group '${context.command}' is not implemented yet.`),
      stderrLine(
        `Command dispatch is active; '${context.command}' still uses a placeholder shell.`,
      ),
    ]);
}
