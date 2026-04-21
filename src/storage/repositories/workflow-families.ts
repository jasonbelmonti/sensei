import type { Database } from "bun:sqlite";

import type {
	StoredWorkflowFamilyMemberRecord,
	StoredWorkflowFamilyRecord,
	StoreWorkflowFamilyInput,
	StoreWorkflowFamilyMemberInput,
} from "../workflow-family-schema";
import {
	nowIsoString,
	parseJson,
	parseJsonRecord,
	serializeJson,
} from "./shared";

export type WorkflowFamiliesRepository = ReturnType<
	typeof createWorkflowFamiliesRepository
>;

export type ReplaceWorkflowFamiliesInput = {
	families: readonly StoreWorkflowFamilyInput[];
	members: readonly StoreWorkflowFamilyMemberInput[];
};

type WorkflowFamilyRow = {
	featureVersion: number;
	familyId: string;
	providerBreakdownJson: string | null;
	evidenceJson: string;
	updatedAt: string;
};

type WorkflowFamilyMemberRow = {
	featureVersion: number;
	familyId: string;
	provider: string;
	sessionId: string;
	turnId: string;
	evidenceJson: string;
	updatedAt: string;
};

type CreateWorkflowFamiliesRepositoryOptions = {
	available?: boolean;
};

export function createWorkflowFamiliesRepository(
	database: Database,
	options: CreateWorkflowFamiliesRepositoryOptions = {},
) {
	if (options.available === false) {
		return createUnavailableWorkflowFamiliesRepository();
	}

	const workflowFamilyProjection = `
    feature_version as featureVersion,
    family_id as familyId,
    provider_breakdown_json as providerBreakdownJson,
    evidence_json as evidenceJson,
    updated_at as updatedAt
  `;
	const workflowFamilyMemberProjection = `
    feature_version as featureVersion,
    family_id as familyId,
    provider,
    session_id as sessionId,
    turn_id as turnId,
    evidence_json as evidenceJson,
    updated_at as updatedAt
  `;
	const selectAllFamiliesStatement = database.query(`
    SELECT
      ${workflowFamilyProjection}
    FROM workflow_families
    ORDER BY feature_version, family_id
  `);
	const selectAllMembersStatement = database.query(`
    SELECT
      ${workflowFamilyMemberProjection}
    FROM workflow_family_members
    ORDER BY feature_version, family_id, provider, session_id, turn_id
  `);
	const upsertWorkflowFamilyStatement = database.query(`
    INSERT INTO workflow_families (
      feature_version,
      family_id,
      provider_breakdown_json,
      evidence_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (feature_version, family_id) DO UPDATE SET
      provider_breakdown_json = excluded.provider_breakdown_json,
      evidence_json = excluded.evidence_json,
      updated_at = excluded.updated_at
    RETURNING
      ${workflowFamilyProjection}
  `);
	const upsertWorkflowFamilyMemberStatement = database.query(`
    INSERT INTO workflow_family_members (
      feature_version,
      family_id,
      provider,
      session_id,
      turn_id,
      evidence_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (feature_version, family_id, provider, session_id, turn_id) DO UPDATE SET
      evidence_json = excluded.evidence_json,
      updated_at = excluded.updated_at
    RETURNING
      ${workflowFamilyMemberProjection}
  `);
	const deleteFeatureVersionStatement = database.query(`
    DELETE FROM workflow_families
    WHERE feature_version = ?
  `);
	const upsertFamily = (input: StoreWorkflowFamilyInput) =>
		mapWorkflowFamilyRow(
			upsertWorkflowFamilyStatement.get(
				...workflowFamilyStatementParams(input),
			) as WorkflowFamilyRow,
		);
	const upsertMember = (input: StoreWorkflowFamilyMemberInput) =>
		mapWorkflowFamilyMemberRow(
			upsertWorkflowFamilyMemberStatement.get(
				...workflowFamilyMemberStatementParams(input),
			) as WorkflowFamilyMemberRow,
		);

	return {
		listAll(): StoredWorkflowFamilyRecord[] {
			return (selectAllFamiliesStatement.all() as WorkflowFamilyRow[]).map(
				mapWorkflowFamilyRow,
			);
		},
		listMembers(): StoredWorkflowFamilyMemberRecord[] {
			return (selectAllMembersStatement.all() as WorkflowFamilyMemberRow[]).map(
				mapWorkflowFamilyMemberRow,
			);
		},
		replaceFeatureVersion(
			featureVersion: number,
			input: ReplaceWorkflowFamiliesInput,
		): {
			families: StoredWorkflowFamilyRecord[];
			members: StoredWorkflowFamilyMemberRecord[];
		} {
			assertReplaceWorkflowFamiliesInput(featureVersion, input);
			deleteFeatureVersionStatement.run(featureVersion);

			const families = input.families.map(upsertFamily);
			const members = input.members.map(upsertMember);

			return {
				families,
				members,
			};
		},
	};
}

