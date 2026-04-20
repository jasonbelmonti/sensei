import { expect, test } from "bun:test";

import {
	createIngestCommandHandler,
	createAnalyzeCommandHandler,
	runDraftCommand,
	runReportCommand,
} from "../../src/cli/commands";
import { createSenseiCliApplication } from "../../src/cli";
import type { SenseiCliCommandExecutionContext } from "../../src/cli/types";

const commandHandlers = [
	["report", runReportCommand],
	["draft", runDraftCommand],
] as const;

function createExecutionContext(
	command: SenseiCliCommandExecutionContext["command"],
): {
	context: SenseiCliCommandExecutionContext;
	stdout: string[];
	stderr: string[];
} {
	const stdout: string[] = [];
	const stderr: string[] = [];

	return {
		stdout,
		stderr,
		context: {
			command,
			args: [],
			cli: createSenseiCliApplication({
				repoRoot: "/repo/sensei",
				stdout: (line) => stdout.push(line),
				stderr: (line) => stderr.push(line),
			}).context,
		},
	};
}

test("ingest command requires the explicit scan subcommand", async () => {
	const { context } = createExecutionContext("ingest");
	const result = await createIngestCommandHandler()(context);

	expect(result.exitCode).toBe(1);
	expect(result.lines).toEqual([
		{
			channel: "stderr",
			text: "Missing ingest subcommand.",
		},
		{
			channel: "stderr",
			text: "Usage: sensei ingest <scan|watch>",
		},
		{
			channel: "stderr",
			text: "Run 'sensei ingest --help' to inspect the available subcommands.",
		},
	]);
});

test("ingest command rejects unsupported subcommands", async () => {
	const { context } = createExecutionContext("ingest");
	const result = await createIngestCommandHandler()({
		...context,
		args: ["mystery"],
	});

	expect(result.exitCode).toBe(1);
	expect(result.lines).toEqual([
		{
			channel: "stderr",
			text: "Unsupported ingest subcommand 'mystery'.",
		},
		{
			channel: "stderr",
			text: "Usage: sensei ingest <scan|watch>",
		},
		{
			channel: "stderr",
			text: "Run 'sensei ingest --help' to inspect the available subcommands.",
		},
	]);
});

test("ingest command renders scan summaries returned by the scan service", async () => {
	const { context } = createExecutionContext("ingest");
	const result = await createIngestCommandHandler({
		async runSenseiIngestScanCommand() {
			return {
				rootCount: 2,
				discoveryEventCount: 1,
				writeSummary: {
					processedRecords: 3,
					sessionWrites: 1,
					turnWrites: 1,
					turnUsageWrites: 1,
					toolEventWrites: 0,
					cursorWrites: 2,
					warningWrites: 0,
				},
			};
		},
	})({
		...context,
		args: ["scan"],
	});

	expect(result.exitCode).toBe(0);
	expect(result.lines).toEqual([
		{
			channel: "stdout",
			text: "sensei ingest scan completed.",
		},
		{
			channel: "stdout",
			text: "Roots scanned: 2",
		},
		{
			channel: "stdout",
			text: "Discovery events: 1",
		},
		{
			channel: "stdout",
			text: "Processed records: 3",
		},
		{
			channel: "stdout",
			text: "Sessions written: 1",
		},
		{
			channel: "stdout",
			text: "Turns written: 1",
		},
		{
			channel: "stdout",
			text: "Turn usage written: 1",
		},
		{
			channel: "stdout",
			text: "Tool events written: 0",
		},
		{
			channel: "stdout",
			text: "Cursors written: 2",
		},
		{
			channel: "stdout",
			text: "Warnings recorded: 0",
		},
	]);
});

test("ingest command dispatches the watch subcommand", async () => {
	const harness = createExecutionContext("ingest");
	const result = await createIngestCommandHandler({
		async runSenseiIngestWatchCommand(_config, options) {
			await options?.onStarted?.({
				rootCount: 2,
				watchIntervalMs: 250,
				status: "running",
			});

			return {
				rootCount: 2,
				watchIntervalMs: 250,
				status: "running",
			};
		},
	})({
		...harness.context,
		args: ["watch"],
	});

	expect(harness.stdout).toEqual([
		"sensei ingest watch is running.",
		"Roots watched: 2",
		"Watch interval (ms): 250",
		"Status: running",
		"Press Ctrl+C to stop.",
	]);
	expect(result.exitCode).toBe(0);
	expect(result.lines).toEqual([
		{
			channel: "stdout",
			text: "sensei ingest watch stopped.",
		},
	]);
});

test("ingest command help includes the watch subcommand", async () => {
	const { context } = createExecutionContext("ingest");
	const result = await createIngestCommandHandler()({
		...context,
		args: ["--help"],
	});

	expect(result.exitCode).toBe(0);
	expect(result.lines).toEqual([
		{
			channel: "stdout",
			text: "sensei ingest",
		},
		{
			channel: "stdout",
			text: "Usage: sensei ingest <scan|watch>",
		},
		{
			channel: "stdout",
			text: "",
		},
		{
			channel: "stdout",
			text: "Available subcommands:",
		},
		{
			channel: "stdout",
			text: "  scan   Backfill configured provider roots into canonical storage",
		},
		{
			channel: "stdout",
			text: "  watch  Observe configured provider roots until shutdown",
		},
	]);
});

test("analyze command shell renders the extraction summary returned by the analyze service", async () => {
	const { context } = createExecutionContext("analyze");
	const result = await createAnalyzeCommandHandler({
		async runSenseiAnalyzeCommand() {
			return {
				featureVersion: 1,
				analyzedAt: "2026-04-19T02:00:00.000Z",
				totalTurns: 5,
				eligibleTurns: 3,
				skippedTurns: 2,
				persistedRows: 3,
				skippedByReason: {
					"blank-prompt-input": 1,
					"missing-prompt-input": 1,
				},
			};
		},
	})(context);

	expect(result.exitCode).toBe(0);
	expect(result.lines).toEqual([
		{
			channel: "stdout",
			text: "sensei analyze completed.",
		},
		{
			channel: "stdout",
			text: "Feature version: 1",
		},
		{
			channel: "stdout",
			text: "Analyzed at: 2026-04-19T02:00:00.000Z",
		},
		{
			channel: "stdout",
			text: "Turns loaded: 5",
		},
		{
			channel: "stdout",
			text: "Eligible turns: 3",
		},
		{
			channel: "stdout",
			text: "Skipped turns: 2",
		},
		{
			channel: "stdout",
			text: "Skipped missing prompt turns: 1",
		},
		{
			channel: "stdout",
			text: "Skipped blank prompt turns: 1",
		},
		{
			channel: "stdout",
			text: "Turn features persisted: 3",
		},
	]);
});

for (const [commandName, handler] of commandHandlers) {
	test(`${commandName} command shell returns a failing placeholder result`, async () => {
		const { context } = createExecutionContext(commandName);
		const result = await handler(context);

		expect(result.exitCode).toBe(1);
		expect(result.lines).toEqual([
			{
				channel: "stderr",
				text: `Command group '${commandName}' is not implemented yet.`,
			},
			{
				channel: "stderr",
				text: `Command dispatch is active; '${commandName}' still uses a placeholder shell.`,
			},
		]);
	});
}
