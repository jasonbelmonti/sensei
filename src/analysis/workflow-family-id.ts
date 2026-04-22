import { createHash } from "node:crypto";

import type { WorkflowFamilyCluster } from "./workflow-family-output";

export function buildWorkflowFamilyId(cluster: WorkflowFamilyCluster): string {
	const seed = [
		"workflow-family",
		buildCanonicalWorkflowFamilyKey(cluster),
	].join("\u0000");

	return `wf_${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

function buildCanonicalWorkflowFamilyKey(
	cluster: WorkflowFamilyCluster,
): string {
	const nearFingerprint = cluster.seedGroup.nearFingerprint;
	const canonicalContextSignature = buildCanonicalContextSignature(cluster);
	const workflowIntentSignature = buildWorkflowIntentSignature(cluster);

	if (
		nearFingerprint !== undefined &&
		canonicalContextSignature !== undefined
	) {
		return [
			"near",
			nearFingerprint,
			"context",
			canonicalContextSignature,
			"intent",
			workflowIntentSignature,
		].join("\u0000");
	}

	if (nearFingerprint !== undefined) {
		return `near\u0000${nearFingerprint}\u0000group\u0000${cluster.seedGroup.key}`;
	}

	return cluster.seedGroup.key;
}

function buildCanonicalContextSignature(
	cluster: WorkflowFamilyCluster,
): string | undefined {
	const projectPaths = collectCanonicalContextValues(
		cluster,
		(exactGroup) => exactGroup.projectPaths,
	);
	const threadNames = collectCanonicalContextValues(
		cluster,
		(exactGroup) => exactGroup.threadNames,
	);

	if (projectPaths.length === 0 && threadNames.length === 0) {
		return undefined;
	}

	return [
		"projects",
		projectPaths.length > 0 ? projectPaths.join("\u0000") : "none",
		"threads",
		threadNames.length > 0 ? threadNames.join("\u0000") : "none",
	].join("\u0000");
}

function collectCanonicalContextValues(
	cluster: WorkflowFamilyCluster,
	getValues: (
		exactGroup: WorkflowFamilyCluster["exactGroups"][number],
	) => readonly string[],
): string[] {
	return [...new Set(cluster.exactGroups.flatMap(getValues))].sort();
}

function buildWorkflowIntentSignature(cluster: WorkflowFamilyCluster): string {
	if (cluster.sharedWorkflowIntentLabels.length === 0) {
		return "none";
	}

	return cluster.sharedWorkflowIntentLabels.join("\u0000");
}
