import type {
	ExactWorkflowFamilyGroup,
	WorkflowFamilyCluster,
	WorkflowFamilyMergeDecision,
	WorkflowFamilyMergeReason,
} from "./workflow-family-output";
import { buildWorkflowSimilarityEvidence } from "./workflow-similarity-evidence";

export function buildConservativeWorkflowFamilyClusters(
	exactGroups: readonly ExactWorkflowFamilyGroup[],
): WorkflowFamilyCluster[] {
	const clusters: WorkflowFamilyCluster[] = [];
	const mergeableGroupsBySignature = new Map<string, ExactWorkflowFamilyGroup[]>();

	for (const exactGroup of exactGroups) {
		const mergeSignature = buildWorkflowFamilyMergeSignature(exactGroup);

		if (mergeSignature === undefined) {
			clusters.push(createWorkflowFamilyCluster(exactGroup));
			continue;
		}

		const mergeableGroups = mergeableGroupsBySignature.get(mergeSignature);

		if (mergeableGroups === undefined) {
			mergeableGroupsBySignature.set(mergeSignature, [exactGroup]);
			continue;
		}

		mergeableGroups.push(exactGroup);
	}

	for (const mergeableGroups of mergeableGroupsBySignature.values()) {
		clusters.push(buildWorkflowFamilyCluster(mergeableGroups));
	}

	return clusters;
}

function buildWorkflowFamilyMergeSignature(
	exactGroup: ExactWorkflowFamilyGroup,
): string | undefined {
	if (exactGroup.nearFingerprint === undefined) {
		return undefined;
	}

	const contextSignature = buildCanonicalContextSignature(exactGroup);
	const workflowIntentLabel = exactGroup.stableWorkflowIntentLabels[0];

	if (contextSignature === undefined || workflowIntentLabel === undefined) {
		return undefined;
	}

	return [
		"near",
		exactGroup.nearFingerprint,
		"context",
		contextSignature,
		"intent",
		workflowIntentLabel,
	].join("\u0000");
}

function buildCanonicalContextSignature(
	exactGroup: ExactWorkflowFamilyGroup,
): string | undefined {
	const [projectPath] = exactGroup.projectPaths;

	if (projectPath !== undefined) {
		return `project\u0000${projectPath}`;
	}

	const [threadName] = exactGroup.threadNames;

	if (threadName !== undefined) {
		return `thread\u0000${threadName}`;
	}

	return undefined;
}

function buildWorkflowFamilyCluster(
	exactGroups: readonly ExactWorkflowFamilyGroup[],
): WorkflowFamilyCluster {
	const [seedGroup, ...candidateGroups] = exactGroups;

	if (seedGroup === undefined) {
		throw new Error("workflow family cluster must include at least one group");
	}

	const cluster = createWorkflowFamilyCluster(seedGroup);

	for (const candidateGroup of candidateGroups) {
		const mergeDecision = buildWorkflowFamilyMergeDecision(
			cluster,
			candidateGroup,
		);

		if (mergeDecision === undefined) {
			throw new Error(
				`workflow family group ${candidateGroup.key} matched stable merge signature but failed conservative merge validation`,
			);
		}

		mergeWorkflowFamilyCluster(cluster, candidateGroup, mergeDecision);
	}

	return cluster;
}

function createWorkflowFamilyCluster(
	seedGroup: ExactWorkflowFamilyGroup,
): WorkflowFamilyCluster {
	return {
		seedGroup,
		exactGroups: [seedGroup],
		mergeDecisions: [],
		sharedTags: [...seedGroup.tags],
		sharedWorkflowIntentLabels: [...seedGroup.stableWorkflowIntentLabels],
		sharedProjectPaths: [...seedGroup.projectPaths],
		sharedThreadNames: [...seedGroup.threadNames],
	};
}

