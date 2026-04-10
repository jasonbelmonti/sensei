import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRepositoryAreas } from "../../src/index";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("repository scaffold exposes the planned top-level source areas", () => {
  expect(getRepositoryAreas()).toEqual([
    "analysis",
    "cli",
    "config",
    "drafting",
    "ingest",
    "reporting",
    "storage",
  ]);

  for (const area of getRepositoryAreas()) {
    expect(existsSync(join(rootDir, "src", area))).toBe(true);
  }
});

test("package scripts and documentation describe the bootstrap surface", async () => {
  const packageJson = await Bun.file(join(rootDir, "package.json")).json();
  const readme = await Bun.file(join(rootDir, "README.md")).text();

  expect(packageJson.name).toBe("sensei");
  expect(packageJson.scripts).toMatchObject({
    lint: "biome lint .",
    sensei: "bun ./src/cli/index.ts",
    test: "bun test",
    typecheck: "tsc --noEmit",
    check: "bun run lint && bun run typecheck && bun run test",
  });
  expect(readme).toContain("@jasonbelmonti/claudex/ingest");
  expect(readme).toContain("local-first mentoring system");
  expect(readme).toContain("bun run sensei -- --help");
  expect(readme).toContain("ingest");
  expect(readme).toContain("analyze");
  expect(readme).toContain("report");
  expect(readme).toContain("draft");
  expect(readme).toContain("placeholder shell");
});
