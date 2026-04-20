import {
	runSenseiAnalyzeCommand,
	type SenseiAnalyzeCommandSummary,
} from "../../analysis";
import {
	createAnalyzeFailureResult,
	createAnalyzeHelpResult,
	createAnalyzeSuccessResult,
	createAnalyzeUsageErrorResult,
} from "./analyze-results";
import type {
	SenseiCliCommandExecutionContext,
	SenseiCliCommandHandler,
} from "../types";

type RunSenseiAnalyze = (
	config: SenseiCliCommandExecutionContext["cli"]["config"],
) => Promise<SenseiAnalyzeCommandSummary>;

export type CreateAnalyzeCommandHandlerOptions = {
	runSenseiAnalyzeCommand?: RunSenseiAnalyze;
};

export function createAnalyzeCommandHandler(
	options: CreateAnalyzeCommandHandlerOptions = {},
): SenseiCliCommandHandler {
	const runAnalyze = options.runSenseiAnalyzeCommand ?? runSenseiAnalyzeCommand;

	return async ({ cli, args }) => {
		const [firstArg, ...remainingArgs] = args;

		if (firstArg && isHelpArgument(firstArg)) {
			return createAnalyzeHelpResult();
		}

		if (firstArg !== undefined || remainingArgs.length > 0) {
			return createAnalyzeUsageErrorResult(
				"The analyze command does not accept positional arguments yet.",
			);
		}

		try {
			return createAnalyzeSuccessResult(await runAnalyze(cli.config));
		} catch (error) {
			return createAnalyzeFailureResult(error);
		}
	};
}

export const runAnalyzeCommand = createAnalyzeCommandHandler();

function isHelpArgument(value: string): boolean {
	return value === "--help" || value === "-h" || value === "help";
}
