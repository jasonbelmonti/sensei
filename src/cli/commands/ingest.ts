import { runSenseiIngestScanCommand, type SenseiIngestScanCommandSummary } from "../../ingest";
import {
  createIngestHelpResult,
  createIngestUsageErrorResult,
  createScanFailureResult,
  createScanSuccessResult,
} from "./ingest-results";
import type {
  SenseiCliCommandExecutionContext,
  SenseiCliCommandHandler,
} from "../types";

type RunSenseiIngestScan = (
  config: SenseiCliCommandExecutionContext["cli"]["config"],
) => Promise<SenseiIngestScanCommandSummary>;

export type CreateIngestCommandHandlerOptions = {
  runSenseiIngestScanCommand?: RunSenseiIngestScan;
};

export function createIngestCommandHandler(
  options: CreateIngestCommandHandlerOptions = {},
): SenseiCliCommandHandler {
  const runScan = options.runSenseiIngestScanCommand ?? runSenseiIngestScanCommand;

  return async ({ cli, args }) => {
    const [subcommand, ...remainingArgs] = args;

    if (!subcommand) {
      return createIngestUsageErrorResult("Missing ingest subcommand.");
    }

    if (isHelpArgument(subcommand)) {
      return createIngestHelpResult();
    }

    if (subcommand !== "scan") {
      return createIngestUsageErrorResult(
        `Unsupported ingest subcommand '${subcommand}'.`,
      );
    }

    if (remainingArgs.length > 0) {
      return createIngestUsageErrorResult(
        "The 'scan' subcommand does not accept additional arguments yet.",
      );
    }

    try {
      return createScanSuccessResult(await runScan(cli.config));
    } catch (error) {
      return createScanFailureResult(error);
    }
  };
}

export const runIngestCommand = createIngestCommandHandler();

function isHelpArgument(value: string): boolean {
  return value === "--help" || value === "-h" || value === "help";
}
