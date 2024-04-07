import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "preact/compat"
import { initNotCCFs, isFile, readDir, readFile } from "@/fs"
import { allPreferencesAtom, allowWritingPreferencesAtom } from "@/preferences"
import {
	tilesetIdAtom,
	tilesetAtom,
	getTileset,
	customTsetsAtom,
} from "./PreferencesPrompt/TilesetsPrompt"

export function Preloader(props: { preloadComplete?: () => void }) {
	const tilesetId = useAtomValue(tilesetIdAtom)
	const setTileset = useSetAtom(tilesetAtom)
	const setCustomTSetList = useSetAtom(customTsetsAtom)
	const setAllPrefs = useSetAtom(allPreferencesAtom)
	const setAllowWritingPrefs = useSetAtom(allowWritingPreferencesAtom)
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
		setAllPrefs(prefs)
		setAllowWritingPrefs(true)

		setLoadingStage("tileset")
		setCustomTSetList(
			(await readDir("/tilesets")).map(v => v.split(".").slice(0, -1).join("."))
		)
		setTileset(await getTileset(tilesetId))
		setLoadingStage("sfx")
		// TODO Preload SFX
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