function createUnavailableWorkflowFamiliesRepository() {
	return {
		listAll(): StoredWorkflowFamilyRecord[] {
			return [];
		},
		listMembers(): StoredWorkflowFamilyMemberRecord[] {
			return [];
		},
		replaceFeatureVersion(
			_featureVersion: number,
			input: ReplaceWorkflowFamiliesInput,
		): {
			families: StoredWorkflowFamilyRecord[];
			members: StoredWorkflowFamilyMemberRecord[];
		} {
			if (input.families.length === 0 && input.members.length === 0) {
				return {
					families: [],
					members: [],
				};
			}

			throw unavailableWorkflowFamiliesError();
		},
	};
}

function mapWorkflowFamilyRow(
	row: WorkflowFamilyRow,
): StoredWorkflowFamilyRecord {
	return {
		featureVersion: row.featureVersion,
		familyId: row.familyId,
		providerBreakdown: parseJsonRecord(row.providerBreakdownJson),
		evidence: parseJson(row.evidenceJson),
		updatedAt: row.updatedAt,
	};
}

function mapWorkflowFamilyMemberRow(
	row: WorkflowFamilyMemberRow,
): StoredWorkflowFamilyMemberRecord {
	return {
		featureVersion: row.featureVersion,
		familyId: row.familyId,
		provider: row.provider as StoredWorkflowFamilyMemberRecord["provider"],
		sessionId: row.sessionId,
		turnId: row.turnId,
		evidence: parseJson(row.evidenceJson),
		updatedAt: row.updatedAt,
	};
}

function assertReplaceWorkflowFamiliesInput(
	featureVersion: number,
	input: ReplaceWorkflowFamiliesInput,
): void {
	const familyIds = new Set<string>();

	for (const family of input.families) {
		if (family.featureVersion !== featureVersion) {
			throw new Error(
				`workflow_families refresh expected feature version ${featureVersion}, received ${family.featureVersion} for family ${family.familyId}.`,
			);
		}

		familyIds.add(family.familyId);
	}

	for (const member of input.members) {
		if (member.featureVersion !== featureVersion) {
			throw new Error(
				`workflow_family_members refresh expected feature version ${featureVersion}, received ${member.featureVersion} for ${member.provider}/${member.sessionId}/${member.turnId}.`,
			);
		}

		if (familyIds.has(member.familyId) === false) {
			throw new Error(
				`workflow_family_members refresh expected family ${member.familyId} to be present in workflow_families for feature version ${featureVersion}.`,
			);
		}
	}
}

function workflowFamilyStatementParams(input: StoreWorkflowFamilyInput) {
	return [
		input.featureVersion,
		input.familyId,
		serializeJson(input.providerBreakdown),
		serializeJson(input.evidence),
		input.updatedAt ?? nowIsoString(),
	] as const;
}

function workflowFamilyMemberStatementParams(
	input: StoreWorkflowFamilyMemberInput,
) {
	return [
		input.featureVersion,
		input.familyId,
		input.provider,
		input.sessionId,
		input.turnId,
		serializeJson(input.evidence),
		input.updatedAt ?? nowIsoString(),
	] as const;
}

function unavailableWorkflowFamiliesError(): Error {
	return new Error(
		"workflow_families is unavailable in this database; reopen without readonly to run migrations first.",
	);
}
