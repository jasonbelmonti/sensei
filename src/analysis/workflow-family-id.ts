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
	if (cluster.exactGroups.length === 1) {
		return buildSingletonExactWorkflowFamilyKey(cluster);
	}

	const nearFingerprint = cluster.seedGroup.nearFingerprint;

	if (nearFingerprint === undefined) {
		return cluster.seedGroup.key;
	}

	const canonicalContextSignature = buildCanonicalContextSignature(cluster);
	const workflowIntentSignature = buildWorkflowIntentSignature(cluster);

	if (
		canonicalContextSignature !== undefined &&
		workflowIntentSignature !== undefined
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

	return `near\u0000${nearFingerprint}\u0000group\u0000${cluster.seedGroup.key}`;
}

function buildSingletonExactWorkflowFamilyKey(
	cluster: WorkflowFamilyCluster,
): string {
	const nearFingerprint = cluster.seedGroup.nearFingerprint;
	const contextSignature = buildSingletonContextSignature(cluster);
	const workflowIntentSignature = firstCanonicalString(
		cluster.seedGroup.stableWorkflowIntentLabels,
	);

	if (
		nearFingerprint !== undefined &&
		contextSignature !== undefined &&
		workflowIntentSignature !== undefined
	) {
		return [
			"near",
			nearFingerprint,
			"context",
			contextSignature,
			"intent",
			workflowIntentSignature,
		].join("\u0000");
	}

	return cluster.seedGroup.key;
}

function buildSingletonContextSignature(
	cluster: WorkflowFamilyCluster,
): string | undefined {
	const projectPath = cluster.seedGroup.projectPath;

	if (projectPath !== undefined) {
		return `project\u0000${projectPath}`;
	}

	const threadName = getLatestSingletonThreadName(cluster);

	if (threadName !== undefined) {
		return `thread\u0000${threadName}`;
	}

	return undefined;
}

function getLatestSingletonThreadName(
	cluster: WorkflowFamilyCluster,
): string | undefined {
	let latestThreadName: string | undefined;
	let latestUpdatedAt = "";
	let latestRowKey = "";

	for (const row of cluster.seedGroup.rows) {
		if (row.threadName === undefined) {
			continue;
		}

		const updatedAt = row.updatedAt ?? "";
		const rowKey = `${row.provider}\u0000${row.sessionId}\u0000${row.turnId}`;

		if (
			latestThreadName === undefined ||
			updatedAt > latestUpdatedAt ||
			(updatedAt === latestUpdatedAt && rowKey > latestRowKey)
		) {
			latestThreadName = row.threadName;
			latestUpdatedAt = updatedAt;
			latestRowKey = rowKey;
		}
	}

	return latestThreadName;
}

function buildCanonicalContextSignature(
	cluster: WorkflowFamilyCluster,
): string | undefined {
	const projectPath = firstCanonicalString(cluster.sharedProjectPaths);

	if (projectPath !== undefined) {
		return `project\u0000${projectPath}`;
	}

	const threadName = firstCanonicalString(cluster.sharedThreadNames);

	if (threadName !== undefined) {
		return `thread\u0000${threadName}`;
	}

	return undefined;
}

function firstCanonicalString(values: readonly string[]): string | undefined {
	return values[0];
}

function buildWorkflowIntentSignature(
	cluster: WorkflowFamilyCluster,
): string | undefined {
	return firstCanonicalString(cluster.sharedWorkflowIntentLabels);
}
