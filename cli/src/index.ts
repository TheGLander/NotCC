#! /usr/bin/env node
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

function getFilesRecursive(dir: string): string[] {
	const files: string[] = []
	fs.readdirSync(dir).forEach(file => {
		const absolute = path.join(dir, file)
		if (fs.statSync(absolute).isDirectory())
			files.push(...getFilesRecursive(absolute))
		else files.push(absolute)
	})
	return files
}

const inputPath = path.resolve(__dirname, process.argv[2])
let files: string[] = []

if (fs.statSync(inputPath).isDirectory()) files = getFilesRecursive(inputPath)
else files = [inputPath]

let levelsKilledBySolution = 0,
	levelsRanOutOfInput = 0,
	levelsThrewError = 0

// TODO Refactor hint tile to not use alerts
globalThis.alert = () => {}

for (const levelPath of files) {
	const spinner = ora()
	try {
		const levelBuffer = fs.readFileSync(
			path.resolve(inputPath, levelPath),
			null
		)

		// TODO This shouldn't happen in any solutions anyways
		crossLevelData.despawnedActors = crossLevelData.queuedDespawns = []

		const levelData = parseC2M(new Uint8Array(levelBuffer).buffer)
		const level = createLevelFromData(levelData)

		if (!levelData?.associatedSolution)
			throw new Error("Level has no baked solution!")

		spinner.start(` Verifying ${levelData.name}...`)

		let lastDelay = Date.now()

		level.playbackSolution(levelData.associatedSolution)
		while (
			level.gameState === GameState.PLAYING &&
			level.solutionSubticksLeft !== Infinity
		) {
			level.tick()
			if (Date.now() - lastDelay > 80) {
				spinner.render()
				lastDelay = Date.now()
			}
		}
		switch (level.gameState) {
			case GameState.PLAYING:
				levelsRanOutOfInput++
				spinner.fail(
					chalk` ${levelData.name ?? "UNNAMED"} - {red Input end before win}`
				)
				break
			case GameState.LOST:
				levelsKilledBySolution++
				spinner.fail(
					chalk` ${
						levelData.name ?? "UNNAMED"
					} - {red Solution killed the player}`
				)
				break
			case GameState.WON:
				spinner.succeed(
					chalk` ${levelData.name ?? "UNNAMED"} - {green Success}`
				)
				break
		}
	} catch (err) {
		levelsThrewError++
		spinner.fail(
			` ${path.basename(levelPath)} - Failed to run (${err.message})`
		)
	}
}

const totalWins =
	files.length - levelsKilledBySolution - levelsRanOutOfInput - levelsThrewError

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
