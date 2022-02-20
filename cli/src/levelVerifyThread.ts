import {
	createLevelFromData,
	crossLevelData,
	GameState,
	parseC2M,
} from "../../logic"
import { parentPort, isMainThread, MessagePort } from "worker_threads"
import fs from "fs"
import chalk from "chalk"
import path from "path"
import { WorkerMessage } from "./verifyLevels"

let levelName = "???"

// TODO Refactor hint tile to not use alerts
// eslint-disable-next-line @typescript-eslint/no-empty-function
globalThis.alert = () => {}

const ogConsoleLog = console.log

console.log = (arg1: any, ...args: any[]) =>
	ogConsoleLog(`[${levelName}] ${arg1}`, ...args)

const ogConsoleWarn = console.warn

console.warn = (arg1: any, ...args: any[]) =>
	ogConsoleWarn(`[${levelName}] ${arg1}`, ...args)

if (!parentPort) throw new Error()

interface ParentResponse {
	port: MessagePort
	byteFiles: SharedArrayBuffer
}

function connectToParent(): Promise<ParentResponse> {
	return new Promise(res => {
		if (!parentPort) throw new Error()
		parentPort.on("message", (val: ParentResponse) => {
			return res(val)
		})
	})
}

;(async () => {
	const response = await connectToParent()
	const sendMessage = (message: WorkerMessage) =>
		response.port.postMessage(message)
	const byteFiles = new Uint8Array(response.byteFiles)

	let bytePos = 0

	function getNextFilename(): string | null {
		let latestValue: number = 0
		for (; latestValue === 0; bytePos++) {
			if (bytePos >= byteFiles.length) return null
			latestValue = Atomics.load(byteFiles, bytePos)
		}
		bytePos--
		let filename = ""
		while (latestValue !== 0) {
			filename += String.fromCodePoint(latestValue)
			Atomics.store(byteFiles, bytePos, 0)
			bytePos++
			latestValue = Atomics.load(byteFiles, bytePos)
		}
		return filename
	}

	let levelPath: string | null

	while ((levelPath = getNextFilename())) {
		try {
			const levelBuffer = fs.readFileSync(levelPath, null)

			// TODO This shouldn't happen in any solutions anyways
			crossLevelData.despawnedActors = []

			const levelData = parseC2M(new Uint8Array(levelBuffer).buffer, levelPath)
			levelName = levelData.name || "???"
			const level = createLevelFromData(levelData)

			if (!levelData?.associatedSolution || !levelData.associatedSolution.steps)
				throw new Error("Level has no baked solution!")

			let bonusTicks = 60 * 10
			let lastReply = Date.now()
			level.playbackSolution(levelData.associatedSolution)
			while (level.gameState === GameState.PLAYING && bonusTicks > 0) {
				level.tick()
				if (level.solutionSubticksLeft === Infinity) bonusTicks--
			}
			sendMessage({
				levelName,
				outcome:
					level.gameState === GameState.WON
						? "success"
						: level.gameState === GameState.LOST
						? "bad_input"
						: "no_input",
			})
		} catch (err) {
			sendMessage({
				levelName: levelName || levelPath,
				outcome: "error",
				desc: (err as Error).message,
			})
		}
	}
})()
