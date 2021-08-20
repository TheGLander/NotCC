import { exit } from "process"
import { resolveLevelPath, errorAndExit } from "./helpers"
import { CLIArguments } from "./index"
import { Worker } from "worker_threads"
import { join } from "path"
import Ora from "ora"
import os from "os"
export interface LevelsMessage {
	levels: string[]
	onlyError: boolean
	ping: boolean
}

export interface WorkerMessage {
	levelName?: string
	progress?: number
	outcome?: "success" | "no_input" | "bad_input" | "error"
	done?: boolean
	getLevel?: boolean
}

export async function verifyLevelFiles(args: CLIArguments): Promise<void> {
	if (!args.pos[1]) errorAndExit("Supply a level path!")
	const files = resolveLevelPath(args.pos[1]).filter(val =>
		val.toLowerCase().endsWith(".c2m")
	)
	const spinner = Ora({ discardStdin: false, hideCursor: false })
	spinner.start()
	let levelsKilledBySolution = 0,
		levelsRanOutOfInput = 0,
		levelsThrewError = 0

	const workers: Worker[] = [],
		workerPromises: Promise<number>[] = [],
		workerProgresses: [string, number][] = []

	for (let i = 0; i < os.cpus().length; i++) {
		const worker = new Worker(join(__dirname, "./levelVerifyThread.js"))
		workers.push(worker)
		worker.postMessage({
			levels: files.slice(
				(i * files.length) / os.cpus().length,
				((i + 1) * files.length) / os.cpus().length
			),
			onlyError: args.options.onlyError,
			ping: false,
		} as LevelsMessage)
		let lastLevel = ""
		workerPromises.push(
			new Promise<number>(res => {
				worker.on("message", (ev: WorkerMessage) => {
					if (ev.done) {
						const id = workers.indexOf(worker)
						delete workers[id]
						delete workerProgresses[id]
						return res(worker.terminate())
					}
					if (ev.progress)
						workerProgresses[workers.indexOf(worker)] = [lastLevel, ev.progress]
					switch (ev.outcome) {
						case "bad_input":
							levelsKilledBySolution++
							spinner.fail(`${lastLevel} - Solution killed the player`)
							break
						case "error":
							levelsThrewError++
							spinner.fail(`${lastLevel} - Failed to run`)
							break
						case "no_input":
							levelsRanOutOfInput++
							spinner.fail(`${lastLevel} - Solution ran out of steps`)
							break
						case "success":
							spinner.succeed(`${lastLevel} - Success`)
							break
					}
					if (ev.levelName !== lastLevel && ev.levelName)
						lastLevel = ev.levelName

					spinner.text = workerProgresses.reduce(
						(acc, val) => `${acc} ${val[0]} (${val[1]}%)`,
						"Verifying "
					)
					spinner.render()
				})
			})
		)
	}
	await Promise.all(workerPromises)
	spinner.clear()
	const totalWins =
		files.length -
		levelsKilledBySolution -
		levelsRanOutOfInput -
		levelsThrewError

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
}
