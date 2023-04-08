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
			const currentScriptState =
				this.seenLevels[this.currentLevel].levelInfo.scriptState
			this.scriptRunner = new ScriptRunner(
				scriptData,
				currentScriptState?.scriptPath ?? undefined,
				currentScriptState ?? undefined
			)
		}
	}
	static async constructAsync(
		mainScriptPath: string,
		loaderFunction: LevelSetLoaderFunction
	): Promise<LevelSet> {
		const scriptData = (await loaderFunction(mainScriptPath, false)) as string
		return new this(mainScriptPath, scriptData, loaderFunction)
	}
	lastLevelResult?: MapInterruptResponse
	async getNextRecord(): Promise<LevelSetRecord | null> {
		if (this.scriptRunner.scriptInterrupt) {
			if (!this.lastLevelResult)
				throw new Error("An action for the current map must be set.")
			this.scriptRunner.handleMapInterrupt(this.lastLevelResult)
		}
		const lastLevel = this.seenLevels[this.currentLevel]
		let prologue: string | undefined

		let interrupt: ScriptInterrupt | null

		do {
			interrupt = this.scriptRunner.executeUntilInterrupt()
			// Handle interrupts
			if (interrupt?.type === "script") {
				if (!lastLevel) {
					prologue ??= ""
					prologue += interrupt.text
				} else {
					lastLevel.levelInfo.epilogueText ??= ""
					lastLevel.levelInfo.epilogueText += interrupt.text
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
		if (recordInterrupt === null) return null

		const levelN = this.scriptRunner.state.variables?.level ?? 0
		this.currentLevel = levelN

		const existingRecord = this.seenLevels[levelN]

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
	getPreviousRecord(): LevelSetRecord | null {
		// Get all of the level numbers, and look at the previous one
		// The last level isn't just the level - 1, since level numbers, unlike in
		// CC1, don't have to have continuous level numbers
		const levelNums = Object.keys(this.seenLevels)
			.map(numStr => parseInt(numStr, 10))
			.sort((a, b) => a - b)
		const currentIndex = levelNums.indexOf(this.currentLevel)
		const newLevelN = levelNums[currentIndex - 1]
		if (!newLevelN) return null
		const newRecord = this.seenLevels[newLevelN]
		this.currentLevel = newLevelN
		// Also set the new script state
		this.scriptRunner.state = newRecord.levelInfo.scriptState ?? {}
		return newRecord
	}
}
