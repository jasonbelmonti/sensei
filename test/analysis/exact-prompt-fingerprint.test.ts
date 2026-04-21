import { createHash } from "node:crypto";
import { expect, test } from "bun:test";

import { buildExactPromptFingerprint } from "../../src/analysis";

test("exact prompt fingerprint hashes normalized prompt text", () => {
  const expectedFingerprint = buildSha256HexDigest(
    "plan the bel 807 retrieval follow up",
  );
  const equivalentPromptTexts = [
    "Plan the BEL 807 retrieval follow up",
    "  PLAN   the... BEL-807 retrieval follow-up!  ",
    "\nPlan\tTHE bel 807 retrieval -- follow up??\n",
  ];

  for (const promptText of equivalentPromptTexts) {
    expect(buildExactPromptFingerprint(promptText)).toBe(expectedFingerprint);
  }
});

test("exact prompt fingerprint returns undefined for normalization-empty prompt text", () => {
  expect(buildExactPromptFingerprint("   ")).toBeUndefined();
  expect(buildExactPromptFingerprint("... --- !!!")).toBeUndefined();
});

function buildSha256HexDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
