import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const skillDir = join(rootDir, "skills", "sensei");

function readSkillFile(...relativePath: string[]) {
  return Bun.file(join(skillDir, ...relativePath)).text();
}

test("repo-local sensei skill shell is present in the bootstrap scaffold", () => {
  expect(existsSync(skillDir)).toBe(true);
  expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
  expect(existsSync(join(skillDir, "agents", "openai.yaml"))).toBe(true);
});

test("repo-local sensei skill shell stays aligned to the lean v0 bootstrap", async () => {
  const skillMarkdown = await readSkillFile("SKILL.md");
  const openAiInterface = await readSkillFile("agents", "openai.yaml");

  expect(skillMarkdown).toContain("name: sensei");
  expect(skillMarkdown).toContain("repo-local mentoring surface");
  expect(skillMarkdown).toContain("intentionally lean");
  expect(skillMarkdown).toContain("$sensei");
  expect(skillMarkdown).toContain("bun run sensei -- --help");
  expect(skillMarkdown).toContain("Do not invent mentoring analysis");

  expect(openAiInterface).toContain("interface:");
  expect(openAiInterface).toContain('display_name: "Sensei"');
  expect(openAiInterface).toContain(
    'short_description: "Repo-local mentoring surface for Sensei"',
  );
  expect(openAiInterface).toContain('default_prompt: "Use $sensei');
  expect(openAiInterface).toContain("generated Sensei artifacts");
});
