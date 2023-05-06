import { exit } from "process"
import { resolveLevelPath } from "../helpers"
import { MessageChannel, MessagePort, Worker } from "worker_threads"
import { join } from "path"
import os from "os"
import pc from "picocolors"
import ProgressBar from "progress"
import { ArgumentsCamelCase, Argv } from "yargs"
import { WriteStream } from "tty"

/**
 * A hack for `progress` which explodes if the current environment is not a TTY.
 */
function mockStreamAsTTY(stream: WriteStream): void {
	if (stream.isTTY) return
	const tty = WriteStream.prototype
	for (const key in tty) {
		if (key in stream) continue
		// @ts-expect-error Come on
		stream[key] = tty[key]
	}
	stream.columns = 80
}

mockStreamAsTTY(process.stdout)
mockStreamAsTTY(process.stderr)

const levelOutcomes = ["success", "noInput", "badInput", "error"] as const

type LevelOutcome = (typeof levelOutcomes)[number]

interface WorkerLevelMessage {
	levelName: string
	outcome: LevelOutcome
	desc?: string
	type: "level"
}

interface WorkerLogMessage {
	type: "log"
	message: string
}

export type WorkerMessage = WorkerLevelMessage | WorkerLogMessage

export interface ParentNewLevelMessage {
	type: "new level"
	levelPath: string
}

export interface ParentEndMessage {
	type: "end"
}

export interface ParentInitialMessage {
	type: "init"
	port: MessagePort
	firstLevelPath: string
}

interface OutcomeStyle {
	color: "red" | "green" | "yellow"
	desc: string
}

interface WorkerData {
	worker: Worker
	promise: Promise<void>
}

const outcomeStyles: Record<LevelOutcome, OutcomeStyle> = {
	success: { color: "green", desc: "Success" },
	badInput: { color: "red", desc: "Solution killed player" },
	noInput: { color: "red", desc: "Ran out of input" },
	error: { color: "yellow", desc: "Failed to run level" },
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
	const filesN = files.length

	let toShow: LevelOutcome[]
	if (args.hide) toShow = levelOutcomes.filter(val => !args.hide!.includes(val))
	else if (args.show) toShow = args.show
	else toShow = Array.from(levelOutcomes)

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
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		let endWait: () => void = () => {}
		const promise = new Promise<void>(res => {
			endWait = res
		})

		workers.push({ worker, promise })
		worker.postMessage(
			{
				type: "init",
				firstLevelPath: files.shift() as string,
				port: port1,
			} satisfies ParentInitialMessage,
			[port1]
		)
		port2.on("message", (msg: WorkerMessage) => {
			if (msg.type === "log") {
				bar.interrupt(msg.message)
				return
			}
			stats[msg.outcome] += 1
			if (toShow.includes(msg.outcome)) {
				const style = outcomeStyles[msg.outcome]
				bar.interrupt(
					pc[style.color](
						`${msg.levelName} - ${style.desc}${
							msg.desc ? ` (${msg.desc})` : ""
						}`
					)
				)
			}
			bar.tick()
			const nextLevel = files.shift()
			if (nextLevel === undefined) {
				worker.postMessage({ type: "end" } satisfies ParentEndMessage)
				endWait()
			} else {
				worker.postMessage({
					type: "new level",
					levelPath: nextLevel,
				} satisfies ParentNewLevelMessage)
			}
		})
	}

	const stillWaiting = Promise.all(workers.map(val => val.promise))

	await stillWaiting

	console.log(
		`Success rate: ${(stats.success / filesN) * 100}% (${
			stats.success
		}/${filesN})
Levels which failed to run: ${stats.error} (${(stats.error / filesN) * 100}%)
Levels whose solutions killed a player: ${stats.badInput} (${
			(stats.badInput / filesN) * 100
		}%)
Levels whose solutions ran out: ${stats.noInput} (${
			(stats.noInput / filesN) * 100
		}%)`
	)

	exit(1 + ((files.length - stats.success) % 255))
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
