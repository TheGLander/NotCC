#! /usr/bin/env node
import { createLevelFromData, GameState, parseC2M } from "../../logic"
import fs from "fs"
import path from "path"
import ora from "ora"

const inputPath = path.resolve(__dirname, process.argv[2])
let files: string[] = []

if (fs.statSync(inputPath).isDirectory()) files = fs.readdirSync(inputPath)
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
		const levelData = parseC2M(new Uint8Array(levelBuffer).buffer)
		const level = createLevelFromData(levelData)

		if (!level.levelData?.associatedSolution)
			throw new Error("Level has no baked solution!")

		spinner.start(` Verifying ${levelData.name}...`)

		let lastDelay = Date.now()

		level.playbackSolution(level.levelData.associatedSolution)
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

		if (level.solutionSubticksLeft === Infinity) {
			levelsRanOutOfInput++
			spinner.fail(` ${levelData.name} - Input end before win`)
		} else if (level.gameState === GameState.LOST) {
			levelsKilledBySolution++
			spinner.fail(` ${levelData.name} - Solution killed the player`)
		} else spinner.succeed(` ${levelData.name} - Success`)
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