function buildWorkflowFamilyMergeDecision(
	cluster: WorkflowFamilyCluster,
	candidateGroup: ExactWorkflowFamilyGroup,
): WorkflowFamilyMergeDecision | undefined {
	if (
		cluster.seedGroup.nearFingerprint === undefined ||
		cluster.seedGroup.nearFingerprint !== candidateGroup.nearFingerprint
	) {
		return undefined;
	}

	const sharedWorkflowIntentLabels = intersectSortedStrings(
		cluster.sharedWorkflowIntentLabels,
		candidateGroup.stableWorkflowIntentLabels,
	);

	if (
		sharedWorkflowIntentLabels.length === 0 ||
		preservesCanonicalSharedSignal(
			cluster.sharedWorkflowIntentLabels,
			candidateGroup.stableWorkflowIntentLabels,
		) === false
	) {
		return undefined;
	}

	const sharedProjectPaths = intersectSortedStrings(
		cluster.sharedProjectPaths,
		candidateGroup.projectPaths,
	);
	const sharedThreadNames = intersectSortedStrings(
		cluster.sharedThreadNames,
		candidateGroup.threadNames,
	);

	if (
		preservesCanonicalSharedContextSignal(cluster, candidateGroup) === false
	) {
		return undefined;
	}

	if (
		sharedProjectPaths.length === 0 &&
		(clusterHasProjectPath(cluster) || candidateGroup.projectPaths.length > 0)
	) {
		return undefined;
	}

	if (sharedProjectPaths.length === 0 && sharedThreadNames.length === 0) {
		return undefined;
	}

	const similarityEvidence = buildWorkflowSimilarityEvidence(
		cluster.seedGroup.anchor,
		candidateGroup.anchor,
	);

	if (similarityEvidence === undefined) {
		return undefined;
	}

	return {
		addedGroupKey: candidateGroup.key,
		reasons: buildWorkflowFamilyMergeReasons(
			sharedProjectPaths.length > 0,
			sharedThreadNames.length > 0,
		),
		similarityEvidence,
	};
}

function mergeWorkflowFamilyCluster(
	cluster: WorkflowFamilyCluster,
	candidateGroup: ExactWorkflowFamilyGroup,
	mergeDecision: WorkflowFamilyMergeDecision,
): void {
	cluster.exactGroups.push(candidateGroup);
	cluster.mergeDecisions.push(mergeDecision);
	cluster.sharedTags = intersectSortedStrings(
		cluster.sharedTags,
		candidateGroup.tags,
	);
	cluster.sharedWorkflowIntentLabels = intersectSortedStrings(
		cluster.sharedWorkflowIntentLabels,
		candidateGroup.stableWorkflowIntentLabels,
	);
	cluster.sharedProjectPaths = intersectSortedStrings(
		cluster.sharedProjectPaths,
		candidateGroup.projectPaths,
	);
	cluster.sharedThreadNames = intersectSortedStrings(
		cluster.sharedThreadNames,
		candidateGroup.threadNames,
	);
}

function preservesCanonicalSharedContextSignal(
	cluster: WorkflowFamilyCluster,
	candidateGroup: ExactWorkflowFamilyGroup,
): boolean {
	if (cluster.sharedProjectPaths.length > 0) {
		return preservesCanonicalSharedSignal(
			cluster.sharedProjectPaths,
			candidateGroup.projectPaths,
		);
	}

	if (cluster.sharedThreadNames.length > 0) {
		return preservesCanonicalSharedSignal(
			cluster.sharedThreadNames,
			candidateGroup.threadNames,
		);
	}

	return true;
}

function preservesCanonicalSharedSignal(
	currentSharedValues: readonly string[],
	candidateValues: readonly string[],
): boolean {
	const [canonicalSharedValue] = currentSharedValues;

	return (
		canonicalSharedValue === undefined ||
		candidateValues.includes(canonicalSharedValue)
	);
}

function clusterHasProjectPath(cluster: WorkflowFamilyCluster): boolean {
	return cluster.exactGroups.some(
		(exactGroup) => exactGroup.projectPaths.length > 0,
	);
}

function buildWorkflowFamilyMergeReasons(
	hasSharedProjectPath: boolean,
	hasSharedThreadName: boolean,
): WorkflowFamilyMergeReason[] {
	const reasons: WorkflowFamilyMergeReason[] = [
		"near-fingerprint",
		"workflow-intent-overlap",
	];

	if (hasSharedProjectPath) {
		reasons.push("project-path-overlap");
	}

	if (hasSharedThreadName) {
		reasons.push("thread-name-overlap");
	}

	return reasons;
}

function intersectSortedStrings(
	left: readonly string[],
	right: readonly string[],
): string[] {
	const rightValues = new Set(right);

	return left.filter((value) => rightValues.has(value));
}
