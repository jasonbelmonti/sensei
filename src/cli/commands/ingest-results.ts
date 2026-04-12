import type { SenseiIngestScanCommandSummary } from "../../ingest";
import {
  createCommandResult,
  stderrLine,
  stdoutLine,
} from "../command-results";
import type { SenseiCliCommandResult } from "../types";

const ingestUsageLine = "Usage: sensei ingest scan";
const ingestHelpHintLine =
  "Run 'sensei ingest --help' to inspect the available subcommands.";
const ingestHelpLines = [
  stdoutLine("sensei ingest"),
  stdoutLine(ingestUsageLine),
  stdoutLine(""),
  stdoutLine("Available subcommands:"),
  stdoutLine("  scan   Backfill configured provider roots into canonical storage"),
] as const;

export function createIngestHelpResult(): SenseiCliCommandResult {
  return createCommandResult(0, ingestHelpLines);
}

export function createIngestUsageErrorResult(
  errorMessage: string,
): SenseiCliCommandResult {
  return createCommandResult(1, [
    stderrLine(errorMessage),
    stderrLine(ingestUsageLine),
    stderrLine(ingestHelpHintLine),
  ]);
}

export function createScanSuccessResult(
  summary: SenseiIngestScanCommandSummary,
): SenseiCliCommandResult {
  return createCommandResult(0, [
    stdoutLine("sensei ingest scan completed."),
    stdoutLine(`Roots scanned: ${summary.rootCount}`),
    stdoutLine(`Discovery events: ${summary.discoveryEventCount}`),
    stdoutLine(`Processed records: ${summary.writeSummary.processedRecords}`),
    stdoutLine(`Sessions written: ${summary.writeSummary.sessionWrites}`),
    stdoutLine(`Turns written: ${summary.writeSummary.turnWrites}`),
    stdoutLine(`Turn usage written: ${summary.writeSummary.turnUsageWrites}`),
    stdoutLine(`Tool events written: ${summary.writeSummary.toolEventWrites}`),
    stdoutLine(`Cursors written: ${summary.writeSummary.cursorWrites}`),
    stdoutLine(`Warnings recorded: ${summary.writeSummary.warningWrites}`),
  ]);
}

export function createScanFailureResult(error: unknown): SenseiCliCommandResult {
  return createCommandResult(1, [
    stderrLine("sensei ingest scan failed."),
    stderrLine(renderErrorMessage(error)),
  ]);
}

function renderErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
