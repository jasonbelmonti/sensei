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
        `Thin shell for '${context.command}' is in place; dispatcher wiring lands in BEL-660.`,
      ),
    ]);
}
