import { protobuf } from "@notcc/logic"
import { compressToUTF16, decompressFromUTF16 } from "lz-string"
import { Settings } from "./settings"
import { ExternalTilesetMetadata } from "./tilesets"
import { fetchImage, reencodeImage } from "./utils"
import type { os } from "@neutralinojs/lib"

function makeFilePrefix(type: string) {
	return `NotCC ${type}`
}

const base64EncodedUI8Prefix = "\x7F\x00B64\x00\x7F"
const uriImagePrefix = "\x7F\x00URIIMG\x00\x7F"

function encodeBinaryBase64(bin: Uint8Array): string {
	return btoa(String.fromCharCode.apply(null, Array.from(bin)))
}

function decodeBinaryBase64(b64: string): Uint8Array {
	return Uint8Array.from(atob(b64), char => char.charCodeAt(0))
}

function jsonStringifyExtended(data: any): string {
	return JSON.stringify(data, (_key, val) => {
		if (val instanceof Uint8Array) {
			return `${base64EncodedUI8Prefix}${encodeBinaryBase64(val)}`
		}
		if (val instanceof HTMLImageElement) {
			// Re-encode the image to also be saved
			val = reencodeImage(val)
		}
		if (val instanceof HTMLCanvasElement) {
			return `${uriImagePrefix}${val.toDataURL()}`
		}
		return val
	})
}

async function walkObjectAsync(
	obj: object,
	transform: (val: any) => Promise<any>
): Promise<object> {
	if (Array.isArray(obj)) {
		return Promise.all(obj.map(item => walkObjectAsync(item, transform)))
	}
	if (typeof obj === "object" && obj !== null) {
		const newObj: any = {}
		for (const [key, val] of Object.entries(obj)) {
			newObj[key] = await walkObjectAsync(val, transform)
		}
		return newObj
	}
	return transform(obj)
}

function jsonParseExtended(data: string): Promise<any> {
	const vanillaData = JSON.parse(data)
	return walkObjectAsync(vanillaData, async val => {
		if (typeof val === "string") {
			if (val.startsWith(base64EncodedUI8Prefix)) {
				return decodeBinaryBase64(val.slice(base64EncodedUI8Prefix.length))
			}
			if (val.startsWith(uriImagePrefix)) {
				return await fetchImage(val.slice(uriImagePrefix.length))
			}
		}
		return val
	})
}

export function initSaveData(): Promise<void> {
	return Promise.resolve()
}

export async function saveSetInfo(
	solution: protobuf.ISetInfo,
	fileName: string
): Promise<void> {
	localStorage.setItem(
		`${makeFilePrefix("solution")}: ${fileName}`,
		compressToUTF16(jsonStringifyExtended(solution))
	)
}

export async function loadSetInfo(
	fileName: string
): Promise<protobuf.ISetInfo> {
	const compressedData = localStorage.getItem(
		`${makeFilePrefix("solution")}: ${fileName}`
	)
	if (!compressedData) throw new Error(`File not fould: ${fileName}`)
	return await jsonParseExtended(decompressFromUTF16(compressedData))
}

export async function saveSettings(settings: Settings): Promise<void> {
	localStorage.setItem(makeFilePrefix("settings"), JSON.stringify(settings))
}

export async function loadSettings(): Promise<Settings> {
	const settings = localStorage.getItem(makeFilePrefix("settings"))
	if (!settings) throw new Error("Settings file not found")
	return JSON.parse(settings)
}

export async function saveTileset(
	tileset: ExternalTilesetMetadata
): Promise<void> {
	localStorage.setItem(
		`${makeFilePrefix("tileset")}: ${tileset.identifier}`,
		jsonStringifyExtended(tileset)
	)
}

export async function loadTileset(
	identifier: string
): Promise<ExternalTilesetMetadata> {
	const tilesetData = localStorage.getItem(
		`${makeFilePrefix("tileset")}: ${identifier}`
	)
	if (tilesetData === null) throw new Error("Tileset not found")

	const data: ExternalTilesetMetadata = await jsonParseExtended(tilesetData)
	if ("imageData" in data) {
		// We moved keys, so update legacy tilesets
		data.image = reencodeImage(await fetchImage(data.imageData as string))
	}
	return data
}

export async function loadAllTilesets(): Promise<ExternalTilesetMetadata[]> {
	const tsets: ExternalTilesetMetadata[] = []
	for (const recordName in localStorage) {
		const tsetPrefix = `${makeFilePrefix("tileset")}: `
		if (!recordName.startsWith(tsetPrefix)) continue
		const tset = await loadTileset(recordName.slice(tsetPrefix.length))
		tsets.push(tset)
	}
	return tsets
}

export async function removeTileset(identifier: string): Promise<void> {
	const deleteSuccess =
		delete localStorage[`${makeFilePrefix("tileset")}: ${identifier}`]
	if (!deleteSuccess) throw new Error("Couldn't delete file.")
}

export async function showLoadPrompt(
	_title?: string,
	options?: os.OpenDialogOptions
): Promise<File[]> {
	const fileLoader = document.createElement("input")
	fileLoader.type = "file"
	if (options?.filters !== undefined) {
		fileLoader.accept = options.filters
			.map(filter => filter.extensions.map(ext => `.${ext}`).join(","))
			.join(",")
	}
	fileLoader.multiple = !!options?.multiSelections
	return new Promise((res, rej) => {
		fileLoader.addEventListener("change", () => {
			if (fileLoader.files === null || fileLoader.files.length === 0) {
				rej(new Error("No files specified"))
			} else {
				res(Array.from(fileLoader.files))
			}
			fileLoader.remove()
		})
		fileLoader.click()
	})
}

export async function showDirectoryPrompt(): Promise<File[]> {
	const fileLoader = document.createElement("input")
	fileLoader.type = "file"
	fileLoader.webkitdirectory = true
	return new Promise((res, rej) => {
		fileLoader.addEventListener("change", () => {
			if (fileLoader.files === null || fileLoader.files.length === 0) {
				rej(new Error("No directory specified"))
			} else {
				res(Array.from(fileLoader.files))
			}
			fileLoader.remove()
		})
		fileLoader.click()
	})
}
