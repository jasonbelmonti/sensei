import type { TurnFeatureAnalyzerSnapshot } from "../turn-feature-row";
import { analyzeLexicalCueRules } from "./lexical-cue-analysis";

const CORRECTION_MARKER_RULES = [
  {
    label: "fix-cue",
    countKey: "fixCueCount",
    patterns: [/\bfix\b/, /\bdebug\b/, /\brepair\b/, /\bresolve\b/],
    reason: "matched fix-oriented lexical cues",
  },
  {
    label: "failure-cue",
    countKey: "failureCueCount",
    patterns: [
      /\bbroken\b/,
      /\bfailing\b/,
      /\bfailed\b/,
      /\berror\b/,
      /\btimeout\b/,
      /\bregression\b/,
      /\bbug\b/,
    ],
    reason: "matched failure-oriented lexical cues",
  },
  {
    label: "replacement-cue",
    countKey: "replacementCueCount",
    patterns: [
      /\binstead\b/,
      /\breplace\b/,
      /\breplacement\b/,
      /\bchange (?:it|this|that|the)\b/,
    ],
    reason: "matched replacement-oriented lexical cues",
  },
  {
    label: "rollback-cue",
    countKey: "rollbackCueCount",
    patterns: [/\brollback\b/, /\broll back\b/, /\brevert\b/, /\bundo\b/],
    reason: "matched rollback-oriented lexical cues",
  },
  {
    label: "correction-cue",
    countKey: "correctionCueCount",
    patterns: [/\bcorrection\b/, /\bcorrect\b/, /\btypo\b/, /\bmistake\b/],
    reason: "matched correction-oriented lexical cues",
  },
] as const;

export function analyzeCorrectionMarkers(
  prompt: string,
): TurnFeatureAnalyzerSnapshot {
  return analyzeLexicalCueRules(
    prompt,
    "correction-markers",
    CORRECTION_MARKER_RULES,
  );
}
