import { afterEach, expect, test } from "bun:test";

import { seedAnalyzeFixture } from "./analyze-fixture";
import { createStorageTestHarness } from "./helpers";

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length > 0) {
		cleanups.pop()?.();
	}
});

test("analysis turn repository lists canonical turns in deterministic session order", () => {
	const harness = createStorageTestHarness("sensei-analysis-turns");
	cleanups.push(harness.cleanup);
	const fixture = seedAnalyzeFixture(harness.storage);

	const orderedTurns = harness.storage.analysisTurns.listOrderedTurns();

	expect(orderedTurns).toHaveLength(5);
	expect(
		orderedTurns.map((orderedTurn) => ({
			turnSequence: orderedTurn.turnSequence,
			turnId: orderedTurn.turn.turnId,
		})),
	).toEqual([
		{ turnSequence: 1, turnId: "turn-001" },
		{ turnSequence: 2, turnId: "turn-002" },
		{ turnSequence: 3, turnId: "turn-003" },
		{ turnSequence: 4, turnId: "turn-004" },
		{ turnSequence: 5, turnId: "turn-005" },
	]);
	expect(
		orderedTurns.map((orderedTurn) => orderedTurn.turn.turnId),
	).not.toContain(fixture.provisionalTurnId);
	expect(orderedTurns[0]).toMatchObject({
		turnSequence: 1,
		turn: {
			sessionId: fixture.canonicalSessionId,
			turnId: fixture.eligibleTurnIds[0],
			status: "completed",
			input: {
				prompt: "Explain the baseline analyzer behavior.",
			},
		},
		usage: {
			inputTokens: 120,
			outputTokens: 80,
			cachedInputTokens: 20,
		},
		toolEvents: [
			{
				toolCallId: "tool-001",
				toolName: "exec_command",
				outcome: "success",
			},
		],
	});
	expect(
		orderedTurns[2].toolEvents.map((toolEvent) => toolEvent.toolCallId),
	).toEqual(["tool-003", "tool-004"]);
	expect(orderedTurns[4]).toMatchObject({
		turnSequence: 5,
		turn: {
			turnId: fixture.skippedTurnIds[1],
			input: undefined,
		},
		usage: undefined,
		toolEvents: [],
	});
});
