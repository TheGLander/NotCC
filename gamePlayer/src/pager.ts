import { LevelData, LevelSet, MapInterruptResponse } from "@notcc/logic"
import { loadingPage } from "./pages/loading"
import { Tileset } from "./renderer"
import { setSidebarLevelN } from "./sidebar"
import { protobuf } from "@notcc/logic"
import { loadSettings, saveSetInfo, saveSettings } from "./saveData"
import { Settings, defaultSettings } from "./settings"
import clone from "clone"
import { ThemeColors, applyTheme } from "./themes"
import { updatePagerTileset } from "./tilesets"

export interface Page {
	pageId: string
	pagePath: string | null
	requiresLoaded: "none" | "set" | "level"
	setupInitialized?: boolean
	setupPage?: (pager: Pager, page: HTMLElement) => void
	open?: (pager: Pager, page: HTMLElement) => void
	close?: (pager: Pager, page: HTMLElement) => void
	updateTileset?: (pager: Pager) => void
	showInterlude?: (pager: Pager, text: string) => Promise<void>
	showGz?: (pager: Pager) => void
	loadLevel?: (page: Pager) => void
	loadSolution?: (pager: Pager, sol: protobuf.ISolutionInfo) => Promise<void>
	updateSettings?: (pager: Pager) => void
	setNavigationInfo?: (
		pager: Pager,
		subpage: string,
		queryParams: Record<string, string>
	) => void
}

export class Pager {
	currentPage!: Page
	loadedSet: LevelSet | null = null
	loadedSetIdent: string | null = null
	loadedLevel: LevelData | null = null
	tileset: Tileset | null = null
	settings: Settings = clone(defaultSettings)
	constructor() {
		this._initPage(loadingPage)
	}
	_initPage(page: Page): void {
		if (page.requiresLoaded === "set" && !this.loadedSet)
			throw new Error("Page requires a set to be loaded before opening it.")
		if (page.requiresLoaded === "level" && !this.loadedLevel)
			throw new Error("Page requires a level to be loaded before opening it.")
		const pageElement = document.getElementById(page.pageId)
		if (!pageElement) {
			throw new Error(`Can't find the page element for "${page.pageId}".`)
		}
		pageElement.classList.remove("closedPage")
		if (!page.setupInitialized) {
			page.setupPage?.(this, pageElement)
			page.setupInitialized = true
		}
		this.currentPage = page
		this.updatePageUrl()
		page.open?.(this, pageElement)
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
		} else {
			await this.writeSaveData()
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
		await this.writeSaveData()
	}
	async goToLevel(newLevelN: number): Promise<void> {
		if (!this.loadedSet)
			throw new Error("Can't load the previous level of a set without a set.")

		const newRecord = await this.loadedSet.goToLevel(newLevelN)
		// This is the first level of the set
		if (!newRecord) {
			return
		}

		this.loadedLevel = newRecord.levelData!
		this.updateShownLevelNumber()
		await this.writeSaveData()
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
	saveAttempt(attempt: protobuf.IAttemptInfo): void | Promise<void> {
		if (!this.loadedSet) return
		const levelInfo =
			this.loadedSet.seenLevels[this.loadedSet.currentLevel]?.levelInfo
		if (!levelInfo)
			throw new Error("The current level doesn't have a level record, somehow.")

		levelInfo.attempts ??= []
		levelInfo.attempts.push(attempt)
		return this.writeSaveData()
	}
	async writeSaveData(): Promise<void> {
		if (!this.loadedSet) return
		const scriptState = this.loadedSet.scriptRunner.state
		const scriptTitle = scriptState.scriptTitle
		if (!scriptTitle)
			throw new Error("The loaded set does not have an identifier set.")

		await saveSetInfo(this.loadedSet.toSetInfo(), scriptTitle)
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
	async reloadSettings(): Promise<void> {
		this.updateTheme()
		await updatePagerTileset(this)
		this.currentPage.updateSettings?.(this)
	}
	async saveSettings(newSettings: Settings): Promise<void> {
		this.settings = newSettings
		await saveSettings(this.settings)
		await this.reloadSettings()
	}
	async loadSettings(): Promise<void> {
		this.settings = await loadSettings()
		this.settings = { ...defaultSettings, ...this.settings }
		this.reloadSettings()
	}
	updatingPageUrl = false
	determinePageUrl(subpage: string, queryParams: Record<string, string>): URL {
		const newUrl = new URL(location.toString())
		const page = this.currentPage
		if (page.pagePath === null) {
			newUrl.hash = ""
			newUrl.search = ""
			return newUrl
		}
		let hash = `#/${page.pagePath}`
		if (page.requiresLoaded === "set" || page.requiresLoaded === "level") {
			let setName = this.loadedSetIdent
			if (setName === null) {
				setName = this.loadedSet !== null ? "*prompt-set" : "*prompt-level"
			}
			hash += `/${setName}`
		}
		if (page.requiresLoaded === "level") {
			hash += `/${this.loadedSet?.currentLevel ?? 1}`
		}
		if (subpage !== "") {
			hash += `/${subpage}`
		}
		newUrl.hash = hash
		if (Object.keys(queryParams).length !== 0) {
			newUrl.search = `?${new URLSearchParams(queryParams)}`
		} else {
			newUrl.search = ""
		}
		return newUrl
	}
	updatePageUrl(
		subpage: string = "",
		queryParams: Record<string, string> = {}
	) {
		const newLocation = this.determinePageUrl(subpage, queryParams)
		this.updatingPageUrl = true
		history.pushState(null, "", newLocation)
		this.updatingPageUrl = false
	}
}
