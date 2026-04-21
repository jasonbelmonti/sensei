import { createHash } from "node:crypto";

import { buildNearCanonicalPromptText } from "./near-prompt-canonical-text";

export function buildNearPromptFingerprint(
	promptText: string,
): string | undefined {
	const nearCanonicalPromptText = buildNearCanonicalPromptText(promptText);

	if (nearCanonicalPromptText === undefined) {
		return undefined;
	}

	return createHash("sha256").update(nearCanonicalPromptText).digest("hex");
}
