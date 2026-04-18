import type { TurnFeatureAnalyzerSnapshot } from "../turn-feature-row";
import { analyzeLexicalCueRules } from "./lexical-cue-analysis";

const WORKFLOW_INTENT_RULES = [
  {
    label: "implement",
    countKey: "implement",
    patterns: [
      /\bimplement\b/,
      /\bbuild\b/,
      /\bcreate\b/,
      /\badd\b/,
      /\bwire\b/,
      /\bship\b/,
    ],
    reason: "matched implement intent lexical cues",
  },
  {
    label: "debug",
    countKey: "debug",
    patterns: [
      /\bdebug\b/,
      /\bfix\b/,
      /\bbroken\b/,
      /\bfailing\b/,
      /\berror\b/,
      /\btimeout\b/,
      /\bregression\b/,
      /\bbug\b/,
    ],
    reason: "matched debug intent lexical cues",
  },
  {
    label: "review",
    countKey: "review",
    patterns: [/\breview\b/, /\baudit\b/, /\binspect\b/, /\bcritique\b/],
    reason: "matched review intent lexical cues",
  },
  {
    label: "plan",
    countKey: "plan",
    patterns: [
      /\bplan\b/,
      /\boutline\b/,
      /\bdecompose\b/,
      /\broadmap\b/,
      /\bdesign\b/,
    ],
    reason: "matched planning intent lexical cues",
  },
  {
    label: "explain",
    countKey: "explain",
    patterns: [
      /\bexplain\b/,
      /\bdescribe\b/,
      /\bsummarize\b/,
      /\bwalk through\b/,
      /\bhow does\b/,
    ],
    reason: "matched explain intent lexical cues",
  },
  {
    label: "refactor",
    countKey: "refactor",
    patterns: [
      /\brefactor\b/,
      /\bsimplify\b/,
      /\bclean up\b/,
      /\breorganize\b/,
      /\bextract\b/,
    ],
    reason: "matched refactor intent lexical cues",
  },
  {
    label: "setup",
    countKey: "setup",
    patterns: [
      /\bsetup\b/,
      /\binstall\b/,
      /\bconfigure\b/,
      /\bbootstrap\b/,
      /\binitialize\b/,
    ],
    reason: "matched setup intent lexical cues",
  },
  {
    label: "research",
    countKey: "research",
    patterns: [
      /\bresearch\b/,
      /\bevaluate\b/,
      /\bcompare\b/,
      /\bsurvey\b/,
      /\blook up\b/,
      /\bfind options\b/,
    ],
    reason: "matched research intent lexical cues",
  },
] as const;

export function analyzeWorkflowIntent(
  prompt: string,
): TurnFeatureAnalyzerSnapshot {
  return analyzeLexicalCueRules(prompt, "workflow-intent", WORKFLOW_INTENT_RULES);
}
