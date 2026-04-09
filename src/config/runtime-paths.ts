import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export type SenseiEnvironment = Readonly<Record<string, string | undefined>>;

export type SenseiProviderRoots = {
  claude: string;
  codex: string;
};

export type SenseiGeneratedPaths = {
  root: string;
  skills: string;
  scripts: string;
  automations: string;
};

export type SenseiRuntimePaths = {
  repoRoot: string;
  homeRoot: string;
  dataRoot: string;
  cacheRoot: string;
  reportsRoot: string;
  databasePath: string;
  providers: SenseiProviderRoots;
  generated: SenseiGeneratedPaths;
};

export type ResolveSenseiRuntimePathsOptions = {
  repoRoot: string;
  homeDir?: string;
  env?: SenseiEnvironment;
};

export function resolveSenseiRuntimePaths(
  options: ResolveSenseiRuntimePathsOptions,
): SenseiRuntimePaths {
  const env = options.env ?? process.env;
  const resolvedHomeDir = resolve(options.homeDir ?? homedir());
  const repoRoot = resolve(options.repoRoot);

  const homeRoot = resolveWithBase(
    resolvedHomeDir,
    env.SENSEI_HOME,
    join(resolvedHomeDir, ".sensei"),
  );
  const dataRoot = join(homeRoot, "data");
  const cacheRoot = join(homeRoot, "cache");
  const reportsRoot = join(homeRoot, "reports");
  const generatedRoot = resolveWithBase(
    repoRoot,
    env.SENSEI_GENERATED_ROOT,
    join(repoRoot, "generated"),
  );

  return {
    repoRoot,
    homeRoot,
    dataRoot,
    cacheRoot,
    reportsRoot,
    databasePath: join(dataRoot, "sensei.sqlite"),
    providers: {
      claude: resolveWithBase(
        resolvedHomeDir,
        env.SENSEI_CLAUDE_ROOT,
        join(resolvedHomeDir, ".claude"),
      ),
      codex: resolveWithBase(
        resolvedHomeDir,
        env.SENSEI_CODEX_ROOT,
        join(resolvedHomeDir, ".codex"),
      ),
    },
    generated: {
      root: generatedRoot,
      skills: join(generatedRoot, "skills"),
      scripts: join(generatedRoot, "scripts"),
      automations: join(generatedRoot, "automations"),
    },
  };
}

function resolveWithBase(
  basePath: string,
  overrideValue: string | undefined,
  defaultPath: string,
): string {
  const normalizedOverride = overrideValue?.trim();

  if (!normalizedOverride) {
    return defaultPath;
  }

  return isAbsolute(normalizedOverride)
    ? resolve(normalizedOverride)
    : resolve(basePath, normalizedOverride);
}
