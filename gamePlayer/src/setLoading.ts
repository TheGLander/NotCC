import {
	LevelSetData,
	LevelSetLoaderFunction,
	findScriptName,
} from "@notcc/logic"
import { Unzipped } from "fflate"
import { join, normalize } from "path-browserify"
import { CaseResolver, findAllFiles, readFile } from "./fs"
import { unzipAsync } from "./helpers"

function getFilePath(file: File): string {
	return file.webkitRelativePath ?? file.name
}

export function makeBufferMapFileLoader(
	zipFiles: Unzipped
): LevelSetLoaderFunction {
	const zipFilesLowercase = Object.fromEntries(
		Object.entries(zipFiles).map(([path, data]) => [path.toLowerCase(), data])
	)

	// This is Latin-1
	const decoder = new TextDecoder("iso-8859-1")
	return (async (path: string, binary: boolean) => {
		const fileData = zipFilesLowercase[path.toLowerCase()]
		if (!fileData) throw new Error(`File ${path} not found`)
		if (binary) return fileData.buffer
		return decoder.decode(fileData)
	}) as LevelSetLoaderFunction
}

export async function makeSetDataFromZip(
	zipData: ArrayBuffer
): Promise<LevelSetData> {
	const zipFiles = await unzipAsync(zipData)
	const loaderFunction = makeBufferMapFileLoader(zipFiles)
	return findEntryFilePath(loaderFunction, Object.keys(zipFiles))
}

export function makeFileListFileLoader(
	fileList: File[]
): LevelSetLoaderFunction {
	// This is Latin-1
	const decoder = new TextDecoder("iso-8859-1")
	const files: Record<string, File> = {}
	for (const file of fileList) {
		files[getFilePath(file).toLowerCase()] = file
	}
	return (async (path: string, binary: boolean) => {
		const fileData = await files[path.toLowerCase()].arrayBuffer()
		if (binary) return fileData
		return decoder.decode(fileData)
	}) as LevelSetLoaderFunction
}

export async function makeBufferMapFromFileList(
	fileList: File[]
): Promise<Unzipped> {
	return Object.fromEntries(
		await Promise.all(
			fileList.map<Promise<[string, Uint8Array]>>(async file => [
				getFilePath(file).toLowerCase(),
				new Uint8Array(await file.arrayBuffer()),
			])
		)
	)
}

export function makeHttpFileLoader(url: string): LevelSetLoaderFunction {
	return (async (path: string, binary: boolean) => {
		const fileData = await fetch(`${url}${path}`)
		if (!fileData.ok)
			throw new Error(
				`Could not load ${path}: ${fileData.status} ${
					fileData.statusText
				}, ${await fileData.text()}`
			)
		if (binary) return await fileData.arrayBuffer()
		return await fileData.text()
	}) as LevelSetLoaderFunction
}

export function buildFileListIndex(fileList: File[]): string[] {
	return fileList.map(file => getFilePath(file))
}

export function makeLoaderWithPrefix(
	prefix: string,
	loader: LevelSetLoaderFunction
): LevelSetLoaderFunction {
	return ((path: string, binary: boolean) => {
		const joinedPath = normalize(join(prefix, path))
		return loader(joinedPath, binary)
	}) as LevelSetLoaderFunction
}

interface DirEntry {
	path: string
	data: string
}

export async function findEntryFilePath(
	loaderFunction: LevelSetLoaderFunction,
	fileIndex: string[]
): Promise<LevelSetData> {
	// Use `loaderFunction` and `rootIndex` to figure out which files are entry
	// scripts (have the header closed string)
	const c2gFileNames = fileIndex.filter(path => path.endsWith(".c2g"))
	const c2gDirEntPromises = c2gFileNames.map<Promise<DirEntry>>(async path => {
		const scriptData = (await loaderFunction(path, false)) as string
		return { path, data: scriptData }
	})
	const maybeC2gFiles = await Promise.all(c2gDirEntPromises)
	const c2gFiles = maybeC2gFiles.filter(
		ent => findScriptName(ent.data) !== null
	)

	if (c2gFiles.length > 1) {
		c2gFiles.sort((a, b) => a.path.length - b.path.length)

		console.warn(
			"There appear to be multiple entry script files. Picking the one with the shortest path..."
		)
	}
	if (c2gFiles.length < 1)
		throw new Error(
			`Given file source doesn't appear to contain a main script, searched through these files: ${fileIndex.join(", ")}`
		)
	return { loaderFunction, scriptFile: c2gFiles[0].path }
}

export function makeFsFileLoader(basePath: string): LevelSetLoaderFunction {
	const decoder = new TextDecoder("utf-8")
	const caseResolver = new CaseResolver()
	return (async (path: string, binary: boolean) => {
		const data = await readFile(
			await caseResolver.resolve(join(basePath, normalize("/" + path)))
		)
		return binary ? data : decoder.decode(data)
	}) as LevelSetLoaderFunction
}

export async function makeSetDataFromFsPath(
	basePath: string
): Promise<LevelSetData> {
	return findEntryFilePath(
		makeFsFileLoader(basePath),
		await findAllFiles(basePath)
	)
}

export interface ImportantSetInfo {
	setIdent: string
	setName: string
	acquireInfo?: { url: string; term: string }
}
export const IMPORTANT_SETS: ImportantSetInfo[] = [
	{
		setIdent: "cc1",
		setName: "Chips Challenge",
		acquireInfo: {
			url: "https://store.steampowered.com/app/346850/Chips_Challenge_1",
			term: "download it for free from",
		},
	},
	{
		setIdent: "cc2",
		setName: "Chips Challenge 2",
		acquireInfo: {
			url: "https://store.steampowered.com/app/348300/Chips_Challenge_2",
			term: "buy it on",
		},
	},
	{
		setIdent: "cc2lp1",
		setName: "Chips Challenge 2 Level Pack 1",
	},
]
