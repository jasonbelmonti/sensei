import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SenseiStorage } from "../../src/storage";
import { openSenseiStorage } from "../../src/storage";

export function createStorageTestHarness(prefix: string): {
	rootDir: string;
	databasePath: string;
	storage: SenseiStorage;
	cleanup: () => void;
} {
	const rootDir = mkdtempSync(join(tmpdir(), `${prefix}-`));
	const databasePath = join(rootDir, "sensei.sqlite");
	const storage = openSenseiStorage({
		databasePath,
	});

	return {
		rootDir,
		databasePath,
		storage,
		cleanup() {
			storage.close();
			rmSync(rootDir, { recursive: true, force: true });
		},
	};
}
