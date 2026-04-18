export type NormalizedPrompt = {
  text: string;
  lines: string[];
  lineCount: number;
  bulletLineCount: number;
  numberedLineCount: number;
  codeFenceCount: number;
  questionLineCount: number;
  headingLineCount: number;
};

export function normalizePromptForAnalysis(prompt: string): NormalizedPrompt {
  const text = prompt.toLowerCase().replace(/\r\n?/g, "\n");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    text,
    lines,
    lineCount: lines.length,
    bulletLineCount: countMatchingLines(lines, BULLET_LINE_PATTERN),
    numberedLineCount: countMatchingLines(lines, NUMBERED_LINE_PATTERN),
    codeFenceCount: countPatternMatches(text, [CODE_FENCE_PATTERN]),
    questionLineCount: countMatchingLines(lines, QUESTION_LINE_PATTERN),
    headingLineCount: countMatchingLines(lines, HEADING_LINE_PATTERN),
  };
}

export function countPatternMatches(
  text: string,
  patterns: readonly RegExp[],
): number {
  let total = 0;

  for (const pattern of patterns) {
    total += countPatternMatchesInText(text, pattern);
  }

  return total;
}

export function isQuestionLikeLine(line: string): boolean {
  return QUESTION_LINE_PATTERN.test(line);
}

function countMatchingLines(lines: readonly string[], pattern: RegExp): number {
  let count = 0;

  for (const line of lines) {
    if (pattern.test(line)) {
      count += 1;
    }
  }

  return count;
}

function countPatternMatchesInText(text: string, pattern: RegExp): number {
  let count = 0;

  for (const _ of text.matchAll(toGlobalPattern(pattern))) {
    count += 1;
  }

  return count;
}

function toGlobalPattern(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;

  return new RegExp(pattern.source, flags);
}

const BULLET_LINE_PATTERN = /^[-*+]\s+\S+/;
const NUMBERED_LINE_PATTERN = /^\d+[\.\)]\s+\S+/;
const CODE_FENCE_PATTERN = /```/g;
const QUESTION_LINE_PATTERN = /^(?:.+\?|who\b|what\b|when\b|where\b|why\b|how\b)/;
const HEADING_LINE_PATTERN =
  /^(?:#{1,6}\s+\S+|[a-z0-9][a-z0-9 /-]{0,80}:)$/;
