import {
	createLevelFromData,
	crossLevelData,
	GameState,
	parseC2M,
} from "../../logic"
import { parentPort } from "worker_threads"
import fs from "fs"
import chalk from "chalk"
import path from "path"
import { LevelsMessage, WorkerMessage } from "./verifyLevels"

// TODO Refactor hint tile to not use alerts
// eslint-disable-next-line @typescript-eslint/no-empty-function
globalThis.alert = () => {}

if (parentPort)
	parentPort.on("message", (ev: LevelsMessage) => {
		let levelName: string | undefined = "???"
		if (!parentPort) return
		for (const levelPath of ev.levels) {
			try {
				const levelBuffer = fs.readFileSync(levelPath, null)

				// TODO This shouldn't happen in any solutions anyways
				crossLevelData.despawnedActors = []

				const levelData = parseC2M(
					new Uint8Array(levelBuffer).buffer,
					levelPath
				)
				levelName = levelData.name
				const level = createLevelFromData(levelData)

				if (
					!levelData?.associatedSolution ||
					!levelData.associatedSolution.steps
				)
					throw new Error("Level has no baked solution!")

				let bonusTicks = 60 * 10
				let lastReply = Date.now()
				level.playbackSolution(levelData.associatedSolution)
				while (level.gameState === GameState.PLAYING && bonusTicks > 0) {
					level.tick()
					if (level.solutionSubticksLeft === Infinity) bonusTicks--
					if (Date.now() - lastReply > 200) {
						parentPort.postMessage({
							levelName,
							progress: Math.round(
								(level.solutionStep /
									levelData.associatedSolution.steps[0].length) *
									100
							),
						} as WorkerMessage)
						lastReply = Date.now()
					}
				}
				switch (level.gameState) {
					case GameState.PLAYING:
						parentPort.postMessage({
							outcome: "no_input",
							levelName,
						} as WorkerMessage)

						break
					case GameState.LOST:
						parentPort.postMessage({
							outcome: "bad_input",
							levelName,
						} as WorkerMessage)

						break
					case GameState.WON:
						parentPort.postMessage({
							outcome: "success",
							levelName,
						} as WorkerMessage)

						break
				}
			} catch (err) {
				parentPort.postMessage({
					outcome: "error",
					levelName,
				} as WorkerMessage)
			}
		}
		parentPort.postMessage({ done: true } as WorkerMessage)
	})
