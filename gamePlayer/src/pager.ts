import { LevelData, LevelSet, MapInterruptResponse } from "@notcc/logic"
import { loadingPage } from "./pages/loading"
import { Tileset } from "./visuals"
import { setSidebarLevelN } from "./sidebar"
import { protobuf } from "@notcc/logic"
import { loadSettings, saveSetInfo, saveSettings } from "./saveData"
import { Settings, defaultSettings } from "./settings"
import rfdc from "rfdc"
import { ThemeColors, applyTheme } from "./themes"

const clone = rfdc()

export interface Page {
	pageId: string
	setupInitialized?: boolean
	setupPage?: (pager: Pager, page: HTMLElement) => void
	open?: (pager: Pager, page: HTMLElement) => void
	close?: (pager: Pager, page: HTMLElement) => void
	updateTileset?: (pager: Pager) => void
	showInterlude?: (pager: Pager, text: string) => Promise<void>
	showGz?: (pager: Pager) => void
	loadLevel?: (page: Pager) => void
	loadSolution?: (pager: Pager, sol: protobuf.ISolutionInfo) => Promise<void>
}

export class Pager {
	currentPage!: Page
	loadedSet: LevelSet | null = null
	loadedLevel: LevelData | null = null
	tileset: Tileset | null = null
	settings: Settings = clone(defaultSettings)
	constructor() {
		this._initPage(loadingPage)
	}
	_initPage(page: Page): void {
		const pageElement = document.getElementById(page.pageId)
		if (!pageElement) {
			throw new Error(`Can't find the page element for "${page.pageId}".`)
		}
		pageElement.classList.remove("closedPage")
		if (!page.setupInitialized) {
			page.setupPage?.(this, pageElement)
			page.setupInitialized = true
		}
		page.open?.(this, pageElement)
		this.currentPage = page
	}
	openPage(newPage: Page): void {
		const oldPageElement = document.getElementById(this.currentPage.pageId)!
		this.currentPage.close?.(this, oldPageElement)
		oldPageElement.classList.add("closedPage")
		this._initPage(newPage)
	}
	getLevelNumber(): number | "not in set" | "not in level" {
		if (this.loadedSet) return this.loadedSet.currentLevel
		if (this.loadedLevel) return "not in set"
		return "not in level"
	}
	updateShownLevelNumber(): void {
		const levelN = this.getLevelNumber()
		let levelText: string
		if (typeof levelN === "number") {
			levelText = levelN.toString()
		} else if (levelN === "not in set") {
			levelText = "X"
		} else {
			levelText = "?"
		}
		setSidebarLevelN(levelText)
	}
	async loadNextLevel(action: MapInterruptResponse): Promise<void> {
		if (!this.loadedSet)
			throw new Error("Can't load the next level of a set without a set.")
		const currentRecord = this.loadedSet.seenLevels[this.loadedSet.currentLevel]

		this.loadedSet.lastLevelResult = action
		const newRecord = await this.loadedSet.getNextRecord()
		// TODO Only show unique text
		if (currentRecord && currentRecord.levelInfo.epilogueText) {
			await this.currentPage.showInterlude?.(
				this,
				currentRecord.levelInfo.epilogueText
			)
		}
		if (newRecord && newRecord.levelInfo.prologueText) {
			await this.currentPage.showInterlude?.(
				this,
				newRecord.levelInfo.prologueText
			)
		}
		this.loadedLevel = newRecord
			? newRecord.levelData!
			: currentRecord.levelData!
		this.updateShownLevelNumber()
		if (!newRecord) {
			this.currentPage.showGz?.(this)
		}
	}
	async loadPreviousLevel(): Promise<void> {
		if (!this.loadedSet)
			throw new Error("Can't load the previous level of a set without a set.")

		const newRecord = await this.loadedSet.getPreviousRecord()
		// This is the first level of the set
		if (!newRecord) {
			return
		}

		this.loadedLevel = newRecord.levelData!
		this.updateShownLevelNumber()
	}
	/**
	 * Resets the current level, complete with rerunning the script
	 */
	async resetLevel(): Promise<void> {
		if (this.loadedSet) {
			await this.loadNextLevel({ type: "retry" })
		}
		await this.reloadLevel()
	}
	/**
	 * Reload level by asking the current page to re-make the `loadedLevel`.
	 */
	async reloadLevel(): Promise<void> {
		this.currentPage.loadLevel?.(this)
	}
	saveAttempt(attempt: protobuf.IAttemptInfo): void {
		if (!this.loadedSet) return
		const levelInfo =
			this.loadedSet.seenLevels[this.loadedSet.currentLevel]?.levelInfo
		if (!levelInfo)
			throw new Error("The current level doesn't have a level record, somehow.")

		levelInfo.attempts ??= []
		levelInfo.attempts.push(attempt)
		const scriptState = this.loadedSet.scriptRunner.state
		const scriptTitle = scriptState.scriptTitle
		if (!scriptTitle)
			throw new Error("The loaded set does not have an identifier set.")

		saveSetInfo(this.loadedSet.toSetInfo(), scriptTitle)
	}
	async loadSolution(sol: protobuf.ISolutionInfo): Promise<void> {
		if (!this.currentPage.loadSolution)
			throw new Error("Current page doesn't support solution playback.")
		await this.currentPage.loadSolution(this, sol)
	}
	setTheme(theme: ThemeColors): void {
		applyTheme(document.body, theme)
	}
	updateTheme(): void {
		this.setTheme(this.settings.mainTheme)
	}
	reloadSettings(): void {
		this.updateTheme()
	}
	async saveSettings(newSettings: Settings): Promise<void> {
		this.settings = newSettings
		this.reloadSettings()
		await saveSettings(this.settings)
	}
	async loadSettings(): Promise<void> {
		this.settings = await loadSettings()
		this.reloadSettings()
	}
}
