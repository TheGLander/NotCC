import {
	createLevelFromData,
	crossLevelData,
	GameState,
	parseC2M,
} from "@notcc/logic"
import { parentPort } from "worker_threads"
import fs from "fs"
import type {
	WorkerMessage,
	ParentInitialMessage,
	ParentNewLevelMessage,
	ParentEndMessage,
} from "./verifyLevels.js"

if (!parentPort) throw new Error()

let waitForMessageResolver: (() => void) | undefined

const queuedMesssages: any[] = []

parentPort.on("message", val => {
	queuedMesssages.push(val)
	if (waitForMessageResolver !== undefined) {
		waitForMessageResolver()
	}
})

function waitForMessage(): Promise<any> {
	if (queuedMesssages.length === 0) {
		return new Promise(res => {
			waitForMessageResolver = () => {
				res(queuedMesssages.shift())
			}
		})
	}
	return Promise.resolve(queuedMesssages.shift())
}

function convertDespawnMessageToStandard(message: string): string | null {
	const match = message.match(
		/A despawn has happened at \((\d+), (\d+)\). \((Overwritten|Deleted)\)/
	)
	if (!match) return null
	return `(${match[1]}, ${match[2]}) ${
		match[3] === "Overwritten" ? "replace" : "delete"
	}`
}

;(async () => {
	const response = (await waitForMessage()) as ParentInitialMessage
	const sendMessage = (message: WorkerMessage) =>
		response.port.postMessage(message)
	let levelName: string | undefined

	console.log = console.warn = (arg1: any, ...args: any[]) => {
		// If this a despawn warning, send it under a different message type
		const despawn = convertDespawnMessageToStandard(arg1)
		if (despawn) {
			sendMessage({ type: "despawn", level: levelName!, message: despawn })
		} else {
			sendMessage({ type: "log", message: `[${levelName}] ${arg1}` })
		}
	}

	let levelPath: string | null = response.firstLevelPath

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			levelName = undefined
			const levelBuffer = fs.readFileSync(levelPath, null)

			// TODO This shouldn't happen in any solutions anyways
			crossLevelData.despawnedActors = []

			const levelData = parseC2M(new Uint8Array(levelBuffer).buffer, levelPath)
			levelName = levelData.name || "???"
			const level = createLevelFromData(levelData)

			if (!levelData?.associatedSolution || !levelData.associatedSolution.steps)
				throw new Error("Level has no baked solution!")

			let bonusTicks = 60 * 60

			level.playbackSolution(levelData.associatedSolution)
			while (level.gameState === GameState.PLAYING && bonusTicks > 0) {
				level.tick()
				if (level.solutionSubticksLeft === Infinity) bonusTicks--
			}
			sendMessage({
				type: "level",
				levelName,
				outcome:
					level.gameState === GameState.WON
						? "success"
						: level.gameState !== GameState.PLAYING
						? "badInput"
						: "noInput",
			})
		} catch (err) {
			sendMessage({
				type: "level",
				levelName: levelName || levelPath,
				outcome: "error",
				desc: (err as Error).message,
			})
		}
		const response = (await waitForMessage()) as
			| ParentNewLevelMessage
			| ParentEndMessage

		if (response.type === "end") {
			process.exit(0)
		} else {
			levelPath = response.levelPath
		}
	}
})()
