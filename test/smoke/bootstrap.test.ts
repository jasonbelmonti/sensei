import { expect, test } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRepositoryAreas } from "../../src/index.js";

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
  const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"));
  const readme = await readFile(join(rootDir, "README.md"), "utf8");

  expect(packageJson.name).toBe("sensei");
  expect(packageJson.scripts).toMatchObject({
    lint: "biome lint .",
    sensei: "node ./dist/cli/main.js",
    build: "tsc -p tsconfig.build.json",
    pretest: "npm run build",
    test: "vitest run",
    typecheck: "tsc --noEmit",
    check: "npm run lint && npm run typecheck && npm test",
  });
  expect(readme).toContain("Sensei-owned readers");
  expect(readme).toContain("local-first mentoring system");
  expect(readme).toContain("npm run sensei -- --help");
  expect(readme).toContain("ingest");
  expect(readme).toContain("analyze");
  expect(readme).toContain("report");
  expect(readme).toContain("draft");
  expect(readme).toContain("placeholder shell");
});
