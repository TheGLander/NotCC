import { exit } from "process"
import { resolveLevelPath } from "../helpers.js"
import { MessageChannel, MessagePort, Worker } from "worker_threads"
import { join, dirname } from "path"
import os from "os"
import pc from "picocolors"
import ProgressBar from "progress"
import { ArgumentsCamelCase, Argv } from "yargs"
import { decode } from "ini"
import { readFile } from "fs/promises"
import { fileURLToPath } from "url"
import { protobuf } from "@notcc/logic"

const __dirname = dirname(fileURLToPath(import.meta.url))

const levelOutcomes = ["success", "noInput", "badInput", "error"] as const

type LevelOutcome = (typeof levelOutcomes)[number]

interface WorkerLevelMessage {
	levelName: string
	outcome: LevelOutcome
	desc?: string
	type: "level"
	glitches: protobuf.IGlitchInfo[]
}

export type WorkerMessage = WorkerLevelMessage

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
	verbose: boolean
	ci: boolean
	files: string[]
	sync?: string
}

abstract class VerifyStats {
	constructor(public total: number) {}
	success = 0
	roundedPercent(num: number): number {
		return Math.round((num / this.total) * 1000) / 10
	}
	abstract getTextStats(): string
	abstract addLevel(
		msg: WorkerLevelMessage
	): [meesage: string, verboseOnly: boolean]

	getExitCode(): number {
		const failureN = this.total - this.success
		const exitCode = failureN === 0 ? 0 : 1 + ((failureN - 1) % 255)
		return exitCode
	}
}

function glitchToString(glitch: protobuf.IGlitchInfo): string {
	const glitchLocation = glitch.location
		? `(${glitch.location?.x}, ${glitch.location?.y})`
		: ""
	const glitchName = glitch.glitchKind
		? protobuf.GlitchInfo.KnownGlitches[glitch.glitchKind]
		: ""
	const glitchSpecifier =
		glitch.glitchKind === protobuf.GlitchInfo.KnownGlitches.DESPAWN
			? glitch.specifier === 1
				? "replace"
				: "delete"
			: ""
	return `${glitchLocation} ${glitchName} ${glitchSpecifier}`.trim()
}

class VerifyStatsBasic extends VerifyStats {
	success = 0
	badInput = 0
	noInput = 0
	error = 0
	getTextStats(): string {
		return `${this.total} Total
${pc.green(`${this.success} (${this.roundedPercent(this.success)}%)`)} ✅
${pc.red(`${this.badInput} (${this.roundedPercent(this.badInput)}%)`)} ❌
${pc.blue(`${this.noInput} (${this.roundedPercent(this.noInput)}%)`)} 💤
${pc.yellow(`${this.error} (${this.roundedPercent(this.error)}%)`)} 💥`
	}
	addLevel(msg: WorkerLevelMessage): [string, boolean] {
		const style = outcomeStyles[msg.outcome]
		const outcomeMessage = pc[style.color](
			`${msg.levelName} - ${style.desc}${msg.desc ? ` (${msg.desc})` : ""}`
		)

		const glitchMessage = pc.yellow(
			msg.glitches
				.map(glitch => `\n${msg.levelName} - ${glitchToString(glitch)}`)
				.join("")
		)

		this[msg.outcome] += 1
		return [
			outcomeMessage + glitchMessage,
			msg.outcome === "success" && msg.glitches.length === 0,
		]
	}
}

function arraysEqual<T>(aArr: T[], bArr: T[]): boolean {
	if (aArr.length === 0 || bArr.length === 0) {
		return aArr.length === bArr.length
	}
	return aArr.every((a, i) => a === bArr[i])
}

export interface SyncfileConstraints {
	outcome: LevelOutcome
	glitches?: string[]
}

export type Syncfile = {
	_default: SyncfileConstraints
} & Partial<Record<string, SyncfileConstraints>>

class VerifyStatsSync extends VerifyStats {
	success = 0
	mismatch = 0
	constructor(total: number, public sync: Syncfile) {
		super(total)
	}
	getTextStats(): string {
		return `${this.total} Total
${pc.green(`${this.success} (${this.roundedPercent(this.success)}%)`)} ✅
${pc.red(`${this.mismatch} (${this.roundedPercent(this.mismatch)}%)`)} ❌`
	}
	getConstraintsForLevel(level: string): SyncfileConstraints {
		if (level in this.sync) return this.sync[level]!
		return this.sync._default
	}
	addLevel(msg: WorkerLevelMessage): [string, boolean] {
		const mismatchReasons: string[] = []
		const constraints = this.getConstraintsForLevel(msg.levelName)

		if (constraints.outcome !== msg.outcome) {
			mismatchReasons.push(
				`Expected ${constraints.outcome}, got ${msg.outcome}.`
			)
		}

		const glitchStrings = msg.glitches.map(glitch => glitchToString(glitch))

		const despawnsMatch = arraysEqual(
			glitchStrings ?? [],
			constraints.glitches ?? []
		)
		if (!despawnsMatch) {
			mismatchReasons.push(
				`Expected [${(constraints.glitches ?? []).join(", ")}], got [${(
					glitchStrings ?? []
				).join(", ")}]`
			)
		}

		const mismatch = mismatchReasons.length > 0

		const style = outcomeStyles[mismatch ? "badInput" : "success"]
		if (!mismatch) {
			this.success += 1
			return [pc[style.color](`${msg.levelName} - Success`), true]
		}

		this.mismatch += 1
		return [
			pc[style.color](
				mismatchReasons.map(reason => `${msg.levelName} - ${reason}`).join("\n")
			),
			false,
		]
	}
}

interface VerifyOutputs {
	logMessage(message: string): void
	levelComplete(msg: WorkerLevelMessage): void
}

function makeBarOutput(stats: VerifyStats, verbose: boolean): VerifyOutputs {
	const bar = new ProgressBar(
		":bar :current/:total (:percent) :rate lvl/s",
		stats.total
	)

	return {
		levelComplete(msg) {
			const [message, verboseOnly] = stats.addLevel(msg)
			if (!verboseOnly || verbose) {
				bar.interrupt(message)
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

function makeCiOutput(stats: VerifyStats, verbose: boolean): VerifyOutputs {
	let totalComplete = 0
	return {
		levelComplete(msg: WorkerLevelMessage) {
			totalComplete += 1
			const [message] = stats.addLevel(msg)
			if (verbose) {
				console.log(message)
			}
			if (totalComplete % CI_OUTPUT_INTERVAL === 0) {
				console.log(stats.getTextStats())
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

	let syncfile: Syncfile | undefined

	if (args.sync) {
		const syncData = await readFile(args.sync, "utf-8")
		syncfile = decode(syncData) as Syncfile
	}

	const stats = syncfile
		? new VerifyStatsSync(filesN, syncfile)
		: new VerifyStatsBasic(filesN)
	const output = args.ci
		? makeCiOutput(stats, args.verbose)
		: makeBarOutput(stats, args.verbose)

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

	console.log(stats.getTextStats())

	exit(stats.getExitCode())
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
				.option("verbose", {
					describe:
						"If set, prints successful levels too, instead of just the failed ones.",
				})
				.option("ci", {
					describe:
						"Whenever to log intermediate stats in a non-TTY compatible manner",
					type: "boolean",
				})
				.option("sync", {
					description: "Path to syncfiles to use",
					type: "string",
				})
				.usage("notcc verify <files>"),
		verifyLevelFiles
	)
