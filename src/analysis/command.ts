import type { SenseiRuntimeConfig } from "../config";
import {
	openSenseiStorage,
	type OpenSenseiStorageOptions,
	type SenseiStorage,
} from "../storage";
import {
	CURRENT_TURN_FEATURE_VERSION,
	type TurnFeatureVersion,
} from "./feature-version";
import {
	extractTurnFeatures,
	TURN_FEATURE_SKIP_REASONS,
	type TurnFeatureSkipReason,
} from "./feature-extraction";

type SenseiAnalyzeConfig = Pick<SenseiRuntimeConfig, "paths">;
type SenseiAnalyzeStorage = Pick<
	SenseiStorage,
	"analysisTurns" | "close" | "transaction"
>;
type OpenSenseiAnalyzeStorage = (
	options: Pick<OpenSenseiStorageOptions, "databasePath">,
) => SenseiAnalyzeStorage;

export type SenseiAnalyzeCommandSummary = {
	featureVersion: TurnFeatureVersion;
	analyzedAt: string;
	totalTurns: number;
	eligibleTurns: number;
	skippedTurns: number;
	persistedRows: number;
	skippedByReason: Record<TurnFeatureSkipReason, number>;
};

export type RunSenseiAnalyzeCommandOptions = {
	openStorage?: OpenSenseiAnalyzeStorage;
	featureVersion?: TurnFeatureVersion;
	now?: () => string;
};

export async function runSenseiAnalyzeCommand(
	config: SenseiAnalyzeConfig,
	options: RunSenseiAnalyzeCommandOptions = {},
): Promise<SenseiAnalyzeCommandSummary> {
	const openStorage = options.openStorage ?? openSenseiStorage;
	const analyzedAt = (options.now ?? defaultNow)();
	const storage = openStorage({
		databasePath: config.paths.databasePath,
	});

	try {
		const orderedTurns = storage.analysisTurns.listOrderedTurns();
		const extraction = extractTurnFeatures(orderedTurns, {
			analyzedAt,
			featureVersion: options.featureVersion ?? CURRENT_TURN_FEATURE_VERSION,
		});
		const persistedRows = storage.transaction(
			({ turnFeatures }) => turnFeatures.upsertMany(extraction.rows).length,
		);

		return {
			featureVersion: extraction.featureVersion,
			analyzedAt: extraction.analyzedAt,
			totalTurns: extraction.summary.totalTurns,
			eligibleTurns: extraction.summary.eligibleTurns,
			skippedTurns: extraction.summary.skippedTurns,
			persistedRows,
			skippedByReason: summarizeSkippedTurnsByReason(extraction.skipped),
		};
	} finally {
		storage.close();
	}
}

function summarizeSkippedTurnsByReason(
	skippedTurns: readonly { reason: TurnFeatureSkipReason }[],
): Record<TurnFeatureSkipReason, number> {
	const counts = Object.fromEntries(
		TURN_FEATURE_SKIP_REASONS.map((reason) => [reason, 0]),
	) as Record<TurnFeatureSkipReason, number>;

	for (const skippedTurn of skippedTurns) {
		counts[skippedTurn.reason] += 1;
	}

	return counts;
}

function defaultNow(): string {
	return new Date().toISOString();
}
