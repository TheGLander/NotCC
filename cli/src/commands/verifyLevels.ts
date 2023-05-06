import { exit } from "process"
import { resolveLevelPath } from "../helpers"
import { MessageChannel, MessagePort, Worker } from "worker_threads"
import { join } from "path"
import os from "os"
import pc from "picocolors"
import ProgressBar from "progress"
import { ArgumentsCamelCase, Argv } from "yargs"

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
	ci?: boolean
	files: string[]
}

interface VerifyOutputs {
	logMessage(message: string): void
	levelComplete(msg: WorkerLevelMessage): void
}

function makeBarOutput(filesN: number, toShow: LevelOutcome[]): VerifyOutputs {
	const bar = new ProgressBar(
		":bar :current/:total (:percent) :rate lvl/s",
		filesN
	)

	return {
		levelComplete(msg) {
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
		},
		logMessage(message) {
			bar.interrupt(message)
		},
	}
}

/**
 * The test output will log numbers every TEST_OUTPUT_INTERVAL level completions.
 */
const CI_OUTPUT_INTERVAL = 100

function makeCiOutput(stats: Record<LevelOutcome, number>): VerifyOutputs {
	let totalComplete = 0
	return {
		levelComplete() {
			totalComplete += 1
			if (totalComplete % CI_OUTPUT_INTERVAL === 0) {
				console.log(
					`${pc.green(stats.success)} ✅
${pc.red(stats.badInput)} ❌
${pc.blue(stats.noInput)} 💤
${pc.yellow(stats.error)} 💥
`
				)
			}
		},
		logMessage(message) {
			console.log(message)
		},
	}
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
	const output = args.ci ? makeCiOutput(stats) : makeBarOutput(filesN, toShow)

	const workers: WorkerData[] = []

	const workersN = Math.min(filesN, os.cpus().length)

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
				output.logMessage(msg.message)
				return
			}
			stats[msg.outcome] += 1
			output.levelComplete(msg)

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

	const failureN = filesN - stats.success
	const exitCode = failureN === 0 ? 0 : 1 + (failureN % 255)

	exit(exitCode)
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
				.option("ci", {
					describe:
						"Whenever to log intermediate stats in a non-TTY compatible manner",
				})
				.conflicts("ci", ["show", "hide"])
				.usage("notcc verify <files>"),
		verifyLevelFiles
	)
