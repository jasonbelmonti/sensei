import { expect, test } from "bun:test";
import type {
	WorkflowFamilyRecordEvidence,
	WorkflowFamilySourceRow,
} from "../../src/analysis";
import {
	buildExactPromptFingerprint,
	buildNearPromptFingerprint,
	CURRENT_TURN_FEATURE_VERSION,
	clusterWorkflowFamilies,
} from "../../src/analysis";

test("workflow family clustering returns stable identifiers for exact reruns regardless of input order", () => {
	const rows = [
		createWorkflowSearchRow({
			sessionId: "session-a",
			turnId: "turn-001",
			promptText:
				"Implement BEL-809 workflow family clustering in /repo/sensei.",
			projectPath: "/repo/sensei",
			threadName: "BEL-809 execution",
			tags: ["analysis", "bel-809"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:00:00.000Z",
		}),
		createWorkflowSearchRow({
			provider: "claude",
			sessionId: "session-b",
			turnId: "turn-002",
			promptText:
				"Implement BEL-809 workflow family clustering in /repo/sensei.",
			projectPath: "/repo/sensei",
			threadName: "BEL-809 execution",
			tags: ["bel-809", "analysis"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:01:00.000Z",
		}),
	];

	const firstPass = clusterWorkflowFamilies(rows);
	const secondPass = clusterWorkflowFamilies([...rows].reverse());

	expect(firstPass).toEqual(secondPass);
	expect(firstPass.families).toHaveLength(1);
	expect(firstPass.members).toHaveLength(2);
	expect(firstPass.families[0]).toEqual(
		expect.objectContaining({
			familyId: expect.stringMatching(/^wf_[0-9a-f]{24}$/),
			providerBreakdown: {
				claude: 1,
				codex: 1,
			},
			evidence: expect.objectContaining({
				exactGroupCount: 1,
				familySize: 2,
				mergeReasons: ["exact-fingerprint", "project-path-scope"],
			}),
		}),
	);
	expect(firstPass.members).toEqual([
		expect.objectContaining({
			provider: "claude",
			evidence: {
				exactGroupKey: expect.any(String),
				relation: "exact-rerun",
				mergeReasons: ["exact-fingerprint", "project-path-scope"],
			},
		}),
		expect.objectContaining({
			provider: "codex",
			evidence: {
				exactGroupKey: expect.any(String),
				relation: "seed-exact",
				mergeReasons: ["exact-fingerprint", "project-path-scope"],
			},
		}),
	]);
});

test("workflow family clustering keeps the same family identifier when an older exact rerun is backfilled", () => {
	const originalRow = createWorkflowSearchRow({
		sessionId: "session-a",
		turnId: "turn-001",
		promptText: "Implement BEL-809 workflow family clustering in /repo/sensei.",
		projectPath: "/repo/sensei",
		threadName: "BEL-809 execution",
		tags: ["analysis", "bel-809"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-21T20:00:00.000Z",
	});
	const olderRerun = createWorkflowSearchRow({
		provider: "claude",
		sessionId: "session-b",
		turnId: "turn-002",
		promptText: "Implement BEL-809 workflow family clustering in /repo/sensei.",
		projectPath: "/repo/sensei",
		threadName: "BEL-809 execution",
		tags: ["analysis", "bel-809"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-20T20:00:00.000Z",
	});

	const originalResult = clusterWorkflowFamilies([originalRow]);
	const backfilledResult = clusterWorkflowFamilies([originalRow, olderRerun]);

	expect(originalResult.families[0]?.familyId).toBe(
		backfilledResult.families[0]?.familyId,
	);
});

test("workflow family clustering keeps the same family identifier when a lower-key near-mergeable group is backfilled", () => {
	const exactGroupA = createWorkflowSearchRow({
		sessionId: "session-a",
		turnId: "turn-001",
		promptText:
			"Implement BEL-809 workflow family clustering in /repo/sensei before 2026-04-21.",
		projectPath: "/repo/sensei",
		threadName: "BEL-809 execution",
		tags: ["analysis", "clustering", "bel-809"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-21T20:00:00.000Z",
	});
	const exactGroupB = createWorkflowSearchRow({
		sessionId: "session-b",
		turnId: "turn-002",
		promptText:
			"Implement BEL-810 workflow family clustering in /repo/sensei before 2026-05-01.",
		projectPath: "/repo/sensei",
		threadName: "BEL-809 execution",
		tags: ["analysis", "clustering", "bel-810"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-21T20:03:00.000Z",
	});

	expect(exactGroupA.nearFingerprint).toBe(exactGroupB.nearFingerprint);

	const [backfilledGroup, existingGroup] = [exactGroupA, exactGroupB].sort(
		(left, right) =>
			(left.exactFingerprint ?? "").localeCompare(right.exactFingerprint ?? ""),
	);

	const initialResult = clusterWorkflowFamilies([existingGroup]);
	const backfilledResult = clusterWorkflowFamilies([
		existingGroup,
		backfilledGroup,
	]);

	expect(initialResult.families[0]?.familyId).toBe(
		backfilledResult.families[0]?.familyId,
	);
});

test("workflow family clustering merges related prompt variants when near fingerprint, intent, and project context align", () => {
	const result = clusterWorkflowFamilies([
		createWorkflowSearchRow({
			sessionId: "session-a",
			turnId: "turn-001",
			promptText:
				"Implement BEL-809 workflow family clustering in /repo/sensei before 2026-04-21.",
			projectPath: "/repo/sensei",
			threadName: "BEL-809 execution",
			tags: ["analysis", "clustering", "bel-809"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:00:00.000Z",
		}),
		createWorkflowSearchRow({
			sessionId: "session-b",
			turnId: "turn-002",
			promptText:
				"Implement BEL-810 workflow family clustering in /repo/sensei before 2026-05-01.",
			projectPath: "/repo/sensei",
			threadName: "BEL-809 execution",
			tags: ["clustering", "bel-810", "analysis"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:03:00.000Z",
		}),
	]);

	expect(result.families).toHaveLength(1);
	expect(result.members).toHaveLength(2);

	const familyEvidence = result.families[0]
		?.evidence as WorkflowFamilyRecordEvidence;

	expect(familyEvidence.exactGroupCount).toBe(2);
	expect(familyEvidence.mergeReasons).toEqual([
		"exact-fingerprint",
		"project-path-scope",
		"near-fingerprint",
		"workflow-intent-overlap",
		"project-path-overlap",
		"thread-name-overlap",
	]);
	expect(familyEvidence.sharedWorkflowIntentLabels).toEqual(["implement"]);
	expect(familyEvidence.sharedProjectPaths).toEqual(["/repo/sensei"]);
	expect(familyEvidence.mergeDecisions).toEqual([
		{
			addedGroupKey: expect.any(String),
			reasons: [
				"near-fingerprint",
				"workflow-intent-overlap",
				"project-path-overlap",
				"thread-name-overlap",
			],
			similarityEvidence: expect.objectContaining({
				fingerprintMatches: [
					{
						kind: "near",
						fingerprint: requireFingerprint(
							buildNearPromptFingerprint(
								"Implement BEL-809 workflow family clustering in /repo/sensei before 2026-04-21.",
							),
							"expected near fingerprint for merged family",
						),
					},
				],
				sharedWorkflowIntentLabels: ["implement"],
			}),
		},
	]);
	expect(result.members).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				evidence: {
					exactGroupKey: expect.any(String),
					relation: "seed-exact",
					mergeReasons: ["exact-fingerprint", "project-path-scope"],
				},
			}),
			expect.objectContaining({
				evidence: {
					exactGroupKey: expect.any(String),
					relation: "near-merged",
					mergeReasons: [
						"near-fingerprint",
						"workflow-intent-overlap",
						"project-path-overlap",
						"thread-name-overlap",
					],
				},
			}),
		]),
	);
});

test("workflow family clustering does not merge superficially similar work when workflow intent diverges", () => {
	const result = clusterWorkflowFamilies([
		createWorkflowSearchRow({
			sessionId: "session-a",
			turnId: "turn-001",
			promptText:
				"Implement BEL-809 workflow family clustering in /repo/sensei before 2026-04-21.",
			projectPath: "/repo/sensei",
			threadName: "BEL-809 execution",
			tags: ["analysis", "bel-809"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:00:00.000Z",
		}),
		createWorkflowSearchRow({
			sessionId: "session-b",
			turnId: "turn-002",
			promptText:
				"Explain BEL-810 workflow family clustering in /repo/sensei before 2026-05-01.",
			projectPath: "/repo/sensei",
			threadName: "BEL-809 execution",
			tags: ["analysis", "bel-810"],
			workflowIntentLabels: ["explain"],
			updatedAt: "2026-04-21T20:03:00.000Z",
		}),
	]);

	expect(result.families).toHaveLength(2);
	expect(result.members).toHaveLength(2);
	expect(
		result.families.map((family: { familyId: string }) => family.familyId),
	).toEqual([expect.any(String), expect.any(String)]);
	expect(result.families[0]?.familyId).not.toBe(result.families[1]?.familyId);
});

test("workflow family clustering keeps tag-only overlap below the merge threshold", () => {
	const result = clusterWorkflowFamilies([
		createWorkflowSearchRow({
			sessionId: "session-a",
			turnId: "turn-001",
			promptText:
				"Implement BEL-809 workflow family clustering in /repo/alpha before 2026-04-21.",
			projectPath: "/repo/alpha",
			threadName: "Alpha execution",
			tags: ["analysis", "workflow-family"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:00:00.000Z",
		}),
		createWorkflowSearchRow({
			sessionId: "session-b",
			turnId: "turn-002",
			promptText:
				"Implement BEL-810 workflow family clustering in /repo/beta before 2026-05-01.",
			projectPath: "/repo/beta",
			threadName: "Beta execution",
			tags: ["workflow-family", "analysis"],
			workflowIntentLabels: ["implement"],
			updatedAt: "2026-04-21T20:03:00.000Z",
		}),
	]);

	expect(result.families).toHaveLength(2);
	expect(result.members).toHaveLength(2);
});

test("workflow family clustering gives distinct family identifiers to near-only clusters that do not merge", () => {
	const firstRow = createWorkflowSearchRow({
		sessionId: "session-a",
		turnId: "turn-001",
		promptText: "123 /Users/alice/code/sensei/.worktrees/bel-819",
		projectPath: undefined,
		threadName: undefined,
		tags: ["analysis"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-21T20:00:00.000Z",
	});
	const secondRow = createWorkflowSearchRow({
		sessionId: "session-b",
		turnId: "turn-002",
		promptText: "456 /workspace/sensei/.worktrees/bel-820",
		projectPath: undefined,
		threadName: undefined,
		tags: ["analysis"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-21T20:03:00.000Z",
	});

	expect(firstRow.nearFingerprint).toBe(secondRow.nearFingerprint);

	const result = clusterWorkflowFamilies([firstRow, secondRow]);

	expect(result.families).toHaveLength(2);
	expect(result.families[0]?.familyId).not.toBe(result.families[1]?.familyId);
});

test("workflow family clustering gives distinct family identifiers to same-context clusters that do not merge because intent diverges", () => {
	const firstRow = createWorkflowSearchRow({
		sessionId: "session-a",
		turnId: "turn-001",
		promptText: "123 /Users/alice/code/sensei/.worktrees/bel-819",
		projectPath: "/repo/sensei",
		threadName: "BEL-809 execution",
		tags: ["analysis"],
		workflowIntentLabels: ["implement"],
		updatedAt: "2026-04-21T20:00:00.000Z",
	});
	const secondRow = createWorkflowSearchRow({
		sessionId: "session-b",
		turnId: "turn-002",
		promptText: "456 /workspace/sensei/.worktrees/bel-820",
		projectPath: "/repo/sensei",
		threadName: "BEL-809 execution",
		tags: ["analysis"],
		workflowIntentLabels: ["explain"],
		updatedAt: "2026-04-21T20:03:00.000Z",
	});

	expect(firstRow.nearFingerprint).toBe(secondRow.nearFingerprint);

	const result = clusterWorkflowFamilies([firstRow, secondRow]);

	expect(result.families).toHaveLength(2);
	expect(result.families[0]?.familyId).not.toBe(result.families[1]?.familyId);
});

test("workflow family clustering does not claim an exact-fingerprint reason for fingerprintless singleton families", () => {
	const result = clusterWorkflowFamilies([
		{
			provider: "codex",
			sessionId: "session-blank",
			turnId: "turn-blank",
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			promptText: " ",
			normalizedPromptText: undefined,
			threadName: "blank prompt",
			projectPath: "/repo/sensei",
			tags: [],
			workflowIntentLabels: [],
			exactFingerprint: undefined,
			nearFingerprint: undefined,
			searchText: "",
			updatedAt: "2026-04-21T20:00:00.000Z",
		},
	]);

	expect(result.families[0]).toEqual(
		expect.objectContaining({
			evidence: expect.objectContaining({
				seedGroupKey: "turn\u0000codex\u0000session-blank\u0000turn-blank",
				mergeReasons: ["project-path-scope"],
			}),
		}),
	);
	expect(result.members[0]).toEqual(
		expect.objectContaining({
			evidence: {
				exactGroupKey: "turn\u0000codex\u0000session-blank\u0000turn-blank",
				relation: "seed-exact",
				mergeReasons: ["project-path-scope"],
			},
		}),
	);
});

function createWorkflowSearchRow(overrides: {
	provider?: "claude" | "codex";
	sessionId: string;
	turnId: string;
	promptText: string;
	projectPath?: string;
	threadName?: string;
	tags?: string[];
	workflowIntentLabels?: string[];
	updatedAt: string;
}): WorkflowFamilySourceRow {
	return {
		provider: overrides.provider ?? "codex",
		sessionId: overrides.sessionId,
		turnId: overrides.turnId,
		featureVersion: CURRENT_TURN_FEATURE_VERSION,
		promptText: overrides.promptText,
		normalizedPromptText: overrides.promptText.toLowerCase(),
		threadName: overrides.threadName,
		projectPath: overrides.projectPath,
		tags: overrides.tags ?? [],
		workflowIntentLabels: overrides.workflowIntentLabels ?? [],
		exactFingerprint: requireFingerprint(
			buildExactPromptFingerprint(overrides.promptText),
			"expected exact fingerprint for test fixture",
		),
		nearFingerprint: requireFingerprint(
			buildNearPromptFingerprint(overrides.promptText),
			"expected near fingerprint for test fixture",
		),
		searchText: overrides.promptText,
		updatedAt: overrides.updatedAt,
	};
}

function requireFingerprint(
	fingerprint: string | undefined,
	message: string,
): string {
	if (fingerprint === undefined) {
		throw new Error(message);
	}

	return fingerprint;
}
