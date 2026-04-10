import type {
  SenseiCliCommandResult,
  SenseiCliContext,
  SenseiCliOutputChannel,
  SenseiCliOutputLine,
} from "./types";

export function writeCliResult(
  context: SenseiCliContext,
  result: SenseiCliCommandResult,
): void {
  for (const line of result.lines) {
    const writer = line.channel === "stdout" ? context.stdout : context.stderr;
    writer(line.text);
  }
}

export function createCommandResult(
  exitCode: number,
  lines: readonly SenseiCliOutputLine[],
): SenseiCliCommandResult {
  return {
    exitCode,
    lines,
  };
}

export function stdoutLine(text: string): SenseiCliOutputLine {
  return createOutputLine("stdout", text);
}

export function stderrLine(text: string): SenseiCliOutputLine {
  return createOutputLine("stderr", text);
}

function createOutputLine(
  channel: SenseiCliOutputChannel,
  text: string,
): SenseiCliOutputLine {
  return {
    channel,
    text,
  };
}
