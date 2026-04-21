import type { JsonRecord, StorageTurnKey } from "./schema";
import { STORAGE_PROVIDER_IDS } from "./schema";

export type WorkflowFamilyKey = {
	featureVersion: number;
	familyId: string;
};

export type StoredWorkflowFamilyRecord = WorkflowFamilyKey & {
	providerBreakdown?: JsonRecord;
	evidence: unknown;
	updatedAt: string;
};

export type StoreWorkflowFamilyInput = WorkflowFamilyKey & {
	providerBreakdown?: JsonRecord;
	evidence: unknown;
	updatedAt?: string;
};

export type WorkflowFamilyMemberKey = WorkflowFamilyKey & StorageTurnKey;

export type StoredWorkflowFamilyMemberRecord = WorkflowFamilyMemberKey & {
	evidence: unknown;
	updatedAt: string;
};

export type StoreWorkflowFamilyMemberInput = WorkflowFamilyMemberKey & {
	evidence: unknown;
	updatedAt?: string;
};

const providerValues = quotedValues(STORAGE_PROVIDER_IDS);

export const WORKFLOW_FAMILY_STORAGE_STATEMENTS = [
	`
        CREATE TABLE workflow_families (
          feature_version INTEGER NOT NULL CHECK (feature_version >= 1),
          family_id TEXT NOT NULL,
          provider_breakdown_json TEXT CHECK (provider_breakdown_json IS NULL OR json_valid(provider_breakdown_json)),
          evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (feature_version, family_id)
        );
      `,
	`
        CREATE INDEX workflow_families_family_id_idx
        ON workflow_families (family_id);
      `,
	`
        CREATE TABLE workflow_family_members (
          feature_version INTEGER NOT NULL CHECK (feature_version >= 1),
          family_id TEXT NOT NULL,
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (feature_version, family_id, provider, session_id, turn_id),
          FOREIGN KEY (feature_version, family_id)
            REFERENCES workflow_families(feature_version, family_id)
            ON DELETE CASCADE,
          FOREIGN KEY (provider, session_id, turn_id, feature_version)
            REFERENCES turn_features(provider, session_id, turn_id, feature_version)
            ON DELETE CASCADE
        );
      `,
	`
        CREATE INDEX workflow_family_members_turn_key_idx
        ON workflow_family_members (provider, session_id, turn_id, feature_version);
      `,
] as const;

function quotedValues(values: readonly string[]): string {
	return values.map((value) => `'${value}'`).join(", ");
}
