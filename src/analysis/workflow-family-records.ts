import type {
	StoreWorkflowFamilyInput,
	StoreWorkflowFamilyMemberInput,
} from "../storage";
import { buildWorkflowFamilyId } from "./workflow-family-id";
import type {
	WorkflowFamilyCluster,
	WorkflowFamilyMemberRecordEvidence,
	WorkflowFamilyMergeReason,
	WorkflowFamilyRecordEvidence,
	WorkflowFamilySourceRow,
} from "./workflow-family-output";

export function buildWorkflowFamilyClusterRecords(
	featureVersion: number,
	cluster: WorkflowFamilyCluster,
): {
	family: StoreWorkflowFamilyInput;
	members: StoreWorkflowFamilyMemberInput[];
} {
	const familyId = buildWorkflowFamilyId(cluster);
	const sortedRows = getSortedWorkflowFamilyClusterRows(cluster);
	const exactGroupsByRowKey = indexExactGroupsByRowKey(cluster.exactGroups);

	return {
		family: {
			featureVersion,
			familyId,
			providerBreakdown: buildProviderBreakdown(sortedRows),
			evidence: buildWorkflowFamilyRecordEvidence(cluster, sortedRows.length),
			updatedAt: getLatestUpdatedAt(sortedRows),
		},
		members: sortedRows.map((row) =>
			buildWorkflowFamilyMemberRecord(
				featureVersion,
				familyId,
				cluster,
				exactGroupsByRowKey,
				row,
			),
		),
	};
}

export function compareWorkflowFamilyRecords(
	left: StoreWorkflowFamilyInput,
	right: StoreWorkflowFamilyInput,
): number {
	return (
		left.featureVersion - right.featureVersion ||
		left.familyId.localeCompare(right.familyId)
	);
}

export function compareWorkflowFamilyMemberRecords(
	left: StoreWorkflowFamilyMemberInput,
	right: StoreWorkflowFamilyMemberInput,
): number {
	return (
		left.featureVersion - right.featureVersion ||
		left.familyId.localeCompare(right.familyId) ||
		left.provider.localeCompare(right.provider) ||
		left.sessionId.localeCompare(right.sessionId) ||
		left.turnId.localeCompare(right.turnId)
	);
}

function buildProviderBreakdown(
	rows: readonly WorkflowFamilySourceRow[],
): Record<string, number> {
	const providerBreakdown = new Map<string, number>();

	for (const row of rows) {
		providerBreakdown.set(
			row.provider,
			(providerBreakdown.get(row.provider) ?? 0) + 1,
		);
	}

	return Object.fromEntries(
		[...providerBreakdown.entries()].sort(([left], [right]) =>
			left.localeCompare(right),
		),
	);
}

function buildWorkflowFamilyRecordEvidence(
	cluster: WorkflowFamilyCluster,
	familySize: number,
): WorkflowFamilyRecordEvidence {
	return {
		seedGroupKey: cluster.seedGroup.key,
		exactGroupKeys: cluster.exactGroups.map((group) => group.key),
		exactGroupCount: cluster.exactGroups.length,
		familySize,
		mergeReasons: buildWorkflowFamilyReasons(cluster),
		sharedTags: cluster.sharedTags,
		sharedWorkflowIntentLabels: cluster.sharedWorkflowIntentLabels,
		sharedProjectPaths: cluster.sharedProjectPaths,
		sharedThreadNames: cluster.sharedThreadNames,
		mergeDecisions: cluster.mergeDecisions,
	};
}

function buildWorkflowFamilyMemberRecordEvidence(
	cluster: WorkflowFamilyCluster,
	exactGroup: WorkflowFamilyCluster["exactGroups"][number],
	mergeReasons: WorkflowFamilyMergeReason[],
	row: WorkflowFamilySourceRow,
): WorkflowFamilyMemberRecordEvidence {
	if (exactGroup.key === cluster.seedGroup.key) {
		return {
			exactGroupKey: exactGroup.key,
			relation: isSameWorkflowFamilyRow(exactGroup.anchor, row)
				? "seed-exact"
				: "exact-rerun",
			mergeReasons,
		};
	}

	return {
		exactGroupKey: exactGroup.key,
		relation: "near-merged",
		mergeReasons,
	};
}

