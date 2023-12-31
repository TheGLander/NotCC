import { atom, useSetAtom } from "jotai"
import { useEffect } from "preact/compat"
import { Tileset } from "./GameRenderer/renderer"
import cga16Image from "@/tilesets/cga16.png"
import { fetchImage } from "@/helpers"
import { cc2ArtSet } from "./GameRenderer/cc2ArtSet"
import { initNotCCFs, isFile, readFile } from "@/fs"
import { allPreferencesAtom, allowWritingPreferencesAtom } from "@/preferences"

export const tilesetAtom = atom<Tileset | null>(null)

export function Preloader(props: { preloadComplete?: () => void }) {
	const setTileset = useSetAtom(tilesetAtom)
	const setAllPrefs = useSetAtom(allPreferencesAtom)
	const setAllowWritingPrefs = useSetAtom(allowWritingPreferencesAtom)
	async function prepareAssets() {
		let prefs: any = {}
		try {
			await initNotCCFs()
			if (await isFile("preferences.json")) {
				prefs = JSON.parse(
					new TextDecoder("utf-8").decode(await readFile("preferences.json"))
				)
			}
		} catch (err) {
			console.error(`Couldn't load preferences: ${err}`)
		}
		setAllPrefs(prefs)
		setAllowWritingPrefs(true)

		// TODO Preload custom tilesets
		setTileset({
			image: await fetchImage(cga16Image),
			tileSize: 8,
			wireWidth: 2 / 8,
			art: cc2ArtSet,
		})
		// TODO Preload SFX
	}
	useEffect(() => {
		if (!globalThis.window) return
		prepareAssets().then(() => props.preloadComplete?.())
	}, [])
	return <div class="box m-auto">Loading very important stuff...</div>
}
