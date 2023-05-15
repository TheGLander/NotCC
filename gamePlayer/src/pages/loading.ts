import { Pager } from "../pager"
import { initSaveData } from "../saveData"
import { updatePagerTileset } from "../tilesets"
import { setSelectorPage } from "./setSelector"

export const loadingPage = {
	pageId: "loadingPage",
	async open(pager: Pager): Promise<void> {
		await initSaveData()
		try {
			await pager.loadSettings()
		} catch {
			// Didn't load settings. Fine if this is the first time we're opening the game
		}

		await updatePagerTileset(pager)

		pager.openPage(setSelectorPage)
	},
}