function buildWorkflowFamilyMemberRecord(
	featureVersion: number,
	familyId: string,
	cluster: WorkflowFamilyCluster,
	exactGroupsByRowKey: ReadonlyMap<
		string,
		WorkflowFamilyCluster["exactGroups"][number]
	>,
	row: WorkflowFamilySourceRow,
): StoreWorkflowFamilyMemberInput {
	const exactGroup = exactGroupsByRowKey.get(createWorkflowFamilyRowKey(row));

	if (exactGroup === undefined) {
		throw new Error(
			`workflow family member ${row.provider}/${row.sessionId}/${row.turnId} was not present in its cluster`,
		);
	}

	return {
		featureVersion,
		familyId,
		provider: row.provider,
		sessionId: row.sessionId,
		turnId: row.turnId,
		evidence: buildWorkflowFamilyMemberRecordEvidence(
			cluster,
			exactGroup,
			getWorkflowFamilyMemberMergeReasons(cluster, exactGroup),
			row,
		),
		updatedAt: row.updatedAt,
	};
}

function buildWorkflowFamilyReasons(
	cluster: WorkflowFamilyCluster,
): WorkflowFamilyMergeReason[] {
	const reasons = new Set<WorkflowFamilyMergeReason>(
		buildSeedWorkflowFamilyReasons(cluster.seedGroup),
	);

	for (const mergeDecision of cluster.mergeDecisions) {
		for (const reason of mergeDecision.reasons) {
			reasons.add(reason);
		}
	}

	return [...reasons];
}

function buildSeedWorkflowFamilyReasons(
	group: WorkflowFamilyCluster["seedGroup"],
): WorkflowFamilyMergeReason[] {
	const reasons: WorkflowFamilyMergeReason[] = [];

	if (group.exactFingerprint !== undefined) {
		reasons.push("exact-fingerprint");
	}

	if (group.projectPath !== undefined) {
		reasons.push("project-path-scope");
	}

	return reasons;
}

function getLatestUpdatedAt(
	rows: readonly WorkflowFamilySourceRow[],
): string | undefined {
	let latestUpdatedAt: string | undefined;

	for (const row of rows) {
		if (row.updatedAt === undefined) {
			continue;
		}

		if (latestUpdatedAt === undefined || row.updatedAt > latestUpdatedAt) {
			latestUpdatedAt = row.updatedAt;
		}
	}

	return latestUpdatedAt;
}

function getSortedWorkflowFamilyClusterRows(
	cluster: WorkflowFamilyCluster,
): WorkflowFamilySourceRow[] {
	return cluster.exactGroups
		.flatMap((group) => group.rows)
		.sort(compareWorkflowFamilyRows);
}

function indexExactGroupsByRowKey(
	exactGroups: readonly WorkflowFamilyCluster["exactGroups"][number][],
): Map<string, WorkflowFamilyCluster["exactGroups"][number]> {
	const indexedGroups = new Map<
		string,
		WorkflowFamilyCluster["exactGroups"][number]
	>();

	for (const exactGroup of exactGroups) {
		for (const row of exactGroup.rows) {
			indexedGroups.set(createWorkflowFamilyRowKey(row), exactGroup);
		}
	}

	return indexedGroups;
}

function getWorkflowFamilyMemberMergeReasons(
	cluster: WorkflowFamilyCluster,
	exactGroup: WorkflowFamilyCluster["exactGroups"][number],
): WorkflowFamilyMergeReason[] {
	if (exactGroup.key === cluster.seedGroup.key) {
		return buildSeedWorkflowFamilyReasons(exactGroup);
	}

	const mergeDecision = cluster.mergeDecisions.find(
		(decision) => decision.addedGroupKey === exactGroup.key,
	);

	return mergeDecision?.reasons ?? ["near-fingerprint"];
}

function compareWorkflowFamilyRows(
	left: WorkflowFamilySourceRow,
	right: WorkflowFamilySourceRow,
): number {
	return (
		(left.updatedAt ?? "").localeCompare(right.updatedAt ?? "") ||
		left.provider.localeCompare(right.provider) ||
		left.sessionId.localeCompare(right.sessionId) ||
		left.turnId.localeCompare(right.turnId)
	);
}

function isSameWorkflowFamilyRow(
	left: WorkflowFamilySourceRow,
	right: WorkflowFamilySourceRow,
): boolean {
	return (
		left.provider === right.provider &&
		left.sessionId === right.sessionId &&
		left.turnId === right.turnId &&
		left.featureVersion === right.featureVersion
	);
}

function createWorkflowFamilyRowKey(row: WorkflowFamilySourceRow): string {
	return `${row.featureVersion}\u0000${row.provider}\u0000${row.sessionId}\u0000${row.turnId}`;
}
