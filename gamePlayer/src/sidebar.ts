import { Page, Pager } from "./pager"
import isHotkey, { parseHotkey } from "is-hotkey"
import { setSelectorPage } from "./pages/setSelector"
import { levelPlayerPage } from "./pages/levelPlayer"
import { openLevelListDialog } from "./levelList"
import { openSettingsDialog } from "./settings"
import { instanciateTemplate } from "./utils"
import { exaPlayerPage } from "./pages/exaPlayer"
import { openAllAttemptsDialog } from "./allAttemptsDialog"
import { generateSolutionTooltipEntries } from "./solutionTooltip"
import { Direction } from "@notcc/logic"

interface TooltipEntry {
	name: string | ((pager: Pager) => string)
	shortcut: string | null
	action?(pager: Pager): void
	enabledPages?: Page[]
}

export type BasicTooltipEntry = TooltipEntry | "breakline"

type TooltipEntryGenerator = (pager: Pager) => BasicTooltipEntry[]

type TooltipEntries = (BasicTooltipEntry | TooltipEntryGenerator)[]

const playerPages = [levelPlayerPage, exaPlayerPage]

const aboutDialog = document.querySelector<HTMLDialogElement>("#aboutDialog")

function openAboutDialog(): void {
	aboutDialog?.showModal()
}

export const tooltipGroups: Record<string, TooltipEntries> = {
	selector: [
		{
			name: "Set selector",
			shortcut: "esc",
			action(pager: Pager): void {
				pager.openPage(setSelectorPage)
			},
		},
	],
	level: [
		{
			name: "Reset level",
			shortcut: "shift+r",
			action(pager: Pager): void {
				pager.resetLevel()
			},
			enabledPages: playerPages,
		},
		{
			name: "Pause",
			shortcut: "p",
			action(pager: Pager): void {
				if (pager.currentPage === levelPlayerPage) {
					const page = pager.currentPage as typeof levelPlayerPage
					page.togglePaused()
				}
			},
			enabledPages: [levelPlayerPage],
		},
		"breakline",
		{
			name: "Previous level",
			shortcut: "shift+p",
			async action(pager: Pager): Promise<void> {
				await pager.loadPreviousLevel()
				pager.reloadLevel()
			},
			enabledPages: playerPages,
		},
		{
			name: "Next level",
			shortcut: "shift+n",
			async action(pager: Pager): Promise<void> {
				await pager.loadNextLevel({ type: "skip" })
				pager.reloadLevel()
			},
			enabledPages: playerPages,
		},
		{
			name: "Level list",
			shortcut: "shift+s",
			action(pager: Pager): void {
				if (pager.loadedSet) {
					openLevelListDialog(pager)
				}
			},
			enabledPages: playerPages,
		},
		"breakline",
		{
			name: pager =>
				`Change RFF direction (${Direction[pager.startingRffDirection]})`,
			shortcut: "shift+f",
			action(pager) {
				pager.startingRffDirection = (pager.startingRffDirection + 1) % 4
			},
		},
	],
	solution: [
		generateSolutionTooltipEntries,
		"breakline",
		{
			name: "All attempts",
			shortcut: "shift+a",
			action(pager: Pager): void {
				openAllAttemptsDialog(pager)
			},
		},
	],
	optimization: [
		{
			name: "Toggle ExaCC",
			shortcut: "shift+x",
			action(pager: Pager): void {
				if (pager.currentPage !== exaPlayerPage) {
					pager.openPage(exaPlayerPage)
				} else {
					pager.openPage(levelPlayerPage)
				}
			},
			enabledPages: playerPages,
		},
		{
			name: "Auto skip",
			shortcut: "a",
			action(pager: Pager): void {
				if (pager.currentPage !== exaPlayerPage) return
				exaPlayerPage.autoSkip()
			},
			enabledPages: [exaPlayerPage],
		},
		{
			name: "Undo",
			shortcut: "Backspace",
			action(pager: Pager): void {
				if (pager.currentPage !== exaPlayerPage) return
				exaPlayerPage.undo()
			},
			enabledPages: [exaPlayerPage],
		},
		{
			name: "Redo",
			shortcut: "Enter",
			action(pager: Pager): void {
				if (pager.currentPage !== exaPlayerPage) return
				exaPlayerPage.redo()
			},
			enabledPages: [exaPlayerPage],
		},
		{
			name: "Import route",
			shortcut: "shift+i",
			action(pager: Pager): void {
				if (pager.currentPage !== exaPlayerPage) return
				exaPlayerPage.importRoute(pager)
			},
			enabledPages: [exaPlayerPage],
		},
		{
			name: "Export route",
			shortcut: "shift+e",
			action(pager: Pager): void {
				if (pager.currentPage !== exaPlayerPage) return
				exaPlayerPage.exportRoute(pager)
			},
			enabledPages: [exaPlayerPage],
		},
	],
	settings: [
		{
			name: "Settings",
			shortcut: "shift+c",
			action(pager: Pager): void {
				openSettingsDialog(pager)
			},
		},
	],
	about: [
		{
			name: "About",
			shortcut: null,
			action(_pager: Pager): void {
				openAboutDialog()
			},
		},
	],
}

