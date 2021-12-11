import { startNewLevelSet } from "./loadLevel"
import { unzlib, AsyncUnzlibOptions } from "fflate"

function unzlibActuallyAsync(
	buffer: ArrayBuffer,
	options: AsyncUnzlibOptions = { consume: true, size: buffer.byteLength }
): Promise<ArrayBuffer> {
	return new Promise((res, rej) =>
		unzlib(new Uint8Array(buffer), options, (err, data) => {
			if (err) rej(err)
			else res(data.buffer)
		})
	)
}

// Kinda like new TextEncoder().encode, but without UTF-8 in mind
// BTW, I didn't know that ArrayConstructor.from could be used like this, thanks eevee!
function decodeRawStringToArrayBuffer(str: string): ArrayBuffer {
	return Uint8Array.from(str, char => char.codePointAt(0) ?? 0).buffer
}

;(async () => {
	let customLevelLoaded = false
	try {
		const params = new URLSearchParams(location.search)
		const stringLevelData = params.get("level")

		if (stringLevelData) {
			let levelData = decodeRawStringToArrayBuffer(
				// This is some weird "base64 url safe" data
				atob(stringLevelData.replace(/_/g, "/").replace(/-/g, "+"))
			)
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
			await (await fetch("./data/NotCC.c2m")).body?.getReader()?.read()
		)?.value?.buffer
		if (!levelData) console.log("Couldn't fetch default level")
		else startNewLevelSet(levelData, "NotCC.c2m")
	}
})()
