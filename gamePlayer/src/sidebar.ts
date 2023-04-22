import { Page, Pager } from "./pager"
import isHotkey, { parseHotkey } from "is-hotkey"
import { setSelectorPage } from "./pages/setSelector"
import { levelPlayerPage } from "./pages/levelPlayer"
import { openLevelListDialog } from "./levelList"
import { protobuf } from "@notcc/logic"

interface TooltipEntry {
	name: string
	shortcut: string | null
	action?(pager: Pager): void
	enabledPages?: Page[]
}

type BasicTooltipEntry = TooltipEntry | "breakline"

type TooltipEntryGenerator = (pager: Pager) => BasicTooltipEntry[]

type TooltipEntries = (BasicTooltipEntry | TooltipEntryGenerator)[]

const playerPages = [levelPlayerPage]

interface TTSolutionEntry {
	title: string
	solution: protobuf.ISolutionInfo
}

function durationToSeconds(dur: protobuf.google.protobuf.IDuration): number {
	return (
		((dur.seconds as number) ?? 0) +
		(dur.nanos ? (dur.nanos as number) / 1_000_000 : 0)
	)
}

function generateSolutionTooltipEntries(pager: Pager): BasicTooltipEntry[] {
	if (!pager.loadedLevel) return [{ name: "No level loaded.", shortcut: null }]
	const shownSolutions: TTSolutionEntry[] = []
	const builtinSolution = pager.loadedLevel?.associatedSolution
	if (builtinSolution) {
		shownSolutions.push({ title: "Built-in", solution: builtinSolution })
	}
	if (pager.loadedSet) {
		const levelRecord = pager.loadedSet.seenLevels[pager.loadedSet.currentLevel]
		const attempts = levelRecord.levelInfo.attempts
		if (attempts) {
			for (const attempt of attempts) {
				if (attempt.failReason || !attempt.solution) continue
				shownSolutions.push({ solution: attempt.solution, title: "Saved" })
			}
		}
	}

	if (shownSolutions.length === 0)
		return [{ name: "No solutions found.", shortcut: null }]
	return shownSolutions.map(solEntry => {
		const timeLeft = solEntry.solution.outcome?.timeLeft
		return {
			name: `${solEntry.title} - ${
				timeLeft ? `${Math.ceil(durationToSeconds(timeLeft))}s` : "???s"
			}`,
			shortcut: null,
			action() {
				// TODO
				alert("Whoo playing back a solutoin")
			},
		}
	})
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
					openLevelListDialog(pager.loadedSet)
				}
			},
			enabledPages: playerPages,
		},
	],
	solution: [
		generateSolutionTooltipEntries,
		"breakline",
		{ name: "All attempts", shortcut: "shift+a" },
	],
	optimization: [],
	settings: [{ name: "Settings", shortcut: "shift+c" }],
	about: [{ name: "About", shortcut: null }],
}

const tooltipTemplate =
	document.querySelector<HTMLTemplateElement>("#tooltipTemplate")!

export function openTooltip(
	pager: Pager,
	tooltipContents: TooltipEntries,
	at: HTMLElement
): void {
	if (tooltipContents.length === 0) return
	const tooltipFragment = tooltipTemplate.content.cloneNode(
		true
	) as DocumentFragment
	// Explicitly get the tooltip root so that we can actually attach events
	const tooltipRoot = tooltipFragment.firstElementChild! as HTMLDivElement
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

		if (
			tooltipEntry.action === undefined ||
			(tooltipEntry.enabledPages &&
				!tooltipEntry.enabledPages.includes(pager.currentPage))
		) {
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
		tooltipName.textContent = tooltipEntry.name
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
