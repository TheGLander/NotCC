import {
	createLevelFromData,
	crossLevelData,
	GameState,
	parseC2M,
} from "../../logic"
import fs from "fs"
import path from "path"
import ora from "ora"
import { exit } from "process"
import chalk from "chalk"
import { resolveLevelPath, errorAndExit } from "./helpers"
import { CLIArguments } from "./index"

export function verifyLevelFiles(args: CLIArguments): void {
	if (!args.pos[1]) errorAndExit("Supply a level path!")
	const files = resolveLevelPath(args.pos[1])

	let levelsKilledBySolution = 0,
		levelsRanOutOfInput = 0,
		levelsThrewError = 0

	// TODO Refactor hint tile to not use alerts
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	globalThis.alert = () => {}

	for (const levelPath of files) {
		const spinner = ora()
		try {
			const levelBuffer = fs.readFileSync(levelPath, null)

			// TODO This shouldn't happen in any solutions anyways
			crossLevelData.despawnedActors = crossLevelData.queuedDespawns = []

			const levelData = parseC2M(new Uint8Array(levelBuffer).buffer)
			const level = createLevelFromData(levelData)

			if (!levelData?.associatedSolution)
				throw new Error("Level has no baked solution!")

			spinner.start(` ${levelData.name} - Verifying...`)

			let lastDelay = Date.now(),
				bonusTicks = 60 * 10
			const startTime = lastDelay
			level.playbackSolution(levelData.associatedSolution)
			while (level.gameState === GameState.PLAYING && bonusTicks > 0) {
				level.tick()
				if (level.solutionSubticksLeft === Infinity) bonusTicks--
				if (Date.now() - lastDelay > 80) {
					spinner.text = `${levelData.name} - Verifying... (${Math.round(
						(level.solutionStep /
							levelData.associatedSolution.steps[0].length) *
							100
					)}%)`
					spinner.render()
					lastDelay = Date.now()
				}
			}
			const speedCoef = Math.round(
				level.currentTick / 60 / ((Date.now() - startTime) / 1000)
			)

			let reasonText: string

			switch (level.gameState) {
				case GameState.PLAYING:
					levelsRanOutOfInput++
					reasonText = "Input end before win"
					break
				case GameState.LOST:
					levelsKilledBySolution++
					reasonText = "Solution killed the player"
					break
				case GameState.WON:
					reasonText = "Success"
					break
			}
			const isSuccess = level.gameState === GameState.WON

			if (!(args.options.onlyError && isSuccess))
				spinner[isSuccess ? "succeed" : "fail"](
					chalk` ${levelData.name ?? "UNNAMED"} - {${
						isSuccess ? "green" : "red"
					} ${reasonText}} (${speedCoef.toString()} times faster)`
				)
		} catch (err) {
			levelsThrewError++
			if (!args.options.onlyError)
				spinner.fail(
					` ${path.basename(levelPath)} - Failed to run (${err.message})`
				)
		}
		if (args.options.onlyError) spinner.stop()
	}

	const totalWins =
		files.length -
		levelsKilledBySolution -
		levelsRanOutOfInput -
		levelsThrewError

	console.log(
		`Success rate: ${(totalWins / files.length) * 100}% (${totalWins}/${
			files.length
		})
Levels which failed to run: ${levelsThrewError} (${
			(levelsThrewError / files.length) * 100
		}%)
Levels whose solutions killed a player: ${levelsKilledBySolution} (${
			(levelsKilledBySolution / files.length) * 100
		}%)
Levels whose solutions did not lead to an exit: ${levelsRanOutOfInput} (${
			(levelsRanOutOfInput / files.length) * 100
		}%)`
	)

	exit(files.length - totalWins)
}
