import type {
  StoreCursorInput,
  StoreSessionInput,
  StoreToolEventInput,
  StoreTurnInput,
  StoreTurnUsageInput,
} from "../storage";

export type PassiveScanRecordStorageWrites = {
  session?: StoreSessionInput;
  turn?: StoreTurnInput;
  prerequisiteTurn?: StoreTurnInput;
  turnUsage?: StoreTurnUsageInput;
  toolEvent?: StoreToolEventInput;
  cursor?: StoreCursorInput;
};
