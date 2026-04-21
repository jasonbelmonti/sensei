import { expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { buildNearPromptFingerprint } from "../../src/analysis";
import { buildNearCanonicalPromptText } from "../../src/analysis/near-prompt-canonical-text";

test("near prompt fingerprint hashes conservative placeholder-normalized prompt text", () => {
	const expectedFingerprint = buildSha256HexDigest(
		"plan the bel senseiticketplaceholder retrieval follow up in senseipathplaceholder before senseinumberplaceholder senseinumberplaceholder senseinumberplaceholder",
	);
	const equivalentPromptTexts = [
		"Plan the BEL-819 retrieval follow-up in /Users/alice/code/sensei/.worktrees/bel-819 before 2026-04-21",
		"Plan the BEL-819 retrieval follow-up in /workspace/sensei/.worktrees/bel-819 before 2026-04-21",
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
	const usersRouteOneFingerprint = buildNearPromptFingerprint(
		"Call /users/me then inspect logs",
	);
	const usersRouteTwoFingerprint = buildNearPromptFingerprint(
		"Call /users/list then inspect logs",
	);
	const privateRouteOneFingerprint = buildNearPromptFingerprint(
		"Call /private/login then inspect logs",
	);
	const privateRouteTwoFingerprint = buildNearPromptFingerprint(
		"Call /private/admin then inspect logs",
	);
	const homeRouteOneFingerprint = buildNearPromptFingerprint(
		"Call /home/account then inspect logs",
	);
	const homeRouteTwoFingerprint = buildNearPromptFingerprint(
		"Call /home/profile then inspect logs",
	);
	const dotRouteOneFingerprint = buildNearPromptFingerprint(
		"Fetch /.well-known/openid-configuration for provider A",
	);
	const dotRouteTwoFingerprint = buildNearPromptFingerprint(
		"Fetch /.well-known/jwks.json for provider A",
	);
	const rootedFileLikeRouteOneFingerprint = buildNearPromptFingerprint(
		"Fetch /v1/openapi.json for provider A",
	);
	const rootedFileLikeRouteTwoFingerprint = buildNearPromptFingerprint(
		"Fetch /v1/spec.json for provider A",
	);
	const unrootedFileLikeRouteOneFingerprint = buildNearPromptFingerprint(
		"Fetch api/v1/openapi.json for provider A",
	);
	const unrootedFileLikeRouteTwoFingerprint = buildNearPromptFingerprint(
		"Fetch api/v1/spec.json for provider A",
	);
	const hiddenRouteOneFingerprint = buildNearPromptFingerprint(
		"Fetch api/.well-known/openid-configuration for provider A",
	);
	const hiddenRouteTwoFingerprint = buildNearPromptFingerprint(
		"Fetch api/.well-known/jwks.json for provider A",
	);

	expect(apiVersionOneFingerprint).toBeDefined();
	expect(apiVersionTwoFingerprint).toBeDefined();
	expect(rootedRouteOneFingerprint).toBeDefined();
	expect(rootedRouteTwoFingerprint).toBeDefined();
	expect(usersRouteOneFingerprint).toBeDefined();
	expect(usersRouteTwoFingerprint).toBeDefined();
	expect(privateRouteOneFingerprint).toBeDefined();
	expect(privateRouteTwoFingerprint).toBeDefined();
	expect(homeRouteOneFingerprint).toBeDefined();
	expect(homeRouteTwoFingerprint).toBeDefined();
	expect(dotRouteOneFingerprint).toBeDefined();
	expect(dotRouteTwoFingerprint).toBeDefined();
	expect(rootedFileLikeRouteOneFingerprint).toBeDefined();
	expect(rootedFileLikeRouteTwoFingerprint).toBeDefined();
	expect(unrootedFileLikeRouteOneFingerprint).toBeDefined();
	expect(unrootedFileLikeRouteTwoFingerprint).toBeDefined();
	expect(hiddenRouteOneFingerprint).toBeDefined();
	expect(hiddenRouteTwoFingerprint).toBeDefined();
	expect(apiVersionOneFingerprint).not.toBe(apiVersionTwoFingerprint);
	expect(rootedRouteOneFingerprint).not.toBe(rootedRouteTwoFingerprint);
	expect(usersRouteOneFingerprint).not.toBe(usersRouteTwoFingerprint);
	expect(privateRouteOneFingerprint).not.toBe(privateRouteTwoFingerprint);
	expect(homeRouteOneFingerprint).not.toBe(homeRouteTwoFingerprint);
	expect(dotRouteOneFingerprint).not.toBe(dotRouteTwoFingerprint);
	expect(rootedFileLikeRouteOneFingerprint).not.toBe(
		rootedFileLikeRouteTwoFingerprint,
	);
	expect(unrootedFileLikeRouteOneFingerprint).not.toBe(
		unrootedFileLikeRouteTwoFingerprint,
	);
	expect(hiddenRouteOneFingerprint).not.toBe(hiddenRouteTwoFingerprint);
	expect(
		buildNearCanonicalPromptText(
			"Fetch /.well-known/openid-configuration for provider A",
		),
	).toBe("fetch well known openid configuration for provider a");
	expect(
		buildNearCanonicalPromptText("Fetch /.well-known/jwks.json for provider A"),
	).toBe("fetch well known jwks json for provider a");
	expect(
		buildNearCanonicalPromptText("Fetch /v1/openapi.json for provider A"),
	).toBe("fetch v1 openapi json for provider a");
	expect(
		buildNearCanonicalPromptText("Fetch /v1/spec.json for provider A"),
	).toBe("fetch v1 spec json for provider a");
	expect(
		buildNearCanonicalPromptText("Fetch api/v1/openapi.json for provider A"),
	).toBe("fetch api v1 openapi json for provider a");
	expect(
		buildNearCanonicalPromptText("Fetch api/v1/spec.json for provider A"),
	).toBe("fetch api v1 spec json for provider a");
	expect(
		buildNearCanonicalPromptText(
			"Fetch api/.well-known/openid-configuration for provider A",
		),
	).toBe("fetch api well known openid configuration for provider a");
	expect(
		buildNearCanonicalPromptText(
			"Fetch api/.well-known/jwks.json for provider A",
		),
	).toBe("fetch api well known jwks json for provider a");
	expect(
		buildNearCanonicalPromptText("Call /private/login then inspect logs"),
	).toBe("call private login then inspect logs");
	expect(
		buildNearCanonicalPromptText("Call /home/account then inspect logs"),
	).toBe("call home account then inspect logs");
});

test("near prompt fingerprint only normalizes conservative ticket identifiers", () => {
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
	const hyphenatedHttpFingerprint = buildNearPromptFingerprint(
		"Investigate HTTP-404 issue",
	);
	const hyphenatedIsoFingerprint = buildNearPromptFingerprint(
		"Investigate ISO-27001 issue",
	);

	expect(uppercaseTicketFingerprint).toBeDefined();
	expect(lowercaseTicketFingerprint).toBeDefined();
	expect(httpFingerprint).toBeDefined();
	expect(isoFingerprint).toBeDefined();
	expect(hyphenatedHttpFingerprint).toBeDefined();
	expect(hyphenatedIsoFingerprint).toBeDefined();
	expect(uppercaseTicketFingerprint).toBe(lowercaseTicketFingerprint);
	expect(httpFingerprint).toBe(
		buildSha256HexDigest("investigate http senseinumberplaceholder issue"),
	);
	expect(isoFingerprint).toBe(
		buildSha256HexDigest("investigate iso senseinumberplaceholder issue"),
	);
	expect(hyphenatedHttpFingerprint).toBe(
		buildSha256HexDigest("investigate http senseinumberplaceholder issue"),
	);
	expect(hyphenatedIsoFingerprint).toBe(
		buildSha256HexDigest("investigate iso senseinumberplaceholder issue"),
	);
});

test("near prompt fingerprint normalizes equivalent Windows absolute paths across separators", () => {
	const backslashPathFingerprint = buildNearPromptFingerprint(
		"Inspect C:\\work\\sensei\\notes.txt before follow up",
	);
	const slashPathFingerprint = buildNearPromptFingerprint(
		"Inspect C:/work/sensei/notes.txt before follow up",
	);

	expect(backslashPathFingerprint).toBeDefined();
	expect(slashPathFingerprint).toBeDefined();
	expect(backslashPathFingerprint).toBe(slashPathFingerprint);
});

test("near prompt fingerprint normalizes workspace absolute paths as filesystem paths", () => {
	const usersWorkspaceFingerprint = buildNearPromptFingerprint(
		"Inspect /Users/alice/code/sensei/README.md before follow up",
	);
	const containerWorkspaceFingerprint = buildNearPromptFingerprint(
		"Inspect /workspace/sensei/README.md before follow up",
	);

	expect(usersWorkspaceFingerprint).toBeDefined();
	expect(containerWorkspaceFingerprint).toBeDefined();
	expect(usersWorkspaceFingerprint).toBe(containerWorkspaceFingerprint);
	expect(
		buildNearCanonicalPromptText(
			"Inspect /workspace/sensei/README.md before follow up",
		),
	).toBe("inspect senseipathplaceholder before follow up");
});

test("near prompt fingerprint still normalizes unrooted repo-relative filesystem paths", () => {
	const sourcePathFingerprint = buildNearPromptFingerprint(
		"Inspect src/analysis/index.ts before follow up",
	);
	const punctuatedSourcePathFingerprint = buildNearPromptFingerprint(
		"Inspect src/analysis/index.ts, before follow up",
	);
	const wrappedSourcePathFingerprint = buildNearPromptFingerprint(
		"Inspect (src/analysis/index.ts) before follow up",
	);
	const testPathFingerprint = buildNearPromptFingerprint(
		"Inspect src/storage/index.ts before follow up",
	);
	const hiddenSourcePathFingerprint = buildNearPromptFingerprint(
		"Inspect src/.generated/index.ts before follow up",
	);
	const hiddenTestPathFingerprint = buildNearPromptFingerprint(
		"Inspect src/.cache/index.ts before follow up",
	);

	expect(sourcePathFingerprint).toBeDefined();
	expect(punctuatedSourcePathFingerprint).toBeDefined();
	expect(wrappedSourcePathFingerprint).toBeDefined();
	expect(testPathFingerprint).toBeDefined();
	expect(hiddenSourcePathFingerprint).toBeDefined();
	expect(hiddenTestPathFingerprint).toBeDefined();
	expect(sourcePathFingerprint).toBe(testPathFingerprint);
	expect(sourcePathFingerprint).toBe(punctuatedSourcePathFingerprint);
	expect(sourcePathFingerprint).toBe(wrappedSourcePathFingerprint);
	expect(hiddenSourcePathFingerprint).toBe(hiddenTestPathFingerprint);
	expect(
		buildNearCanonicalPromptText(
			"Inspect src/analysis/index.ts before follow up",
		),
	).toBe("inspect senseipathplaceholder before follow up");
	expect(
		buildNearCanonicalPromptText(
			"Inspect src/.generated/index.ts before follow up",
		),
	).toBe("inspect senseipathplaceholder before follow up");
	expect(
		buildNearCanonicalPromptText(
			"Inspect src/analysis/index.ts, before follow up",
		),
	).toBe("inspect senseipathplaceholder before follow up");
	expect(
		buildNearCanonicalPromptText(
			"Inspect (src/analysis/index.ts) before follow up",
		),
	).toBe("inspect senseipathplaceholder before follow up");
});

test("near prompt fingerprint returns undefined for normalization-empty prompt text", () => {
	expect(buildNearPromptFingerprint("   ")).toBeUndefined();
	expect(buildNearPromptFingerprint("... --- !!!")).toBeUndefined();
});

function buildSha256HexDigest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}
