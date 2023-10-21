import { pages, registerPage } from "../const"
import { lookupGbSet } from "../gliderbotSets"
import { Pager } from "../pager"
import { initSaveData } from "../saveData"
import { updatePagerTileset } from "../tilesets"
import { levelPlayerPage } from "./levelPlayer"
import { setSelectorPage } from "./setSelector"
import { loadSet } from "../levelLoading"

function queryParamsToObj(query: string): Record<string, string> {
	return Object.fromEntries(
		// TypeScript has inaccurate typings here for some reason??
		new URLSearchParams(query) as unknown as Iterable<[string, string]>
	)
}

export async function openNotccUrl(pager: Pager): Promise<void> {
	const notccLocation = new URL("http://fake.notcc.path")
	try {
		notccLocation.href = `http://fake.notcc.path/${location.hash.slice(1)}`
	} catch {}

	let [pageName, ...subpageParts] = notccLocation.pathname.split("/").slice(1)
	const queryParams = {
		...queryParamsToObj(notccLocation.search),
		...queryParamsToObj(location.search),
	}

	let pageToOpen = pages[pageName] ?? setSelectorPage

	// Support LL-style queryParam level loading
	if (pageName === undefined && queryParams.level !== undefined) {
		pageToOpen = levelPlayerPage
		subpageParts = ["NotCCEmbed", "1"]
	}

	if (
		pageToOpen.requiresLoaded === "set" ||
		pageToOpen.requiresLoaded === "level"
	) {
		const setName = subpageParts.splice(0, 1)[0]
		if (setName === undefined)
			throw new Error(
				"URI must specify set to use. Try using something like eg. /play/cc2lp1/1, instead of /play"
			)
		const gbSet = await lookupGbSet(setName)
		if (gbSet === null)
			throw new Error(`Gliderbot set with name "${setName}" not found`)
		await loadSet(pager, gbSet.loaderFunction, gbSet.mainScript, true)
	}

	if (pageToOpen.requiresLoaded === "level") {
		const levelNStr = subpageParts.splice(0, 1)[0]
		if (levelNStr === undefined)
			throw new Error(
				"URI must specify level number to use. Try using something like eg. /play/cc2lp1/1, instead of /play/cc2lp1"
			)
		let levelN = parseInt(levelNStr, 10)

		const set = pager.loadedSet!

		while (set.currentLevel !== levelN) {
			set.lastLevelResult = { type: "skip" }
			await set.getNextRecord()
		}
		pager.loadedLevel = (await set.getCurrentRecord()).levelData!
	}

	pager.openPage(pageToOpen)
	pageToOpen.setNavigationInfo?.(pager, subpageParts.join("/"), queryParams)
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
