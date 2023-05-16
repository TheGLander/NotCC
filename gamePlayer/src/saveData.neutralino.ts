import { parseNCCS, protobuf, writeNCCS } from "@notcc/logic"
import { Settings } from "./settings"
import { ExternalTilesetMetadata } from "./tilesets"
import { filesystem, init as neuInit } from "@neutralinojs/lib"
import path from "path-browserify"
import { fetchImage, reencodeImage } from "./utils"
import { applicationConfigPath } from "./configPath"

/**
 * Uuugh, Neutralino depends on a couple of global variables prefixed with NL_
 * to be present to function. Problem is, the variables can only be gotten by
 * the server serving a __neutralino_globals.js file. We don't want it to be
 * served if it's is a web build, but there's no mechanism to include/exclude
 * script tags at build time. So, download the globals file, parse it for
 * global-ish statements, and add the globals manually instead. Epic hack.
 */
const globalVarRegex = /var (NL_\w+)=([^;]+);/g
async function loadNeuGlobalVariables(): Promise<void> {
	const globalsResponse = await fetch("__neutralino_globals.js")
	const globalsText = await globalsResponse.text()
	let match: RegExpExecArray | null
	while ((match = globalVarRegex.exec(globalsText))) {
		const key = match[1]
		const valString = match[2]
		// I don't want to build a JS parser here, so let's just eval it.
		const val = new Function(`return ${valString}`)()
		;(globalThis as any)[key] = val
	}
}

async function dirExists(path: string): Promise<boolean> {
	try {
		await filesystem.readDirectory(path)
	} catch (err) {
		return false
	}
	return true
}

async function getPath(pathName: string) {
	return path.join(await applicationConfigPath("NotCC"), pathName)
}

const SET_INFO_DIRECTORY = "solutions"
const SETTINGS_FILE = "settings.json"
const TILESETS_DIRECTORY = "tilesets"

async function assertDirExists(path: string): Promise<void> {
	const truePath = await getPath(path)
	if (!(await dirExists(truePath))) {
		await filesystem.createDirectory(truePath)
	}
}

export async function initSaveData(): Promise<void> {
	await loadNeuGlobalVariables()
	neuInit()
	await assertDirExists(".")
	await assertDirExists(SET_INFO_DIRECTORY)
	await assertDirExists(TILESETS_DIRECTORY)
}

export async function saveSetInfo(
	solution: protobuf.ISetInfo,
	fileName: string
): Promise<void> {
	await filesystem.writeBinaryFile(
		path.join(await getPath(SET_INFO_DIRECTORY), `${fileName}.nccs`),
		writeNCCS(solution)
	)
}

export async function loadSetInfo(
	fileName: string
): Promise<protobuf.ISetInfo> {
	return parseNCCS(
		await filesystem.readBinaryFile(
			path.join(await getPath(SET_INFO_DIRECTORY), `${fileName}.nccs`)
		)
	)
}

export async function saveSettings(settings: Settings): Promise<void> {
	await filesystem.writeFile(
		await getPath(SETTINGS_FILE),
		JSON.stringify(settings)
	)
}

export async function loadSettings(): Promise<Settings> {
	return JSON.parse(await filesystem.readFile(await getPath(SETTINGS_FILE)))
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
	return new Promise((res, rej) => {
		canvas.toBlob(blob => {
			if (blob === null) {
				rej(new Error("Failed to create a blob from a canvas"))
				return
			}
			res(blob)
		}, type)
	})
}
async function bufferToCanvas(
	buffer: ArrayBuffer,
	type: string
): Promise<HTMLCanvasElement> {
	const blob = new Blob([buffer], { type })
	const objectUrl = URL.createObjectURL(blob)
	return reencodeImage(await fetchImage(objectUrl))
}

export async function saveTileset(
	tileset: ExternalTilesetMetadata
): Promise<void> {
	const tilesetsDir = await getPath(TILESETS_DIRECTORY)
	const image = await canvasToBlob(tileset.image, "image/png")
	await filesystem.writeBinaryFile(
		path.join(tilesetsDir, `${tileset.identifier}.png`),
		await image.arrayBuffer()
	)
	await filesystem.writeFile(
		path.join(tilesetsDir, `${tileset.identifier}.json`),
		JSON.stringify(tileset, (key, val) => (key === "image" ? undefined : val))
	)
}

export async function loadTileset(
	identifier: string
): Promise<ExternalTilesetMetadata> {
	const tilesetsDir = await getPath(TILESETS_DIRECTORY)
	const metadata: ExternalTilesetMetadata = JSON.parse(
		await filesystem.readFile(path.join(tilesetsDir, `${identifier}.json`))
	)
	// The `metadata.image` is currently undefined, so actually load the
	// extraneous image file
	const image = await bufferToCanvas(
		await filesystem.readBinaryFile(
			path.join(tilesetsDir, `${identifier}.png`)
		),
		"image/png"
	)
	metadata.image = image

	return metadata
}

export async function loadAllTilesets(): Promise<ExternalTilesetMetadata[]> {
	const tilesetsDir = await getPath(TILESETS_DIRECTORY)
	const tsets: ExternalTilesetMetadata[] = []
	for (const record of await filesystem.readDirectory(tilesetsDir)) {
		if (record.type === "DIRECTORY") continue
		if (!record.entry.endsWith(".json")) continue
		const tset = await loadTileset(record.entry.slice(0, -5))
		tsets.push(tset)
	}
	return tsets
}

export async function removeTileset(identifier: string): Promise<void> {
	const tilesetsDir = await getPath(TILESETS_DIRECTORY)
	await filesystem.removeFile(path.join(tilesetsDir, `${identifier}.json`))
	await filesystem.removeFile(path.join(tilesetsDir, `${identifier}.png`))
}
