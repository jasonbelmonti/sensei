import { expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { buildNearPromptFingerprint } from "../../src/analysis";

test("near prompt fingerprint hashes conservative placeholder-normalized prompt text", () => {
	const expectedFingerprint = buildSha256HexDigest(
		"plan the bel senseiticketplaceholder retrieval follow up in senseipathplaceholder before senseinumberplaceholder senseinumberplaceholder senseinumberplaceholder",
	);
	const equivalentPromptTexts = [
		"Plan the BEL-819 retrieval follow-up in /Users/alice/code/sensei/.worktrees/bel-819 before 2026-04-21",
		"  PLAN the BEL 820 retrieval -- follow up in ./sensei/.worktrees/bel-820 before 2027/05/09  ",
		"Plan the BEL_821 retrieval follow up in C:\\work\\sensei\\bel-821 before 2028-06-11",
	];

	for (const promptText of equivalentPromptTexts) {
		expect(buildNearPromptFingerprint(promptText)).toBe(expectedFingerprint);
	}
});

test("near prompt fingerprint preserves materially different lexical intent", () => {
	const retrievalFingerprint = buildNearPromptFingerprint(
		"Plan the BEL-819 retrieval follow-up in ./sensei/.worktrees/bel-819 before 2026-04-21",
	);
	const summaryFingerprint = buildNearPromptFingerprint(
		"Summarize the BEL-820 incident review in ./sensei/.worktrees/bel-820 before 2027-05-09",
	);

	expect(retrievalFingerprint).toBeDefined();
	expect(summaryFingerprint).toBeDefined();
	expect(retrievalFingerprint).not.toBe(summaryFingerprint);
});

test("near prompt fingerprint does not collapse non-filesystem slash tokens or rooted routes", () => {
	const apiVersionOneFingerprint = buildNearPromptFingerprint(
		"Investigate api/v1/users auth flow",
	);
	const apiVersionTwoFingerprint = buildNearPromptFingerprint(
		"Investigate api/v2/users auth flow",
	);
	const rootedRouteOneFingerprint = buildNearPromptFingerprint(
		"Call /v1/responses then inspect logs",
	);
	const rootedRouteTwoFingerprint = buildNearPromptFingerprint(
		"Call /v1/files then inspect logs",
	);

	expect(apiVersionOneFingerprint).toBeDefined();
	expect(apiVersionTwoFingerprint).toBeDefined();
	expect(rootedRouteOneFingerprint).toBeDefined();
	expect(rootedRouteTwoFingerprint).toBeDefined();
	expect(apiVersionOneFingerprint).not.toBe(apiVersionTwoFingerprint);
	expect(rootedRouteOneFingerprint).not.toBe(rootedRouteTwoFingerprint);
});

test("near prompt fingerprint only normalizes conservative space-separated ticket identifiers", () => {
	const uppercaseTicketFingerprint = buildNearPromptFingerprint(
		"Plan BEL 820 follow up",
	);
	const lowercaseTicketFingerprint = buildNearPromptFingerprint(
		"Plan bel 820 follow up",
	);
	const httpFingerprint = buildNearPromptFingerprint(
		"Investigate HTTP 404 issue",
	);
	const isoFingerprint = buildNearPromptFingerprint(
		"Investigate ISO 27001 issue",
	);

	expect(uppercaseTicketFingerprint).toBeDefined();
	expect(lowercaseTicketFingerprint).toBeDefined();
	expect(httpFingerprint).toBeDefined();
	expect(isoFingerprint).toBeDefined();
	expect(uppercaseTicketFingerprint).toBe(lowercaseTicketFingerprint);
	expect(httpFingerprint).toBe(
		buildSha256HexDigest("investigate http senseinumberplaceholder issue"),
	);
	expect(isoFingerprint).toBe(
		buildSha256HexDigest("investigate iso senseinumberplaceholder issue"),
	);
});

test("near prompt fingerprint returns undefined for normalization-empty prompt text", () => {
	expect(buildNearPromptFingerprint("   ")).toBeUndefined();
	expect(buildNearPromptFingerprint("... --- !!!")).toBeUndefined();
});

function buildSha256HexDigest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}
