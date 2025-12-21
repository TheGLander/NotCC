import clone from "clone"
import { protoTimeToMs, protoTimeToSubticks } from "./attemptTracker.js"
import {
	ScriptRunner,
	MapInterruptResponse,
	ScriptInterrupt,
	makeLinearLevels,
} from "./c2g.js"
import { Level, LevelMetadata, parseC2M, parseC2MMeta } from "../level.js"
import {
	IAttemptInfo,
	ILevelInfo,
	ISetInfo,
	ISolutionOutcomeInfo,
} from "./nccs.pb.js"

export interface LevelSetRecord {
	levelData?: Level
	levelInfo: ILevelInfo
}

export type LevelSetRecordFull = Required<LevelSetRecord>

export function calculateLevelPoints(
	levelN: number,
	timeLeft: number,
	bonusPoints = 0
): number {
	return levelN * 500 + timeLeft * 10 + bonusPoints
}

export interface SolutionMetrics {
	timeLeft: number
	score: number
	realTime: number
}

export function metricsFromAttempt(
	levelN: number,
	outcome: ISolutionOutcomeInfo
): SolutionMetrics {
	if (!outcome.timeLeft || !outcome.absoluteTime)
		throw new Error("Incomplete attempt info")
	const timeLeft = protoTimeToSubticks(outcome.timeLeft)
	const points = calculateLevelPoints(
		levelN,
		Math.ceil(timeLeft / 60),
		outcome.bonusScore ?? 0
	)
	const realTime = protoTimeToMs(outcome.absoluteTime) / 1000

	return { timeLeft, score: points, realTime }
}

export function findBestMetrics(info: ILevelInfo): SolutionMetrics | null {
	if (typeof info.levelNumber !== "number")
		throw new Error("Incomplete level info")
	const metrics: Partial<SolutionMetrics> = {}
	if (!info.attempts || info.attempts.length === 0) return null
	const levelN = info.levelNumber

	for (const attempt of info.attempts) {
		if (!attempt.solution?.outcome) continue
		const {
			realTime,
			score: points,
			timeLeft,
		} = metricsFromAttempt(levelN, attempt.solution.outcome)
		if (metrics.timeLeft === undefined || metrics.timeLeft < timeLeft) {
			metrics.timeLeft = timeLeft
		}
		if (metrics.score === undefined || metrics.score < points) {
			metrics.score = points
		}
		if (metrics.realTime === undefined || metrics.realTime > realTime) {
			metrics.realTime = realTime
		}
	}
	// If we went over at least one successful attempt, we definitely populated
	// all fields.
	return "timeLeft" in metrics ? (metrics as SolutionMetrics) : null
}

export type LevelSetLoaderFunction = ((
	path: string,
	binary: false
) => Promise<string>) &
	((path: string, binary: true) => Promise<ArrayBuffer>) &
	((path: string, binary: boolean) => Promise<string | ArrayBuffer>)

export interface LevelSetData {
	loaderFunction: LevelSetLoaderFunction
	scriptFile: string
}

export abstract class LevelSet {
	currentLevel: number = 1
	inPostGame = false
	// Why do abstract classes need constructors, again?
	constructor(public loaderFunction: LevelSetLoaderFunction) {}
	abstract gameTitle(): string
	abstract scriptTitle(): string
	abstract initialLevel(): Promise<LevelSetRecord>
	abstract currentLevelRecord(): LevelSetRecord
	abstract previousLevel(): Promise<LevelSetRecord | null>
	abstract nextLevel(type: MapInterruptResponse): Promise<LevelSetRecord | null>
	abstract toSetInfo(): ISetInfo
	logAttemptInfo(attempt: IAttemptInfo): void {
		const level = this.currentLevelRecord()
		if (!level)
			throw new Error("This set appears to be on a non-existent level.")
		level.levelInfo.attempts ??= []
		level.levelInfo.attempts.push(attempt)
	}
	abstract goToLevel(n: number): Promise<LevelSetRecord | null>
	abstract canGoToLevel(n: number): boolean
	abstract listLevels(): LevelSetRecord[]
	async loadLevelData(record: LevelSetRecord): Promise<LevelSetRecordFull> {
		if (record.levelData) return record as LevelSetRecordFull

		const levelPath = record.levelInfo.levelFilePath
		if (!levelPath) throw new Error("The level does not have a path specified.")

		const levelBuffer = await this.loaderFunction(levelPath, true)
		record.levelData = parseC2M(levelBuffer)
		// Emulate CC1 Steam having CC1 boots always enabled
		if (this.gameTitle() === "Chips Challenge") {
			record.levelData.metadata.cc1Boots = true
		}
		return record as LevelSetRecordFull
	}
	totalMetrics(): SolutionMetrics {
		return this.listLevels()
			.map<SolutionMetrics | null>(rec => findBestMetrics(rec.levelInfo))
			.reduce<SolutionMetrics>(
				(acc, val) =>
					val === null
						? acc
						: {
								realTime: acc.realTime + val.realTime,
								timeLeft: acc.timeLeft + val.timeLeft,
								score: acc.score + val.score,
							},
				{ score: 0, timeLeft: 0, realTime: 0 }
			)
	}
}

