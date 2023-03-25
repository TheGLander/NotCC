import rfdc from "rfdc"
import {
	ScriptRunner,
	MapInterruptResponse,
	ScriptInterrupt,
} from "./parsers/c2g"
import { LevelData, parseC2M } from "./parsers/c2m"
import { ILevelInfo } from "./parsers/nccs.pb"

export interface LevelSetRecord {
	levelData: LevelData
	levelInfo: ILevelInfo
}

export type LevelSetLoaderFunction = (
	path: string,
	binary: boolean
) => Promise<string | ArrayBuffer>

interface LevelSetData {
	seenLevels: Record<number, LevelSetRecord>
	currentLevel: number
}

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
		setData: LevelSetData,
		scriptData: string,
		loaderFunction: LevelSetLoaderFunction
	)
	constructor(
		setDataOrMainScriptPath: LevelSetData | string,
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
			this.currentLevel = setData.currentLevel
			this.seenLevels = setData.seenLevels
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
			level = existingRecord.levelData
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
			},
		}
		this.seenLevels[levelN] = record

		return record
	}
}
