import { useStore } from "jotai"
import { useEffect, useState } from "preact/compat"
import { initNotCCFs, isFile, readDir, readFile } from "@/fs"
import {
	allPreferencesAtom,
	preloadFinishedAtom,
	syncAllowed_thisisstupid,
} from "@/preferences"
import {
	tilesetIdAtom,
	tilesetAtom,
	getTileset,
	customTsetsAtom,
} from "./PreferencesPrompt/TilesetsPrompt"
import {
	customSfxAtom,
	getSfxSet,
	sfxAtom,
	sfxIdAtom,
} from "./PreferencesPrompt/SfxPrompt"

export function Preloader(props: { preloadComplete?: () => void }) {
	const { get, set } = useStore()
	const [loadingStage, setLoadingStage] = useState("javascript")
	async function prepareAssets() {
		setLoadingStage("user data")
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
		set(allPreferencesAtom, prefs)

		setLoadingStage("tileset")
		set(
			customTsetsAtom,
			(await readDir("/tilesets")).map(v => v.split(".").slice(0, -1).join("."))
		)
		set(tilesetAtom, await getTileset(get(tilesetIdAtom)))
		setLoadingStage("sfx")
		set(
			customSfxAtom,
			(await readDir("/sfx")).map(v => v.split(".").slice(0, -1).join("."))
		)
		set(sfxAtom, await getSfxSet(get(sfxIdAtom)))
		set(preloadFinishedAtom, true)
		setImmediate(() => (syncAllowed_thisisstupid.val = true))
	}
	useEffect(() => {
		if (!globalThis.window) return
		prepareAssets().then(() => props.preloadComplete?.())
	}, [])
	return (
		<div class="box m-auto">
			<b>Pre</b>paring...
			<br />
			Loading {loadingStage}
			<noscript>
				<br />
				It appears you have JavaScript disabled. You need to enable it to play
				NotCC
			</noscript>
		</div>
	)
}
