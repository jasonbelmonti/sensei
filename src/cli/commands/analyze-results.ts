import type { SenseiAnalyzeCommandSummary } from "../../analysis";
import { TURN_FEATURE_SKIP_REASONS } from "../../analysis";
import {
	createCommandResult,
	stderrLine,
	stdoutLine,
} from "../command-results";
import type { SenseiCliCommandResult } from "../types";

const analyzeUsageLine = "Usage: sensei analyze";
const analyzeHelpHintLine =
	"Run 'sensei analyze --help' to inspect the available behavior.";
const analyzeHelpLines = [
	stdoutLine("sensei analyze"),
	stdoutLine(analyzeUsageLine),
	stdoutLine(""),
	stdoutLine(
		"Run deterministic feature extraction over canonical turns and persist current-version rows.",
	),
] as const;

export function createAnalyzeHelpResult(): SenseiCliCommandResult {
	return createCommandResult(0, analyzeHelpLines);
}

export function createAnalyzeUsageErrorResult(
	errorMessage: string,
): SenseiCliCommandResult {
	return createCommandResult(1, [
		stderrLine(errorMessage),
		stderrLine(analyzeUsageLine),
		stderrLine(analyzeHelpHintLine),
	]);
}

export function createAnalyzeSuccessResult(
	summary: SenseiAnalyzeCommandSummary,
): SenseiCliCommandResult {
	return createCommandResult(0, [
		stdoutLine("sensei analyze completed."),
		stdoutLine(`Feature version: ${summary.featureVersion}`),
		stdoutLine(`Analyzed at: ${summary.analyzedAt}`),
		stdoutLine(`Turns loaded: ${summary.totalTurns}`),
		stdoutLine(`Eligible turns: ${summary.eligibleTurns}`),
		stdoutLine(`Skipped turns: ${summary.skippedTurns}`),
		...TURN_FEATURE_SKIP_REASONS.map((reason) =>
			stdoutLine(
				`${renderSkipReasonLabel(reason)}: ${summary.skippedByReason[reason]}`,
			),
		),
		stdoutLine(`Turn features persisted: ${summary.persistedRows}`),
	]);
}

export function createAnalyzeFailureResult(
	error: unknown,
): SenseiCliCommandResult {
	return createCommandResult(1, [
		stderrLine("sensei analyze failed."),
		stderrLine(renderErrorMessage(error)),
	]);
}

function renderSkipReasonLabel(
	reason: (typeof TURN_FEATURE_SKIP_REASONS)[number],
) {
	switch (reason) {
		case "missing-prompt-input":
			return "Skipped missing prompt turns";
		case "blank-prompt-input":
			return "Skipped blank prompt turns";
	}
}

function renderErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
