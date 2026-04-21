import type {
	StoreWorkflowFamilyInput,
	StoreWorkflowFamilyMemberInput,
} from "../storage";
import { buildConservativeWorkflowFamilyClusters } from "./conservative-workflow-family-merges";
import { buildExactWorkflowFamilyGroups } from "./exact-workflow-family-groups";
import type {
	WorkflowFamilyClusterResult,
	WorkflowFamilySourceRow,
} from "./workflow-family-output";
import {
	buildWorkflowFamilyClusterRecords,
	compareWorkflowFamilyMemberRecords,
	compareWorkflowFamilyRecords,
} from "./workflow-family-records";

export function clusterWorkflowFamilies(
	rows: readonly WorkflowFamilySourceRow[],
): WorkflowFamilyClusterResult {
	const rowsByFeatureVersion = indexWorkflowRowsByFeatureVersion(rows);
	const families: StoreWorkflowFamilyInput[] = [];
	const members: StoreWorkflowFamilyMemberInput[] = [];

	for (const [featureVersion, featureRows] of rowsByFeatureVersion.entries()) {
		const exactGroups = buildExactWorkflowFamilyGroups(featureRows);
		const clusters = buildConservativeWorkflowFamilyClusters(exactGroups);

		for (const cluster of clusters) {
			const clusterRecords = buildWorkflowFamilyClusterRecords(
				featureVersion,
				cluster,
			);

			families.push(clusterRecords.family);
			members.push(...clusterRecords.members);
		}
	}

	return {
		families: families.sort(compareWorkflowFamilyRecords),
		members: members.sort(compareWorkflowFamilyMemberRecords),
	};
}

function indexWorkflowRowsByFeatureVersion(
	rows: readonly WorkflowFamilySourceRow[],
): Map<number, WorkflowFamilySourceRow[]> {
	const rowsByFeatureVersion = new Map<number, WorkflowFamilySourceRow[]>();

	for (const row of rows) {
		const versionRows = rowsByFeatureVersion.get(row.featureVersion);

		if (versionRows === undefined) {
			rowsByFeatureVersion.set(row.featureVersion, [row]);
			continue;
		}

		versionRows.push(row);
	}

	return new Map(
		[...rowsByFeatureVersion.entries()].sort(([left], [right]) => left - right),
	);
}
