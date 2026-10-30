import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { canonicalIngestRows } from "./legacy-storage.fixture.js";
import { createStoredService } from "./owned-service.fixture.js";
import {
  createRealIngestFixture,
  legacyFixtureRoot,
} from "./real-ingest.fixture.js";

test("owned readers match the frozen incumbent storage results before production cutover", async () => {
  const fixture = createRealIngestFixture();
  try {
    await createStoredService(fixture).scanNow();
    expect(canonicalIngestRows(fixture.storage, fixture.rootDir)).toEqual(
      JSON.parse(
        readFileSync(join(legacyFixtureRoot, "expected-watch.json"), "utf8"),
      ),
    );
  } finally {
    fixture.cleanup();
  }
});
