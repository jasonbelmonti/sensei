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
	const canonicalContext =
		cluster.sharedProjectPaths[0] ?? cluster.sharedThreadNames[0];

	if (nearFingerprint !== undefined && canonicalContext !== undefined) {
		return `near\u0000${nearFingerprint}\u0000context\u0000${canonicalContext}`;
	}

	if (nearFingerprint !== undefined) {
		return `near\u0000${nearFingerprint}\u0000group\u0000${cluster.seedGroup.key}`;
	}

	return cluster.seedGroup.key;
}
