import type {
  DiscoveryEvent,
  IngestWarning,
  ObservedAgentEvent,
  ObservedSessionRecord,
} from "./contracts.js";

export type SenseiPassiveScanObservedEvent = {
  kind: "event";
  observedEvent: ObservedAgentEvent;
};

export type SenseiPassiveScanObservedSession = {
  kind: "session";
  observedSession: ObservedSessionRecord;
};

export type SenseiPassiveScanRecord =
  | SenseiPassiveScanObservedEvent
  | SenseiPassiveScanObservedSession;

export type SenseiPassiveScanResult = {
  records: readonly SenseiPassiveScanRecord[];
  warnings: readonly IngestWarning[];
  discoveryEvents: readonly DiscoveryEvent[];
};
