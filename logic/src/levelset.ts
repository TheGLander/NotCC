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

		let level: LevelData

		if (existingRecord) {
			level = existingRecord.levelData!
		} else {
			const levelData = (await this.loaderFunction(
				recordInterrupt.path,
				true
			)) as ArrayBuffer
			level = parseC2M(levelData, recordInterrupt.path)
		}

		const record: LevelSetRecord = {
			levelData: level,
			levelInfo: {
				prologueText: prologue,
				title: level.name,
				scriptState: clone(this.scriptRunner.state),
				levelNumber: levelN,
				attempts: existingRecord?.levelInfo.attempts,
				levelFilePath: recordInterrupt.path,
			},
		}
		this.seenLevels[levelN] = record

		record.levelInfo.title = record.levelData!.name

		return record
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
}
