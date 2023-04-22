import rfdc from "rfdc"
import {
	ScriptRunner,
	MapInterruptResponse,
	ScriptInterrupt,
} from "./parsers/c2g"
import { LevelData, parseC2M } from "./parsers/c2m"
import { ILevelInfo, ISetInfo } from "./parsers/nccs.pb"

export interface LevelSetRecord {
	levelData?: LevelData
	levelInfo: ILevelInfo
}

export type LevelSetLoaderFunction = (
	path: string,
	binary: boolean
) => Promise<string | ArrayBuffer>

const clone = rfdc()

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

		await this.verifyLevelDataAvailability(levelN, existingRecord?.levelData)

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
		levelRecord.levelData = parseC2M(levelBuffer, levelPath)
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
		const newRecord = this.seenLevels[newLevelN]
		const scriptLevelN = newRecord.levelInfo.scriptState?.variables?.level ?? 0

		if (scriptLevelN !== newLevelN)
			throw new Error(
				"Internal discrepency detected: script `level` variable and level record number don't match up."
			)
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

		// Reload the script file, in case a `chain` happened between the current
		// and next level

		const scriptData = (await this.loaderFunction(scriptPath, false)) as string
		this.scriptRunner.loadScript(scriptData, scriptPath)

		// Make the interrupt the previous level should have
		this.scriptRunner.scriptInterrupt = {
			type: "map",
			path: filePath,
		}

		await this.verifyLevelDataAvailability(newLevelN)

		return newRecord
	}
}
