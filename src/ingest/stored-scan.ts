import type { SenseiRuntimeConfig } from "../config/index.js";
import { openSenseiStorage } from "../storage/database.js";
import {
	createSenseiPassiveScanRootsForConfig,
	createSenseiPassiveIngestRegistries,
} from "./provider-roots.js";
import { createSessionIngestService } from "./service.js";
import { createStagedStorage } from "./staged-storage.js";

export async function runStoredScan(
	config: Pick<SenseiRuntimeConfig, "paths">,
) {
	const storage = openSenseiStorage({
		databasePath: config.paths.databasePath,
	});
	const staged = createStagedStorage(storage);
	const roots = createSenseiPassiveScanRootsForConfig(config);
	let discoveryEventCount = 0;
	const service = createSessionIngestService({
		roots,
		registries: createSenseiPassiveIngestRegistries(),
		...staged.bindings,
		onDiscoveryEvent(event) {
			discoveryEventCount++;
			staged.bindings.onDiscoveryEvent?.(event);
		},
	});
	try {
		await service.scanNow();
		return {
			rootCount: roots.length,
			discoveryEventCount,
			writeSummary: staged.summary,
			coverage: staged.coverage,
		};
	} finally {
		staged.close();
		storage.close();
	}
}
