import type { SenseiCliCommandHandler, SenseiCliCommandName } from "../types.js";

export { createAnalyzeCommandHandler, runAnalyzeCommand } from "./analyze.js";
export { runDraftCommand } from "./draft.js";
export { createIngestCommandHandler, runIngestCommand } from "./ingest.js";
export { runReportCommand } from "./report.js";

import { runAnalyzeCommand } from "./analyze.js";
import { runDraftCommand } from "./draft.js";
import { runIngestCommand } from "./ingest.js";
import { runReportCommand } from "./report.js";

export const senseiCliCommandHandlers = {
	ingest: runIngestCommand,
	analyze: runAnalyzeCommand,
	report: runReportCommand,
	draft: runDraftCommand,
} as const satisfies Record<SenseiCliCommandName, SenseiCliCommandHandler>;
