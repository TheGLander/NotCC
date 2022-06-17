import { exit } from "process"
import { resolveLevelPath } from "../helpers"
import { MessageChannel, Worker } from "worker_threads"
import { join } from "path"
import os from "os"
import chalk from "chalk"
import ProgressBar from "progress"
import { ArgumentsCamelCase, Argv } from "yargs"

const levelOutcomes = ["success", "noInput", "badInput", "error"] as const

type LevelOutcome = typeof levelOutcomes[number]

interface WorkerLevelMessage {
	levelName: string
	outcome: LevelOutcome
	desc?: string
	type: "level"
}

interface WorkerExitMessage {
	type: "final"
}

interface WorkerLogMessage {
	type: "log"
	message: string
}

export type WorkerMessage =
	| WorkerLevelMessage
	| WorkerExitMessage
	| WorkerLogMessage

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
	badInput: { color: "red", desc: "Solution killed player", failure: true },
	noInput: { color: "red", desc: "Ran out of input", failure: true },
	error: { color: "redBright", desc: "Failed to run level" },
}

interface Options {
	show?: LevelOutcome[]
	hide?: LevelOutcome[]
	files: string[]
}

export async function verifyLevelFiles(
	args: ArgumentsCamelCase<Options>
): Promise<void> {
	const files = resolveLevelPath(...args.files).filter(val =>
		val.toLowerCase().endsWith(".c2m")
	)
	let toShow: LevelOutcome[]
	if (args.hide) toShow = levelOutcomes.filter(val => !args.hide!.includes(val))
	else if (args.show) toShow = args.show
	else toShow = Array.from(levelOutcomes)

	const byteFiles = createByteArray(files)

	const stats: Record<LevelOutcome, number> = {
		noInput: 0,
		error: 0,
		badInput: 0,
		success: 0,
	}

	const workers: WorkerData[] = []

	const bar = new ProgressBar(
		":bar :current/:total (:percent) :rate lvl/s",
		files.length
	)

	const workersN = Math.min(files.length, os.cpus().length)

	console.log(`Creating ${workersN} workers...`)
	for (let i = 0; i < workersN; i++) {
		const { port1, port2 } = new MessageChannel()
		const worker = new Worker(join(__dirname, "./verifyLevelsThread.js"))
		let endWait = () => {}
		const promise = new Promise<void>(res => {
			endWait = res
		})

		workers.push({ worker, promise })
		worker.postMessage({ byteFiles, port: port1 }, [port1])
		port2.on("message", (msg: WorkerMessage) => {
			if (msg.type === "final") {
				endWait()
				return
			}
			if (msg.type === "log") {
				bar.interrupt(msg.message)
				return
			}
			/*console.log(
				Array.from(new Uint8Array(byteFiles))
					.map(val => (val === 0 ? "NULL" : String.fromCharCode(val)))
					.join("")
			)*/
			stats[msg.outcome]++
			if (toShow.includes(msg.outcome)) {
				const style = outcomeStyles[msg.outcome]
				bar.interrupt(
					chalk[style.color](
						`${msg.levelName} - ${style.desc}${
							msg.desc ? ` (${msg.desc})` : ""
						}`
					)
				)
			}
			bar.tick()
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
Levels whose solutions killed a player: ${stats.badInput} (${
			(stats.badInput / files.length) * 100
		}%)
Levels whose solutions ran out: ${stats.noInput} (${
			(stats.noInput / files.length) * 100
		}%)`
	)

	exit(files.length - stats.success)
}

export default (yargs: Argv) =>
	yargs.command<Options>(
		"verify <files>",
		"Verifies that a level's solution works",
		yargs =>
			yargs
				.positional("files", {
					describe: "The files to be tested",
					type: "string",
					coerce: files => (files instanceof Array ? files : [files]),
				})
				.demandOption("files")
				.option("show", { describe: "The result types to show" })
				.conflicts("show", "hide")
				.choices("show", levelOutcomes)
				.option("hide", { describe: "The result types to hide" })
				.choices("hide", levelOutcomes)
				.usage("notcc verify <files>"),
		verifyLevelFiles
	)