export class FullC2GLevelSet extends LevelSet {
	seenLevels: Record<number, LevelSetRecord>
	scriptRunner: ScriptRunner
	currentLevel: number
	hasReahedPostgame = false
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
		loaderFunction: LevelSetLoaderFunction
	) {
		super(loaderFunction)
		this.loaderFunction = loaderFunction
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
			this.hasReahedPostgame = !!setData.hasReachedPostgame
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
		saveDataOrMainScriptPath: string | ISetInfo,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet>
	static async constructAsync(
		saveData: ISetInfo,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet>
	static async constructAsync(
		mainScriptPath: string,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet>
	static async constructAsync(
		saveDataOrMainScriptPath: string | ISetInfo,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet> {
		let scriptPath: string
		if (typeof saveDataOrMainScriptPath === "string") {
			scriptPath = saveDataOrMainScriptPath
		} else {
			const levelN = saveDataOrMainScriptPath.currentLevel
			if (typeof levelN !== "number")
				throw new Error("The set data must have a current level set.")
			const levelData = saveDataOrMainScriptPath.levels?.find(
				lvl => typeof lvl.levelNumber === "number" && lvl.levelNumber === levelN
			)
			const setScriptPath = levelData?.scriptState?.scriptPath
			if (typeof setScriptPath !== "string")
				throw new Error("The set level does not have a script path set.")

			scriptPath = setScriptPath
		}
		const scriptData = await loaderFunction(scriptPath, false)
		return new this(
			// This is false, but Typescript for some reason doesn't like passing a
			// union here?
			scriptPath,
			scriptData,
			loaderFunction
		)
	}
	async nextLevel(res: MapInterruptResponse): Promise<LevelSetRecord | null> {
		if (this.inPostGame) return null

		if (this.scriptRunner.scriptInterrupt) {
			this.scriptRunner.handleMapInterrupt(res)
		}
		const lastLevel = this.seenLevels[this.currentLevel]?.levelInfo
		const accumulatedIntermisssionText: string[] = []

		let interrupt: ScriptInterrupt | null

		do {
			interrupt = this.scriptRunner.executeUntilInterrupt()
			// Handle interrupts
			if (interrupt?.type === "script") {
				accumulatedIntermisssionText.push(interrupt.text)
				this.scriptRunner.scriptInterrupt = null
			} else if (interrupt?.type === "chain") {
				// Chain interrupt
				const newFile = await this.loaderFunction(interrupt.path, false)
				this.scriptRunner.handleChainInterrupt(newFile)
			}
		} while (interrupt && interrupt.type !== "map")
		// Typescript just doesn't figure this out, for some reason
		const recordInterrupt = interrupt as
			| (ScriptInterrupt & { type: "map" })
			| null
		if (recordInterrupt === null) {
			this.inPostGame = true
			this.hasReahedPostgame = true
			return null
		}

		const levelN = this.scriptRunner.state.variables?.level ?? 0
		this.currentLevel = levelN

		const existingRecord = this.seenLevels[levelN]

		if (lastLevel) {
			lastLevel.epilogueText = accumulatedIntermisssionText
		}

		const record: LevelSetRecord = {
			levelInfo: {
				prologueText: lastLevel ? undefined : accumulatedIntermisssionText,
				scriptState: clone(this.scriptRunner.state),
				levelNumber: levelN,
				attempts: existingRecord?.levelInfo.attempts,
				levelFilePath: recordInterrupt.path,
			},
		}
		this.seenLevels[levelN] = record

		record.levelInfo.title = (await this.fetchLevelMetadata(levelN)).title
		// TODO: Handle [COM] also

		return record
	}
	async fetchLevelMetadata(levelN: number): Promise<LevelMetadata> {
		const levelRecord = this.seenLevels[levelN]
		if (!levelRecord) throw new Error(`No level ${levelN} exists.`)
		const levelPath = levelRecord.levelInfo.levelFilePath
		if (!levelPath) throw new Error("The level does not have a path specified.")

		const levelBuffer = await this.loaderFunction(levelPath, true)
		return parseC2MMeta(levelBuffer)
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
			hasReachedPostgame: this.hasReahedPostgame,
		}
	}
	/**
	 * Backtracks to the last level number before the current one.
	 * @returns `null` is returned if there's no previous level
	 */
	async previousLevel(): Promise<LevelSetRecord | null> {
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
	canGoToLevel(levelN: number): boolean {
		return levelN in this.seenLevels
	}
	async goToLevel(newLevelN: number): Promise<LevelSetRecord> {
		const newRecord = this.seenLevels[newLevelN]
		if (!newRecord)
			throw new Error(`Level set hasn't seen level ${newLevelN} yet.`)
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
			const scriptData = await this.loaderFunction(scriptPath, false)
			this.scriptRunner.loadScript(scriptData, scriptPath)
		}

		// Make the interrupt the previous level should have
		this.scriptRunner.scriptInterrupt = {
			type: "map",
			path: filePath,
		}

		return this.loadLevelData(newRecord)
	}
	/**
	 * Figures out the level record this levelset is currently at and returns it.
	 * Should only be used right after constructing this set. Reloading the
	 * current record after restarting should be done by passing the retry
	 * `map` interrupt to `nextLevel` instead.
	 */
	async initialLevel(): Promise<LevelSetRecord> {
		if (Object.keys(this.seenLevels).length === 0) {
			// If we have seen no levels, this must be a new set, so just open the
			// first level
			// (the map resolution type doesn't matter because we actually didn't have a map
			// to respond to)
			const record = await this.nextLevel({ type: "skip" })
			if (record === null) {
				throw new Error("This set appears to have no levels.")
			}
			return this.loadLevelData(record)
		} else {
			// This set already has data. Just verify that the level data exists and
			// return the `currentLevel` level record.
			let record: LevelSetRecord | null = this.seenLevels[this.currentLevel]
			if (record === null) {
				// Try loading the level before this one. This may be an incorrectly
				// written save in postgame. (Have to get the next record first, to
				// detect if we're in postgame)
				const nextRecord = await this.nextLevel({ type: "skip" })
				if (nextRecord === null && this.inPostGame) {
					record = await this.previousLevel()
				}
				if (record === null)
					throw new Error(
						"This set appears to currently be on an non-existent level."
					)
			}
			return this.loadLevelData(record)
		}
	}
	gameTitle(): string {
		return this.scriptRunner.state.gameTitle!
	}
	scriptTitle(): string {
		return this.scriptRunner.state.scriptTitle!
	}
	listLevels(): LevelSetRecord[] {
		return Object.entries(this.seenLevels)
			.sort(([a], [b]) => parseInt(a) - parseInt(b))
			.map(([, rec]) => rec)
	}
	currentLevelRecord() {
		return this.seenLevels[this.currentLevel]
	}
}

export class LinearLevelSet extends LevelSet {
	constructor(
		public levels: ILevelInfo[],
		loaderFunction: LevelSetLoaderFunction,
		setData?: ISetInfo
	) {
		super(loaderFunction)
		if (setData) {
			if (setData.ruleset !== "Steam" || setData.setType !== "C2G")
				throw new Error("LevelSet only represents sets based on C2G scripts.")
			if (
				typeof setData.currentLevel !== "number" ||
				setData.levels == undefined
			)
				throw new Error("Given set data is missing essential properties.")
			this.currentLevel = setData.currentLevel
			for (const loadedLevel of setData.levels) {
				const localLevel = this.levels.find(
					lvl =>
						lvl.levelFilePath === loadedLevel.levelFilePath ||
						(lvl.levelNumber == loadedLevel.levelNumber &&
							lvl.title === loadedLevel.title)
				)
				if (!localLevel) continue
				localLevel.attempts = loadedLevel.attempts
			}
		}
	}
	findLevelForLevelN(n: number): ILevelInfo | undefined {
		return this.levels.find(level => level.levelNumber === n)
	}
	canGoToLevel(n: number) {
		return !!this.findLevelForLevelN(n)
	}
	currentLevelRecord() {
		return { levelInfo: this.findLevelForLevelN(this.currentLevel)! }
	}
	gameTitle() {
		return this.levels[0]!.scriptState!.gameTitle!
	}
	scriptTitle() {
		return this.levels[0]!.scriptState!.scriptTitle!
	}
	goToLevel(n: number) {
		if (!this.canGoToLevel(n)) throw new Error(`No level #${n} exists`)
		this.currentLevel = n
		return Promise.resolve(this.currentLevelRecord())
	}
	initialLevel() {
		return Promise.resolve(this.currentLevelRecord())
	}
	listLevels() {
		return this.levels.map<LevelSetRecord>(level => ({ levelInfo: level }))
	}
	nextLevel() {
		if (!this.canGoToLevel(this.currentLevel + 1)) return Promise.resolve(null)
		return this.goToLevel(this.currentLevel + 1)
	}
	previousLevel() {
		if (!this.canGoToLevel(this.currentLevel - 1)) return Promise.resolve(null)
		return this.goToLevel(this.currentLevel - 1)
	}
	toSetInfo(): ISetInfo {
		return {
			ruleset: "Steam",
			setType: "C2G",
			setName: this.gameTitle(),
			currentLevel: this.currentLevel,
			levels: this.levels,
		}
	}
}

export async function constructSimplestLevelSet(
	setData: LevelSetData,
	save?: ISetInfo
): Promise<LevelSet> {
	const linearLevels = await makeLinearLevels(setData)
	if (linearLevels) {
		return new LinearLevelSet(linearLevels, setData.loaderFunction, save)
	}
	return await FullC2GLevelSet.constructAsync(
		save ? save : setData.scriptFile,
		setData.loaderFunction
	)
}
