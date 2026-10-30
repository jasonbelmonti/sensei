// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import type { SessionReference } from "../event-contract.js";

export function createCodexSessionReference(
  sessionId: string | null,
): SessionReference | null {
  if (!sessionId) {
    return null;
  }

  return {
    provider: "codex",
    sessionId,
  };
}
