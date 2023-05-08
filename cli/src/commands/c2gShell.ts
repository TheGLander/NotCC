import { ScriptRunner, C2G_NOTCC_VERSION, ScriptInterrupt } from "@notcc/logic"
import { errorAndExit } from "../helpers.js"
import { createInterface } from "readline"
import fs from "fs"
import { resolve } from "path"
import pc from "picocolors"
import { Argv } from "yargs"

const inf = createInterface({ input: process.stdin, output: process.stdout })
function question(prompt: string): Promise<string> {
	return new Promise(res => {
		inf.question(prompt, ans => res(ans))
	})
}

function resolveInterrupt(runner: ScriptRunner, interrupt: ScriptInterrupt) {
	if (interrupt.type === "chain") {
		const c2gPath = resolve(
			process.cwd(),
			interrupt.path.replace(/^~/, process.env.HOME ?? "")
		)

		if (!fs.existsSync(c2gPath)) {
			errorAndExit("A chain path must lead to a file!")
		}
		const c2gData = fs.readFileSync(c2gPath, "latin1")
		runner.handleChainInterrupt(c2gData)
		return
	} else if (interrupt.type === "script") {
		console.log(interrupt.text)
		runner.scriptInterrupt = null
		return
	} else if (interrupt.type === "map") {
		console.warn("`map` interrupts aren't supported in the shell.")
		runner.handleMapInterrupt({ type: "skip" })
		return
	}
}

async function startC2GShell(): Promise<void> {
	console.log(
		pc.green(`NotCC C2G Shell version ${pc.bold(`${C2G_NOTCC_VERSION}`)}`)
	)
	const runner = new ScriptRunner('game "C2G shell"')
	runner.executeLine()

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const newScriptLines: string[] = []
		let scriptLine: string
		let firstLine = true
		do {
			scriptLine = await question(firstLine ? "> " : ". ")
			newScriptLines.push(scriptLine.replace(/\\$/, ""))
			firstLine = false
		} while (scriptLine.endsWith("\\"))
		runner.scriptLines.push(...newScriptLines)
		runner.generateLabels()
		let interrupt: ScriptInterrupt | null

		while ((interrupt = runner.executeUntilInterrupt())) {
			resolveInterrupt(runner, interrupt)
		}
	}
}

export default (yargs: Argv): Argv =>
	yargs.command("c2g", "Launches a C2G shell", startC2GShell)
