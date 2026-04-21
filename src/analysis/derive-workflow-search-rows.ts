import type { OrderedAnalysisTurnInput } from "../storage";

import { buildWorkflowSearchRow } from "./build-workflow-search-row";
import type {
  WorkflowSearchSourceTurnFeature,
  WriteReadyWorkflowSearchRow,
} from "./workflow-search-row";

export function deriveWorkflowSearchRows(
  orderedTurns: readonly OrderedAnalysisTurnInput[],
  turnFeatures: readonly WorkflowSearchSourceTurnFeature[],
): WriteReadyWorkflowSearchRow[] {
  const turnFeaturesByTurn = indexWorkflowSearchTurnFeatures(turnFeatures);
  const rows: WriteReadyWorkflowSearchRow[] = [];

  for (const orderedTurn of orderedTurns) {
    const sourceTurnFeature = getWorkflowSearchSourceTurnFeature(
      turnFeaturesByTurn,
      orderedTurn,
    );

    if (sourceTurnFeature === undefined) {
      continue;
    }

    const workflowSearchRow = buildWorkflowSearchRow(
      orderedTurn,
      sourceTurnFeature,
    );

    if (workflowSearchRow === undefined) {
      continue;
    }

    rows.push(workflowSearchRow);
  }

  return rows;
}

function indexWorkflowSearchTurnFeatures(
  turnFeatures: readonly WorkflowSearchSourceTurnFeature[],
): Map<string, WorkflowSearchSourceTurnFeature> {
  const indexedTurnFeatures = new Map<string, WorkflowSearchSourceTurnFeature>();

  for (const turnFeature of turnFeatures) {
    indexedTurnFeatures.set(
      createTurnKey(turnFeature.provider, turnFeature.sessionId, turnFeature.turnId),
      turnFeature,
    );
  }

  return indexedTurnFeatures;
}

function getWorkflowSearchSourceTurnFeature(
  turnFeaturesByTurn: ReadonlyMap<string, WorkflowSearchSourceTurnFeature>,
  orderedTurn: OrderedAnalysisTurnInput,
): WorkflowSearchSourceTurnFeature | undefined {
  return turnFeaturesByTurn.get(
    createTurnKey(
      orderedTurn.turn.provider,
      orderedTurn.turn.sessionId,
      orderedTurn.turn.turnId,
    ),
  );
}

function createTurnKey(
  provider: string,
  sessionId: string,
  turnId: string,
): string {
  return `${provider}\u0000${sessionId}\u0000${turnId}`;
}
