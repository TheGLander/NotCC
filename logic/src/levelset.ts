import clone from "clone"
import { protoTimeToMs } from "./attemptTracker.js"
import {
	ScriptRunner,
	MapInterruptResponse,
	ScriptInterrupt,
} from "./parsers/c2g.js"
import { LevelData, parseC2M } from "./parsers/c2m.js"
import {
	IAttemptInfo,
	ILevelInfo,
	ISetInfo,
	ISolutionOutcomeInfo,
} from "./parsers/nccs.pb.js"

export interface LevelSetRecord {
	levelData?: LevelData
	levelInfo: ILevelInfo
}

export function calculateLevelPoints(
	levelN: number,
	timeLeft: number,
	bonusPoints = 0
): number {
	return levelN * 500 + timeLeft * 10 + bonusPoints
}

export interface SolutionMetrics {
	timeLeft: number
	points: number
	realTime: number
}

function snapNumber(num: number, period: number): number {
	return num - (num % period)
}

export function metricsFromAttempt(
	levelN: number,
	outcome: ISolutionOutcomeInfo
): SolutionMetrics {
	if (!outcome.timeLeft || !outcome.absoluteTime)
		throw new Error("Incomplete attempt info")
	const timeLeft = snapNumber(protoTimeToMs(outcome.timeLeft) / 1000, 1 / 60)
	const points = calculateLevelPoints(
		levelN,
		Math.ceil(timeLeft),
		outcome.bonusScore ?? 0
	)
	const realTime = snapNumber(
		protoTimeToMs(outcome.absoluteTime) / 1000,
		1 / 60
	)
	return { timeLeft, points, realTime }
}

export function findBestMetrics(info: ILevelInfo): Partial<SolutionMetrics> {
	if (typeof info.levelNumber !== "number")
		throw new Error("Incomplete level info")
	const metrics: Partial<SolutionMetrics> = {}
	if (!info.attempts || info.attempts.length === 0) return metrics
	const levelN = info.levelNumber

	for (const attempt of info.attempts) {
		if (!attempt.solution?.outcome) continue
		const { realTime, points, timeLeft } = metricsFromAttempt(
			levelN,
			attempt.solution.outcome
		)
		if (metrics.timeLeft === undefined || metrics.timeLeft < timeLeft) {
			metrics.timeLeft = timeLeft
		}
		if (metrics.points === undefined || metrics.points < points) {
			metrics.points = points
		}
		if (metrics.realTime === undefined || metrics.realTime > realTime) {
			metrics.realTime = realTime
		}
	}
	return metrics
}

export type LevelSetLoaderFunction = (
	path: string,
	binary: boolean
) => Promise<string | ArrayBuffer>

