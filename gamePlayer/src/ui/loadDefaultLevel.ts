import { startNewLevelSet } from "./loadLevel"

// Kinda like new TextEncoder().encode, but without UTF-8 in mind
// BTW, I didn't know that ArrayConstructor.from could be used like this, thanks eevee!
function decodeRawStringToArrayBuffer(str: string): ArrayBuffer {
	return Uint8Array.from(str, char => char.codePointAt(0) ?? 0).buffer
}

;(async () => {
	let customLevelLoaded = false
	try {
		const params = new URLSearchParams(location.search)
		const levelData = params.get("level")

		if (levelData) {
			await startNewLevelSet(
				decodeRawStringToArrayBuffer(
					// This is some weird "base64 url safe" data
					atob(levelData.replace(/_/g, "/").replace(/-/g, "+"))
				),
				"unknown.c2m"
			)
			customLevelLoaded = true
		}
	} catch (err) {
		console.error("Encountered an error while loading the level")
		console.error(err)
	}
	if (!customLevelLoaded) {
		const levelData = (
			await (await fetch("./data/NotCC.c2m")).body?.getReader()?.read()
		)?.value?.buffer
		if (!levelData) console.log("Couldn't fetch default level")
		else startNewLevelSet(levelData, "NotCC.c2m")
	}
})()