function isTooltipEntryDisabled(
	pager: Pager,
	tooltipEntry: TooltipEntry
): boolean {
	return (
		tooltipEntry.action === undefined ||
		(tooltipEntry.enabledPages !== undefined &&
			!tooltipEntry.enabledPages.includes(pager.currentPage))
	)
}

const tooltipTemplate =
	document.querySelector<HTMLTemplateElement>("#tooltipTemplate")!

export function openTooltip(
	pager: Pager,
	tooltipContents: TooltipEntries,
	at: HTMLElement
): void {
	if (tooltipContents.length === 0) return
	const tooltipRoot = instanciateTemplate(tooltipTemplate)
	const tooltipInsertionPoint =
		tooltipRoot.querySelector<HTMLDivElement>(".buttonTooltipBox")!

	tooltipInsertionPoint.tabIndex = 0

	let firstRow: HTMLElement | undefined

	function closeTooltip(): void {
		tooltipRoot.style.animation = `closeTooltip 0.4s ease-in`
		tooltipRoot.addEventListener("animationend", () => {
			tooltipRoot.remove()
		})
	}
	const basicTooltipEntries = tooltipContents
		.map(ent => (typeof ent === "function" ? ent(pager) : [ent]))
		.reduce((acc, ent) => acc.concat(...ent), [])

	for (const tooltipEntry of basicTooltipEntries) {
		if (tooltipEntry === "breakline") {
			tooltipInsertionPoint.appendChild(document.createElement("hr"))
			continue
		}
		const tooltipRow = document.createElement("div")
		tooltipRow.classList.add("buttonTooltipRow")

		if (isTooltipEntryDisabled(pager, tooltipEntry)) {
			tooltipRow.dataset.disabled = ""
		} else {
			tooltipRow.tabIndex = 0

			tooltipRow.addEventListener("click", () => {
				tooltipEntry.action?.(pager)
				closeTooltip()
			})
			if (firstRow === undefined) {
				firstRow = tooltipRow
			}
		}

		const tooltipName = document.createElement("div")
		tooltipName.classList.add("buttonTooltipItem")
		tooltipName.textContent =
			tooltipEntry.name instanceof Function
				? tooltipEntry.name(pager)
				: tooltipEntry.name
		tooltipRow.appendChild(tooltipName)

		if (tooltipEntry.shortcut !== null) {
			const tooltipShortcut = document.createElement("div")
			tooltipShortcut.classList.add("buttonTooltipKey")

			// eslint-disable-next-line no-inner-declarations
			function appendKey(key: string): void {
				const keyElement = document.createElement("kbd")
				keyElement.textContent = key
				tooltipShortcut.appendChild(keyElement)
				const spaceElement = document.createTextNode(" ")
				tooltipShortcut.appendChild(spaceElement)
			}

			const shortcutData = parseHotkey(tooltipEntry.shortcut, { byKey: true })

			if (shortcutData.ctrlKey) appendKey("Ctrl")
			if (shortcutData.metaKey) appendKey("⌘")
			if (shortcutData.shiftKey) appendKey("⇧")
			if (shortcutData.altKey) appendKey("Alt")
			appendKey(shortcutData.key!)

			tooltipRow.appendChild(tooltipShortcut)
		}
		tooltipInsertionPoint.appendChild(tooltipRow)
	}
	tooltipRoot.addEventListener("focusout", ev => {
		const isChildFocused = tooltipRoot.contains(ev.relatedTarget as Node)
		if (isChildFocused) return
		closeTooltip()
	})
	at.appendChild(tooltipRoot)

	if (firstRow) {
		firstRow.focus()
	} else {
		tooltipInsertionPoint.focus()
	}

	tooltipRoot.style.animation = `openTooltip 0.2s ease-out`
}

export function generateTabButtons(pager: Pager): void {
	const sidebar = document.querySelector<HTMLElement>("nav.sidebar")!
	for (const [tabName, tabEntries] of Object.entries(tooltipGroups)) {
		const tab = sidebar.querySelector<HTMLDivElement>(`#${tabName}Tab`)!
		const tabButton = tab.querySelector("img")!
		const handler = () => {
			openTooltip(pager, tabEntries, tab)
		}
		tabButton.addEventListener("click", handler)
		tabButton.addEventListener("keydown", ev => {
			if (ev.code === "Enter" || ev.code === "Space") {
				handler()
			}
		})
	}
}

export function generateShortcutListener(
	pager: Pager
): (ev: KeyboardEvent) => void {
	const allTooltipEntries = Object.values(tooltipGroups)
		.flat()
		.filter((val): val is TooltipEntry => val !== "breakline")
	const checkerFunctions: ((ev: KeyboardEvent) => void)[] = []
	for (const entry of allTooltipEntries) {
		if (!entry.shortcut || !entry.action) continue
		const verifyFunction = isHotkey(entry.shortcut)
		checkerFunctions.push(ev => {
			if (!verifyFunction(ev)) return
			if (isTooltipEntryDisabled(pager, entry)) return
			ev.preventDefault()
			ev.stopPropagation()
			entry.action!(pager)
		})
	}
	return ev => {
		for (const checker of checkerFunctions) {
			checker(ev)
		}
	}
}

export function setSidebarLevelN(num: string): void {
	const levelIconText = document.querySelector<HTMLDivElement>("#levelIconText")
	if (levelIconText) {
		levelIconText.textContent = num
	}
}
