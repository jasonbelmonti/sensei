import { expect, test } from "bun:test";

import { createSenseiCliApplication } from "../../src/cli";
import { createAnalyzeCommandHandler } from "../../src/cli/commands/analyze";
import type { SenseiCliCommandExecutionContext } from "../../src/cli/types";

function createExecutionContext(): SenseiCliCommandExecutionContext {
	return {
		command: "analyze",
		args: [],
		cli: createSenseiCliApplication({
			repoRoot: "/repo/sensei",
		}).context,
	};
}

test("analyze command help renders usage guidance", async () => {
	const result = await createAnalyzeCommandHandler()({
		...createExecutionContext(),
		args: ["--help"],
	});

	expect(result.exitCode).toBe(0);
	expect(result.lines).toEqual([
		{
			channel: "stdout",
			text: "sensei analyze",
		},
		{
			channel: "stdout",
			text: "Usage: sensei analyze",
		},
		{
			channel: "stdout",
			text: "",
		},
		{
			channel: "stdout",
			text: "Run deterministic feature extraction over canonical turns and persist current-version rows.",
		},
	]);
});

test("analyze command rejects unexpected positional arguments", async () => {
	const result = await createAnalyzeCommandHandler()({
		...createExecutionContext(),
		args: ["extra-arg"],
	});

	expect(result.exitCode).toBe(1);
	expect(result.lines).toEqual([
		{
			channel: "stderr",
			text: "The analyze command does not accept positional arguments yet.",
		},
		{
			channel: "stderr",
			text: "Usage: sensei analyze",
		},
		{
			channel: "stderr",
			text: "Run 'sensei analyze --help' to inspect the available behavior.",
		},
	]);
});

test("analyze command renders the deterministic extraction summary", async () => {
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
	})(createExecutionContext());

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

test("analyze command surfaces analyze pipeline failures", async () => {
	const result = await createAnalyzeCommandHandler({
		async runSenseiAnalyzeCommand() {
			throw new Error("storage unavailable");
		},
	})(createExecutionContext());

	expect(result.exitCode).toBe(1);
	expect(result.lines).toEqual([
		{
			channel: "stderr",
			text: "sensei analyze failed.",
		},
		{
			channel: "stderr",
			text: "storage unavailable",
		},
	]);
});
