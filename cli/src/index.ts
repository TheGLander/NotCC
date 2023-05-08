#!/usr/bin/env node
import yargsF from "yargs/yargs"
import { hideBin } from "yargs/helpers"
import commands from "./commands/index.js"

let yargs = yargsF(hideBin(process.argv))

for (const func of commands) yargs = func(yargs)

yargs.strictCommands().demandCommand().completion().recommendCommands().parse()
