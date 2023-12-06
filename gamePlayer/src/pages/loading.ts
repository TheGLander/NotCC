import { pages, registerPage } from "../const"
import { lookupGbSet } from "../gliderbotSets"
import { Pager } from "../pager"
import { initSaveData } from "../saveData"
import { updatePagerTileset } from "../tilesets"
import { setSelectorPage } from "./setSelector"
import { loadDirSet, loadSet } from "../levelLoading"
import { findScriptName, LevelSetLoaderFunction } from "@notcc/logic"
import { waitForDialogSubmit } from "../simpleDialogs"

function queryParamsToObj(query: string): Record<string, string> {
	return Object.fromEntries(
		// TypeScript has inaccurate typings here for some reason??
		new URLSearchParams(query) as unknown as Iterable<[string, string]>
	)
}

export async function openNotccUrl(pager: Pager): Promise<void> {
	if (pager.updatingPageUrl) return
	const notccLocation = new URL("http://fake.notcc.path")
	try {
		notccLocation.href = `http://fake.notcc.path/${location.hash.slice(1)}`
	} catch {}

	let [pageName, ...subpageParts] = notccLocation.pathname.split("/").slice(2)
	const queryParams = {
		...queryParamsToObj(notccLocation.search),
		...queryParamsToObj(location.search),
	}

	let pageToOpen = pages[pageName] ?? setSelectorPage

	if (
		pageToOpen.requiresLoaded === "set" ||
		pageToOpen.requiresLoaded === "level"
	) {
		const setName = subpageParts.splice(0, 1)[0]
		if (setName === undefined)
			throw new Error(
				"URI must specify set to use. Try using something like eg. /play/cc2lp1/1, instead of /play"
			)
		if (setName in nonFreeSets) {
			const setLoadingInfo = await showNonFreeDialog(setName)
			if (setLoadingInfo === null) {
				pageToOpen = setSelectorPage
			} else {
				pager.loadedSetIdent = setName
				await loadSet(pager, setLoadingInfo[0], setLoadingInfo[1], true)
			}
		} else {
			const gbSet = await lookupGbSet(setName)
			if (gbSet === null)
				throw new Error(`Gliderbot set with name "${setName}" not found`)
			pager.loadedSetIdent = setName
			await loadSet(pager, gbSet.loaderFunction, gbSet.mainScript, true)
		}
	}

	if (pageToOpen.requiresLoaded === "level") {
		const levelNStr = subpageParts.splice(0, 1)[0]
		if (levelNStr === undefined)
			throw new Error(
				"URI must specify level number to use. Try using something like eg. /play/cc2lp1/1, instead of /play/cc2lp1"
			)
		let levelN = parseInt(levelNStr, 10)

		const set = pager.loadedSet!

		while (set.currentLevel < levelN) {
			set.lastLevelResult = { type: "skip" }
			await set.getNextRecord()
		}
		await set.goToLevel(levelN)
		pager.loadedLevel = (await set.getCurrentRecord()).levelData!
	}

	pager.openPage(pageToOpen)
	pageToOpen.setNavigationInfo?.(pager, subpageParts.join("/"), queryParams)
}

interface NonFreeSet {
	scriptName: string
	steamLink: string
	acquisitionTerm: string
}

export const nonFreeSets: Record<string, NonFreeSet> = {
	cc1: {
		scriptName: "Chips Challenge",
		steamLink: "https://store.steampowered.com/app/346850/Chips_Challenge_1",
		acquisitionTerm: "download it for free from",
	},
	cc2: {
		scriptName: "Chips Challenge 2",
		steamLink: "https://store.steampowered.com/app/348300/Chips_Challenge_2",
		acquisitionTerm: "but it on",
	},
}

export function getNonFreeSetId(scriptName: string): string | null {
	return (
		Object.entries(nonFreeSets).find(
			([_, val]) => val.scriptName === scriptName
		)?.[0] ?? null
	)
}

const nonFreeSetDialog =
	document.querySelector<HTMLDialogElement>("#nonFreeSetDialog")!

async function showNonFreeDialog(
	setName: string
): Promise<[LevelSetLoaderFunction, string] | null> {
	const setInfo = nonFreeSets[setName]
	const steamLink =
		nonFreeSetDialog.querySelector<HTMLAnchorElement>("#nonFreeSteamLink")!
	const acquisitionTerm = nonFreeSetDialog.querySelector<HTMLSpanElement>(
		"#nonFreeSetAcquisitionTerm"
	)!
	steamLink.href = setInfo.steamLink
	acquisitionTerm.innerText = setInfo.acquisitionTerm
	nonFreeSetDialog.showModal()
	const response = (await waitForDialogSubmit(nonFreeSetDialog, false)) as
		| "load"
		| "cancel"
	if (response === "cancel") return null
	const [loader, scriptPath] = await loadDirSet()
	const scriptName = findScriptName((await loader(scriptPath, false)) as string)
	if (scriptName !== setInfo.scriptName) {
		throw new Error(
			`Incorrect set provided: Expected set name "${setInfo.scriptName}", got "${scriptName}"`
		)
	}
	return [loader, scriptPath]
}

export const loadingPage = {
	pageId: "loadingPage",
	pagePath: null,
	requiresLoaded: "none" as const,
	async open(pager: Pager): Promise<void> {
		await initSaveData()
		try {
			await pager.loadSettings()
		} catch {
			// Didn't load settings. Fine if this is the first time we're opening the game
		}

		await updatePagerTileset(pager)
		await openNotccUrl(pager)
	},
}

registerPage(loadingPage)
