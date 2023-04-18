import { LevelData, LevelSet, MapInterruptResponse } from "@notcc/logic"
import { loadingPage } from "./pages/loading"
import { Tileset } from "./visuals"
import { levelPlayerPage } from "./pages/levelPlayer"
import { setSidebarLevelN } from "./sidebar"
import { protobuf } from "@notcc/logic"
import { saveSetInfo } from "./saveData"

export interface Page {
	pageId: string
	setupInitialized?: boolean
	setupPage?: (pager: Pager, page: HTMLElement) => void
	open?: (pager: Pager, page: HTMLElement) => void
	close?: (pager: Pager, page: HTMLElement) => void
}

export class Pager {
	currentPage!: Page
	loadedSet: LevelSet | null = null
	loadedLevel: LevelData | null = null
	tileset: Tileset | null = null
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
	getLevelNumber(): number | null {
		return this.loadedSet ? this.loadedSet.currentLevel : null
	}
	updateShownLevelNumber(): void {
		const levelN = this.getLevelNumber()
		setSidebarLevelN(levelN === null ? "X" : levelN.toString())
	}
	async loadNextLevel(action: MapInterruptResponse): Promise<void> {
		if (!this.loadedSet)
			throw new Error("Can't load the next level of a set without a set.")
		const currentRecord = this.loadedSet.seenLevels[this.loadedSet.currentLevel]

		this.loadedSet.lastLevelResult = action
		const newRecord = await this.loadedSet.getNextRecord()
		// TODO Only show unique text
		if (currentRecord && currentRecord.levelInfo.epilogueText) {
			// TODO Use a text script page?
			alert(currentRecord.levelInfo.epilogueText)
		}
		if (!newRecord) {
			alert("You've finished the set, congratulations!!")
			return
		}
		if (newRecord && newRecord.levelInfo.prologueText) {
			alert(newRecord.levelInfo.prologueText)
		}
		this.loadedLevel = newRecord.levelData!
		this.updateShownLevelNumber()
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
	async resetCurrentLevel(): Promise<void> {
		if (this.loadedSet) {
			await this.loadNextLevel({ type: "retry" })
		}
		// TODO Do this for Super Mode too
		if (this.currentPage === levelPlayerPage) {
			const page = this.currentPage as typeof levelPlayerPage
			page.resetLevel(this)
		}
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
}
