import { C2GRunner, tokenizeC2G, C2G_NOTCC_VERSION } from "../../logic"
import { errorAndExit } from "./helpers"
import { prompt } from "prompts"
import fs from "fs"
import { resolve } from "path"
import chalk from "chalk"

export async function startC2GShell(): Promise<void> {
	console.log(
		chalk`{green NotCC C2G Shell version {bold ${C2G_NOTCC_VERSION}}}`
	)
	const runner = new C2GRunner(tokenizeC2G('game "NotCC shell"'))
	runner.stepLine()
	function resolveQueuedAction() {
		for (
			let action = runner.queuedActions.shift();
			action;
			action = runner.queuedActions.shift()
		)
			switch (action.type) {
				case "chain": {
					const c2gPath = resolve(
						process.cwd(),
						action.value.replace(/^~/, process.env.HOME ?? "")
					)

					if (!fs.existsSync(c2gPath))
						errorAndExit("A chain path must lead to a file!")
					runner.tokens = tokenizeC2G(
						fs.readFileSync(c2gPath, { encoding: "latin1" })
					)
					runner.currentToken = 0
					runner.updateLabels()
					while (runner.tokens[runner.currentToken]) {
						runner.stepLine()
						resolveQueuedAction()
					}
					break
				}
				case "script":
					console.log(action.value)

					break
				default:
					console.warn("The CLI doesn't support this type of action!")
					break
			}
	}
	// eslint-disable-next-line no-constant-condition
	while (true) {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const commandScript = await prompt(
				{
					type: "text",
					name: "command",
					message: "",
				},
				{ onCancel: () => errorAndExit() }
			)
			runner.tokens.push(
				...tokenizeC2G(commandScript.command.replace(/\\$/, "") + "\n")
			)
			if (!commandScript.command.endsWith("\\")) break
		}
		runner.updateLabels()
		let latestValue: number | void
		while (runner.tokens[runner.currentToken]) {
			latestValue = runner.stepLine()
			resolveQueuedAction()
		}
		console.log(latestValue)
	}
}
