import type {
  StoreCursorInput,
  StoreSessionInput,
  StoreToolEventInput,
  StoreTurnInput,
  StoreTurnUsageInput,
} from "../storage/index.js";

export type PassiveScanRecordStorageWrites = {
  session?: StoreSessionInput;
  turn?: StoreTurnInput;
  prerequisiteTurn?: StoreTurnInput;
  turnUsage?: StoreTurnUsageInput;
  toolEvent?: StoreToolEventInput;
  cursor?: StoreCursorInput;
};
