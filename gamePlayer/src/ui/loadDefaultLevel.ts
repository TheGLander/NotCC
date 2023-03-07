import { startNewLevelSet } from "./loadLevel"
import { unzlib, AsyncUnzlibOptions } from "fflate"
import { toByteArray } from "base64-js"
import defaultLevel from "../data/NotCC.c2m"

function unzlibActuallyAsync(
	buffer: ArrayBuffer,
	options: AsyncUnzlibOptions = { consume: true }
): Promise<ArrayBuffer> {
	return new Promise((res, rej) =>
		unzlib(new Uint8Array(buffer), options, (err, data) => {
			if (err) rej(err)
			else res(data.buffer)
		})
	)
}

;(async () => {
	let customLevelLoaded = false
	try {
		const params = new URLSearchParams(location.search)
		const stringLevelData = params.get("level")

		if (stringLevelData) {
			let levelData = toByteArray(
				// This is some weird "base64 url safe" data
				stringLevelData.replace(/_/g, "/").replace(/-/g, "+")
			).buffer
			if (new Uint8Array(levelData)[0] === 0x78)
				levelData = await unzlibActuallyAsync(levelData)
			await startNewLevelSet(levelData, "unknown.?")
			customLevelLoaded = true
		}
	} catch (err) {
		console.error("Encountered an error while loading the level")
		console.error(err)
	}
	if (!customLevelLoaded) {
		const levelData = (
			await (await fetch(defaultLevel)).body?.getReader()?.read()
		)?.value?.buffer
		if (!levelData) console.log("Couldn't fetch default level")
		else startNewLevelSet(levelData, "NotCC.c2m")
	}
})()
