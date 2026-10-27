#!/usr/bin/env node
import { runSenseiCli } from "./index.js";

process.exitCode = await runSenseiCli(process.argv.slice(2));
