import { createHash } from "node:crypto";

import { normalizeWorkflowSearchPromptText } from "./workflow-search-text";

export function buildExactPromptFingerprint(
  promptText: string,
): string | undefined {
  const normalizedPromptText = normalizeWorkflowSearchPromptText(promptText);

  if (normalizedPromptText.length === 0) {
    return undefined;
  }

  return createHash("sha256")
    .update(normalizedPromptText)
    .digest("hex");
}
