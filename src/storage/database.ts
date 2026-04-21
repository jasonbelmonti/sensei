import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { migrateSenseiDatabase } from "./migrations";
import { createAnalysisTurnRepository } from "./repositories/analysis-turns";
import { createConversationRepository } from "./repositories/conversations";
import { createIngestStateRepository } from "./repositories/ingest-state";
import { createTurnFeatureRepository } from "./repositories/turn-features";
import { createWorkflowFamiliesRepository } from "./repositories/workflow-families";
import { createWorkflowSearchRepository } from "./repositories/workflow-search";

export type OpenSenseiStorageOptions = {
	databasePath: string;
	readonly?: boolean;
};

type SynchronousTransactionResult<T> =
	T extends PromiseLike<unknown> ? never : T;

export type SenseiStorage = ReturnType<typeof openSenseiStorage>;

export function openSenseiStorage(options: OpenSenseiStorageOptions) {
	if (!options.readonly) {
		mkdirSync(dirname(options.databasePath), { recursive: true });
	}

	const database = new Database(options.databasePath, {
		readonly: options.readonly ?? false,
		create: !options.readonly,
	});

	configureDatabase(database);
	const migrations = options.readonly ? [] : migrateSenseiDatabase(database);
	const analysisTurns = createAnalysisTurnRepository(database);
	const conversations = createConversationRepository(database);
	const ingestState = createIngestStateRepository(database);
	const turnFeatures = createTurnFeatureRepository(database, {
		available: hasTablesForReadonly(
			database,
			options.readonly,
			"turn_features",
		),
	});
	const workflowSearch = createWorkflowSearchRepository(database, {
		available: hasTablesForReadonly(
			database,
			options.readonly,
			"turn_search_documents",
			"turn_search_documents_fts",
		),
	});
	const workflowFamilies = createWorkflowFamiliesRepository(database, {
		available: hasTablesForReadonly(
			database,
			options.readonly,
			"workflow_families",
			"workflow_family_members",
		),
	});
	type TransactionStorage = {
		analysisTurns: typeof analysisTurns;
		conversations: typeof conversations;
		ingestState: typeof ingestState;
		turnFeatures: typeof turnFeatures;
		workflowSearch: typeof workflowSearch;
		workflowFamilies: typeof workflowFamilies;
	};

	return {
		analysisTurns,
		database,
		migrations,
		conversations,
		ingestState,
		turnFeatures,
		workflowSearch,
		workflowFamilies,
		transaction<T>(
			callback: (
				storage: TransactionStorage,
			) => SynchronousTransactionResult<T>,
		): SynchronousTransactionResult<T> {
			const runTransaction = database.transaction(() =>
				callback({
					analysisTurns,
					conversations,
					ingestState,
					turnFeatures,
					workflowSearch,
					workflowFamilies,
				}),
			);

			return runTransaction();
		},
		close() {
			database.close();
		},
	};
}

function configureDatabase(database: Database): void {
	database.exec("PRAGMA foreign_keys = ON;");
	database.exec("PRAGMA busy_timeout = 5000;");
}

function hasTable(database: Database, tableName: string): boolean {
	const row = database
		.query(
			`
				SELECT 1 as found
				FROM sqlite_master
				WHERE type = 'table' AND name = ?
			`,
		)
		.get(tableName) as { found: number } | null;

	return row?.found === 1;
}

function hasTablesForReadonly(
	database: Database,
	readonly: boolean | undefined,
	...tableNames: string[]
): boolean {
	if (!readonly) {
		return true;
	}

	return tableNames.every((tableName) => hasTable(database, tableName));
}
