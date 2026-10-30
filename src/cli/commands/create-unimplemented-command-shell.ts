import { createCommandResult, stderrLine } from "../command-results.js";
import type {
  SenseiCliCommandExecutionContext,
  SenseiCliCommandHandler,
} from "../types.js";

export function createUnimplementedCommandShell(): SenseiCliCommandHandler {
  return (context: SenseiCliCommandExecutionContext) =>
    createCommandResult(1, [
      stderrLine(`Command group '${context.command}' is not implemented yet.`),
      stderrLine(
        `Command dispatch is active; '${context.command}' still uses a placeholder shell.`,
      ),
    ]);
}
