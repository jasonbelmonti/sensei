import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const smokeTestRootDir = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

export function runPackageCliCommand(
	args: readonly string[],
	options: {
		cwd?: string;
		env?: Record<string, string | undefined>;
	} = {},
) {
	return spawnSync(process.execPath, ["run", "sensei", "--", ...args], {
		cwd: options.cwd ?? smokeTestRootDir,
		encoding: "utf8",
		env: {
			...process.env,
			...options.env,
		},
	});
}