export class LevelSet {
	seenLevels: Record<number, LevelSetRecord>
	scriptRunner: ScriptRunner
	currentLevel: number
	inPostGame = false
	constructor(
		mainScriptPath: string,
		scriptData: string,
		loaderFunction: LevelSetLoaderFunction
	)
	constructor(
		setData: ISetInfo,
		scriptData: string,
		loaderFunction: LevelSetLoaderFunction
	)
	constructor(
		setDataOrMainScriptPath: ISetInfo | string,
		scriptData: string,
		public loaderFunction: LevelSetLoaderFunction
	) {
		if (typeof setDataOrMainScriptPath === "string") {
			// This is a new level set
			const mainScriptPath = setDataOrMainScriptPath
			this.seenLevels = {}
			this.scriptRunner = new ScriptRunner(scriptData, mainScriptPath)
			this.currentLevel = 1
		} else {
			// This is a loaded level set
			const setData = setDataOrMainScriptPath

			if (setData.ruleset !== "Steam" || setData.setType !== "C2G")
				throw new Error("LevelSet only represents sets based on C2G scripts.")
			if (
				typeof setData.currentLevel !== "number" ||
				setData.levels === undefined ||
				setData.levels === null
			)
				throw new Error("Given set data is missing essential properties.")

			this.currentLevel = setData.currentLevel
			this.seenLevels = Object.fromEntries(
				setData.levels.map<[number, LevelSetRecord]>(lvl => {
					if (typeof lvl.levelNumber !== "number")
						throw new Error(
							`${
								lvl.title ? `Level "${lvl.title}"` : "An untitled level "
							} is missing the levelNumber property.`
						)

					return [lvl.levelNumber, { levelInfo: lvl }]
				})
			)
			const currentLevelInfo = this.seenLevels[this.currentLevel]?.levelInfo
			if (!currentLevelInfo || !currentLevelInfo.levelFilePath)
				throw new Error("Given set info doesn't have current level info.")

			this.scriptRunner = new ScriptRunner(
				scriptData,
				currentLevelInfo.scriptState?.scriptPath ?? undefined,
				clone(currentLevelInfo.scriptState) ?? undefined
			)
			// Recreate the interrupt the current level should have
			this.scriptRunner.scriptInterrupt = {
				type: "map",
				path: currentLevelInfo.levelFilePath,
			}
		}
	}
	static async constructAsync(
		setData: ISetInfo,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet>
	static async constructAsync(
		mainScriptPath: string,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet>
	static async constructAsync(
		setDataOrMainScriptPath: string | ISetInfo,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet> {
		let scriptPath: string
		if (typeof setDataOrMainScriptPath === "string") {
			scriptPath = setDataOrMainScriptPath
		} else {
			const levelN = setDataOrMainScriptPath.currentLevel
			if (typeof levelN !== "number")
				throw new Error("The set data must have a current level set.")
			const levelData = setDataOrMainScriptPath.levels?.find(
				lvl => typeof lvl.levelNumber === "number" && lvl.levelNumber === levelN
			)
			const setScriptPath = levelData?.scriptState?.scriptPath
			if (typeof setScriptPath !== "string")
				throw new Error("The set level does not have a script path set.")

			scriptPath = setScriptPath
		}
		const scriptData = (await loaderFunction(scriptPath, false)) as string
		return new this(
			// This is false, but Typescript for some reason doesn't like passing a
			// union here?
			setDataOrMainScriptPath as string,
			scriptData,
			loaderFunction
		)
	}
	lastLevelResult?: MapInterruptResponse
	async getNextRecord(): Promise<LevelSetRecord | null> {
		if (this.inPostGame) return null

		if (this.scriptRunner.scriptInterrupt) {
			if (!this.lastLevelResult)
				throw new Error("An action for the current map must be set.")
			this.scriptRunner.handleMapInterrupt(this.lastLevelResult)
		}
		const lastLevel = this.seenLevels[this.currentLevel]?.levelInfo
		let prologue: string | undefined = ""
		let lastEpilogue: string | undefined = ""

		let interrupt: ScriptInterrupt | null

		do {
			interrupt = this.scriptRunner.executeUntilInterrupt()
			// Handle interrupts
			if (interrupt?.type === "script") {
				if (!lastLevel) {
					prologue += interrupt.text
				} else {
					lastEpilogue += interrupt.text
				}
				this.scriptRunner.scriptInterrupt = null
			} else if (interrupt?.type === "chain") {
				// Chain interrupt
				const newFile = (await this.loaderFunction(
					interrupt.path,
					false
				)) as string
				this.scriptRunner.handleChainInterrupt(newFile)
			}
		} while (interrupt && interrupt.type !== "map")
		// Typescript just doesn't figure this out, for some reason
		const recordInterrupt = interrupt as
			| (ScriptInterrupt & { type: "map" })
			| null
		if (recordInterrupt === null) {
			this.inPostGame = true
			return null
		}

		const levelN = this.scriptRunner.state.variables?.level ?? 0
		this.currentLevel = levelN

		const existingRecord = this.seenLevels[levelN]

		if (lastLevel) {
			lastLevel.epilogueText = lastEpilogue
		}

		const record: LevelSetRecord = {
			levelInfo: {
				prologueText: prologue,
				scriptState: clone(this.scriptRunner.state),
				levelNumber: levelN,
				attempts: existingRecord?.levelInfo.attempts,
				levelFilePath: recordInterrupt.path,
			},
		}
		this.seenLevels[levelN] = record

		await this.verifyLevelDataAvailability(
			levelN,
			existingRecord?.levelInfo.levelFilePath === recordInterrupt.path
				? existingRecord?.levelData
				: undefined
		)

		record.levelInfo.title = record.levelData!.name

		return record
	}
	async verifyLevelDataAvailability(
		levelN: number,
		levelData?: LevelData
	): Promise<void> {
		const levelRecord = this.seenLevels[levelN]
		if (!levelRecord) throw new Error(`No level ${levelN} exists.`)
		if (levelRecord.levelData) return
		if (levelData) {
			levelRecord.levelData = levelData
			return
		}

		const levelPath = levelRecord.levelInfo.levelFilePath

		if (!levelPath) throw new Error("The level does not have a path specified.")

		const levelBuffer = (await this.loaderFunction(
			levelPath,
			true
		)) as ArrayBuffer
		levelRecord.levelData = parseC2M(levelBuffer)
		// Emulate CC1 Steam having CC1 boots always enabled
		if (this.scriptRunner.state.scriptTitle === "Chips Challenge") {
			levelRecord.levelData.cc1Boots = true
		}
	}
	toSetInfo(): ISetInfo {
		const currentScriptState =
			this.seenLevels[this.currentLevel].levelInfo.scriptState
		return {
			ruleset: "Steam",
			setType: "C2G",
			setName: currentScriptState?.scriptTitle,
			levels: Object.values(this.seenLevels).map(lvl => lvl.levelInfo),
			currentLevel: this.currentLevel,
		}
	}
	/**
	 * Backtracks to the last level number before the current one.
	 * @returns `null` is returned if there's no previous level
	 */
	async getPreviousRecord(): Promise<LevelSetRecord | null> {
		let newLevelN: number
		if (this.inPostGame) {
			// If we're in postgame, return to the last level (technically, the
			// scriptrunner *is* in the level after the last one, but the levelset
			// considers this to be it's own state, which **DOESN'T** get saved.)
			newLevelN = this.currentLevel
		} else {
			// Get all of the level numbers, and look at the previous one
			// The last level isn't just the level - 1, since level numbers, unlike in
			// CC1, don't have to have continuous level numbers
			const levelNums = Object.keys(this.seenLevels)
				.map(numStr => parseInt(numStr, 10))
				.sort((a, b) => a - b)
			const currentIndex = levelNums.indexOf(this.currentLevel)
			newLevelN = levelNums[currentIndex - 1]
		}
		if (!newLevelN) return null
		return this.goToLevel(newLevelN)
	}
	async goToLevel(newLevelN: number): Promise<LevelSetRecord> {
		const newRecord = this.seenLevels[newLevelN]
		const scriptLevelN = newRecord.levelInfo.scriptState?.variables?.level ?? 0

		if (scriptLevelN !== newLevelN)
			throw new Error(
				"Internal discrepency detected: script `level` variable and level record number don't match up."
			)
		const oldScriptPath = this.scriptRunner.state.scriptPath
		const scriptPath = newRecord.levelInfo.scriptState?.scriptPath
		const filePath = newRecord.levelInfo.levelFilePath
		if (!scriptPath || !filePath)
			throw new Error(
				"The last level record doesn't have a script and map path set."
			)

		// After all of the sanity checks and preparations, apply the actual changes

		// If we were in postgame before, we aren't anymore!
		this.inPostGame = false

		this.currentLevel = newLevelN
		this.scriptRunner.state = clone(newRecord.levelInfo.scriptState!)

		// Reload the script file if it has changed

		if (oldScriptPath !== scriptPath) {
			const scriptData = (await this.loaderFunction(
				scriptPath,
				false
			)) as string
			this.scriptRunner.loadScript(scriptData, scriptPath)
		}

		// Make the interrupt the previous level should have
		this.scriptRunner.scriptInterrupt = {
			type: "map",
			path: filePath,
		}

		await this.verifyLevelDataAvailability(newLevelN)

		return newRecord
	}
	/**
	 * Figures out the level record this levelset is currently at and returns it.
	 * Should only be used right after constructing this set. Reloading the
	 * current record after restarting should be done by passing the retry
	 * `map` interrupt to `getNextLevel` instead.
	 */
	async getCurrentRecord(): Promise<LevelSetRecord> {
		if (Object.keys(this.seenLevels).length === 0) {
			// If we have seen no levels, this must be a new set, so just open the
			// first level
			const record = await this.getNextRecord()
			if (record === null) {
				throw new Error("This set appears to have no levels.")
			}
			return record
		} else {
			// This set already has data. Just verify that the level data exists and
			// return the `currentLevel` level record.
			let record: LevelSetRecord | null = this.seenLevels[this.currentLevel]
			if (record === null) {
				// Try loading the level before this one. This may be an incorrectly
				// written save in postgame. (Have to get the next record first, to
				// detect if we're in postgame)
				const nextRecord = await this.getNextRecord()
				if (nextRecord === null && this.inPostGame) {
					record = await this.getPreviousRecord()
				}
				if (record === null)
					throw new Error(
						"This set appears to currently be on an non-existent level."
					)
			}
			await this.verifyLevelDataAvailability(this.currentLevel)
			return record
		}
	}
}
