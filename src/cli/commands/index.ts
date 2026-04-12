import type { SenseiCliCommandHandler, SenseiCliCommandName } from "../types";

export { runAnalyzeCommand } from "./analyze";
export { runDraftCommand } from "./draft";
export { createIngestCommandHandler, runIngestCommand } from "./ingest";
export { runReportCommand } from "./report";

import { runAnalyzeCommand } from "./analyze";
import { runDraftCommand } from "./draft";
import { runIngestCommand } from "./ingest";
import { runReportCommand } from "./report";

export const senseiCliCommandHandlers = {
  ingest: runIngestCommand,
  analyze: runAnalyzeCommand,
  report: runReportCommand,
  draft: runDraftCommand,
} as const satisfies Record<SenseiCliCommandName, SenseiCliCommandHandler>;
