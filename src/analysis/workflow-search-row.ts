import type { StoreWorkflowSearchDocumentInput } from "../storage";

import type { WriteReadyTurnFeatureRow } from "./turn-feature-row";

export type WriteReadyWorkflowSearchRow = StoreWorkflowSearchDocumentInput;

export type WorkflowSearchSourceTurnFeature = Pick<
  WriteReadyTurnFeatureRow,
  "provider" | "sessionId" | "turnId" | "featureVersion" | "analyzedAt" | "detail"
>;
