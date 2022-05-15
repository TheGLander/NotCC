import { exit } from "process"
import { resolveLevelPath, errorAndExit } from "./helpers"
import { CLIArguments } from "./index"
import { MessageChannel, Worker } from "worker_threads"
import { join, dirname } from "path"
import os from "os"
import chalk, { Chalk } from "chalk"

type LevelOutcome = "success" | "no_input" | "bad_input" | "error"

interface WorkerLevelMessage {
	levelName: string
	outcome: LevelOutcome
	desc?: string
}

interface WorkerExitMessage {
	final: true
}

export type WorkerMessage = WorkerLevelMessage | WorkerExitMessage

function createByteArray(arr: string[]): SharedArrayBuffer {
	const buffer = new SharedArrayBuffer(
		arr.reduce<number>((acc, val) => acc + val.length + 1, 0)
	)
	const byteArr = new Uint8Array(buffer)
	let position = 0
	for (const str of arr) {
		byteArr.set(
			Array.from(str).map(val => val.codePointAt(0) || 0),
			position
		)
		position += str.length + 1
	}

	return buffer
}

interface OutcomeStyle {
	color: "red" | "green" | "redBright"
	desc: string
	failure?: boolean
}

interface WorkerData {
	worker: Worker
	promise: Promise<void>
}

const outcomeStyles: Record<LevelOutcome, OutcomeStyle> = {
	success: { color: "green", desc: "Success" },
	bad_input: { color: "red", desc: "Solution killed player", failure: true },
	no_input: { color: "red", desc: "Ran out of input", failure: true },
	error: { color: "redBright", desc: "Failed to run level" },
}

export async function verifyLevelFiles(args: CLIArguments): Promise<void> {
	if (!args.pos[1]) errorAndExit("Supply a level path!")
	const files = resolveLevelPath(...args.pos.slice(1)).filter(val =>
		val.toLowerCase().endsWith(".c2m")
	)

	const byteFiles = createByteArray(files)

	const stats: Record<LevelOutcome, number> = {
		no_input: 0,
		error: 0,
		bad_input: 0,
		success: 0,
	}

	const workers: WorkerData[] = []

	const workersN = os.cpus().length

	console.log(`Creating ${workersN} workers...`)
	for (let i = 0; i < workersN; i++) {
		const { port1, port2 } = new MessageChannel()
		const worker = new Worker(join(__dirname, "./levelVerifyThread.js"))
		let endWait = () => {}
		const promise = new Promise<void>(res => {
			endWait = res
		})
		workers.push({ worker, promise })
		worker.postMessage({ byteFiles, port: port1 }, [port1])
		port2.on("message", (msg: WorkerMessage) => {
			if ("final" in msg) {
				endWait()
				return
			}
			/*console.log(
				Array.from(new Uint8Array(byteFiles))
					.map(val => (val === 0 ? "NULL" : String.fromCharCode(val)))
					.join("")
			)*/
			stats[msg.outcome]++
			const style = outcomeStyles[msg.outcome]
			if (!args.options["onlyError"] || style.failure)
				console.log(
					chalk[style.color](
						`${msg.levelName} - ${style.desc}${
							msg.desc ? ` (${msg.desc})` : ""
						}`
					)
				)
		})
	}

	const stillWaiting = Promise.all(workers.map(val => val.promise))

	await stillWaiting

	console.log(
		`Success rate: ${(stats.success / files.length) * 100}% (${stats.success}/${
			files.length
		})
Levels which failed to run: ${stats.error} (${
			(stats.error / files.length) * 100
		}%)
Levels whose solutions killed a player: ${stats.bad_input} (${
			(stats.bad_input / files.length) * 100
		}%)
Levels whose solutions ran out: ${stats.no_input} (${
			(stats.no_input / files.length) * 100
		}%)`
	)

	exit(files.length - stats.success)
}
