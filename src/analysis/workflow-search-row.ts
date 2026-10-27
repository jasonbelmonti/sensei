import type { StoreWorkflowSearchDocumentInput } from "../storage/index.js";

import type { WriteReadyTurnFeatureRow } from "./turn-feature-row.js";

export type WriteReadyWorkflowSearchRow = StoreWorkflowSearchDocumentInput;

export type WorkflowSearchSourceTurnFeature = Pick<
  WriteReadyTurnFeatureRow,
  "provider" | "sessionId" | "turnId" | "featureVersion" | "analyzedAt" | "detail"
>;
