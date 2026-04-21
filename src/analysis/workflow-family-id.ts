import { createHash } from "node:crypto";

import type { ExactWorkflowFamilyGroup } from "./workflow-family-output";

export function buildWorkflowFamilyId(
	seedGroup: ExactWorkflowFamilyGroup,
): string {
	const seed = ["workflow-family", seedGroup.key].join("\u0000");

	return `wf_${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}
