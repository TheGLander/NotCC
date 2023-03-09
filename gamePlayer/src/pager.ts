import { LevelData, LevelSetData } from "@notcc/logic"
import { loadingPage } from "./pages/loading"
import { Tileset } from "./visuals"

export interface Page {
	pageId: string
	setupInitialized?: boolean
	setupPage?: (pager: Pager, page: HTMLElement) => void
	open?: (pager: Pager, page: HTMLElement) => void
	close?: (pager: Pager, page: HTMLElement) => void
}

export class Pager {
	currentPage!: Page
	loadedSet: LevelSetData | null = null
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
}
