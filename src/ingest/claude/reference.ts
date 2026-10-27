// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import type { SessionReference } from "../event-contract.js";

export function createClaudeSessionReference(
  sessionId: string | null | undefined,
): SessionReference | null {
  if (!sessionId) {
    return null;
  }

  return {
    provider: "claude",
    sessionId,
  };
}
