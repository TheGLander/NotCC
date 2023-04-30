import cc2ImageFormat from "../cc2ImageFormat"
import tilesetImage from "../data/img/tiles.png"
import { Pager } from "../pager"
import {
	generateActorFrames,
	loadImage,
	removeBackground,
	Tileset,
} from "../visuals"
import { setSelectorPage } from "./setSelector"

export const loadingPage = {
	pageId: "loadingPage",
	async open(pager: Pager): Promise<void> {
		try {
			await pager.loadSettings()
		} catch {
			// Didn't load settings. Fine if this is the first time we're opening the game
		}
		const tillesetImage = await loadImage(tilesetImage)
		const filteredImage = removeBackground(tillesetImage)
		const frameMap = generateActorFrames(cc2ImageFormat)
		const tileset: Tileset = {
			frameMap,
			image: filteredImage,
			tileSize: 32,
			wireWidth: 2,
		}
		pager.tileset = tileset
		pager.openPage(setSelectorPage)
	},
}
