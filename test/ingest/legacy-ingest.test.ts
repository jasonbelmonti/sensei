import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createSenseiPassiveScanAdapterForProviderRoots } from "../../src/ingest/passive-scan.js";
import { writePassiveScanResultToStorage } from "../../src/ingest/storage-writer.js";
import { createSenseiIngestWatch } from "../../src/ingest/watch.js";
import { canonicalIngestRows } from "./legacy-storage.fixture.js";
import {
  createRealIngestFixture,
  legacyFixtureRoot,
} from "./real-ingest.fixture.js";

for (const mode of ["scan", "watch"] as const) {
  test(`real ${mode} preserves frozen records from all four legacy input families`, async () => {
    const fixture = createRealIngestFixture();
    const watch = createSenseiIngestWatch(fixture.config, {
      storage: fixture.storage,
    });
    try {
      if (mode === "scan") {
        const result = await createSenseiPassiveScanAdapterForProviderRoots(
          fixture.roots,
        ).scanNow();
        writePassiveScanResultToStorage(fixture.storage, result);
      } else {
        await watch.start();
        await watch.stop();
      }
      const expected = JSON.parse(
        readFileSync(join(legacyFixtureRoot, `expected-${mode}.json`), "utf8"),
      );
      expect(canonicalIngestRows(fixture.storage, fixture.rootDir)).toEqual(
        expected,
      );
      expect(
        fixture.storage.database
          .query("SELECT count(*) AS count FROM ingest_cursors")
          .get(),
      ).toEqual({ count: 6 });
    } finally {
      await watch.stop();
      fixture.cleanup();
    }
  });
}
