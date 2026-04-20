import type { SenseiIngestScanCommandSummary } from "../../ingest/scan-command";
import type { SenseiIngestWatchCommandSummary } from "../../ingest/watch-command";
import { writeCliResult } from "../command-results";
import {
	createIngestHelpResult,
	createIngestUsageErrorResult,
	createScanFailureResult,
	createScanSuccessResult,
	createWatchFailureResult,
	createWatchRunningResult,
	createWatchStoppedResult,
} from "./ingest-results";
import type {
	SenseiCliCommandExecutionContext,
	SenseiCliCommandHandler,
} from "../types";

type RunSenseiIngestScan = (
	config: SenseiCliCommandExecutionContext["cli"]["config"],
) => Promise<SenseiIngestScanCommandSummary>;
type RunSenseiIngestWatch = (
	config: SenseiCliCommandExecutionContext["cli"]["config"],
	options?: {
		onStarted?: (
			summary: SenseiIngestWatchCommandSummary,
		) => Promise<void> | void;
	},
) => Promise<SenseiIngestWatchCommandSummary>;

export type CreateIngestCommandHandlerOptions = {
	runSenseiIngestScanCommand?: RunSenseiIngestScan;
	runSenseiIngestWatchCommand?: RunSenseiIngestWatch;
};

export function createIngestCommandHandler(
	options: CreateIngestCommandHandlerOptions = {},
): SenseiCliCommandHandler {
	const runScan =
		options.runSenseiIngestScanCommand ?? defaultRunSenseiIngestScanCommand;
	const runWatch =
		options.runSenseiIngestWatchCommand ?? defaultRunSenseiIngestWatchCommand;

	return async ({ cli, args }) => {
		const [subcommand, ...remainingArgs] = args;

		if (!subcommand) {
			return createIngestUsageErrorResult("Missing ingest subcommand.");
		}

		if (isHelpArgument(subcommand)) {
			return createIngestHelpResult();
		}

		if (subcommand !== "scan" && subcommand !== "watch") {
			return createIngestUsageErrorResult(
				`Unsupported ingest subcommand '${subcommand}'.`,
			);
		}

		if (remainingArgs.length > 0) {
			return createIngestUsageErrorResult(
				`The '${subcommand}' subcommand does not accept additional arguments yet.`,
			);
		}

		switch (subcommand) {
			case "scan":
				return runScanSubcommand(cli.config, runScan);
			case "watch":
				return runWatchSubcommand(cli, runWatch);
		}
	};
}

export const runIngestCommand = createIngestCommandHandler();

function isHelpArgument(value: string): boolean {
	return value === "--help" || value === "-h" || value === "help";
}

async function runScanSubcommand(
	config: SenseiCliCommandExecutionContext["cli"]["config"],
	runScan: RunSenseiIngestScan,
) {
	try {
		return createScanSuccessResult(await runScan(config));
	} catch (error) {
		return createScanFailureResult(error);
	}
}

async function runWatchSubcommand(
	cli: SenseiCliCommandExecutionContext["cli"],
	runWatch: RunSenseiIngestWatch,
) {
	try {
		await runWatch(cli.config, {
			onStarted(summary) {
				writeCliResult(cli, createWatchRunningResult(summary));
			},
		});

		return createWatchStoppedResult();
	} catch (error) {
		return createWatchFailureResult(error);
	}
}

async function defaultRunSenseiIngestScanCommand(
	config: SenseiCliCommandExecutionContext["cli"]["config"],
): Promise<SenseiIngestScanCommandSummary> {
	const { runSenseiIngestScanCommand } = await import(
		"../../ingest/scan-command"
	);

	return runSenseiIngestScanCommand(config);
}

async function defaultRunSenseiIngestWatchCommand(
	config: SenseiCliCommandExecutionContext["cli"]["config"],
	options?: {
		onStarted?: (
			summary: SenseiIngestWatchCommandSummary,
		) => Promise<void> | void;
	},
): Promise<SenseiIngestWatchCommandSummary> {
	const { runSenseiIngestWatchCommand } = await import(
		"../../ingest/watch-command"
	);

	return runSenseiIngestWatchCommand(config, options);
}
