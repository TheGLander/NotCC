#! /usr/bin/env node
import { verifyLevelFiles } from "./verifyLevels"
import { errorAndExit } from "./helpers"
import { startC2GShell } from "./c2gShell"
import { statFile } from "./statLevel"

export interface CLIArguments {
	unpos: string[]
	pos: string[]
	options: Record<string, true>
}

const cliArguments: CLIArguments = { pos: [], unpos: [], options: {} }

for (const arg of process.argv.slice(2)) {
	if (arg.startsWith("-")) {
		cliArguments.unpos.push(arg)
		cliArguments.options[arg.substr(2)] = true
	} else cliArguments.pos.push(arg)
}

if (cliArguments.options.help)
	errorAndExit(
		`notcc: An emulator of the game "Chip's Challenge"
Usage: notcc <command>
	notcc verify <levelPath>
	notcc c2g
	notcc stat <filePath>
Commands:
	verify - Verifies a level set by the in-baked solutions
	c2g - Starts the C2G shell to experiment with C2G
	stat - Tells if file is a CC-related one, and shows metadata if so
Options:
	--help - Shows this
	--onlyError - Shows only success lines`,
		0
	)

switch (cliArguments.pos[0]) {
	case "verify":
		verifyLevelFiles(cliArguments)
		break
	case "c2g":
		startC2GShell()
		break
	case "stat":
		statFile(cliArguments)
		break
	// Hehehe
	case "csb":
		errorAndExit("Stop the bobs")
		break
	default:
		errorAndExit(`Unrecognized command: ${cliArguments.pos[0]}
Use notcc --help for a list of recognized commands`)
		break
}
