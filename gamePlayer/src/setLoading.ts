import { LevelSetLoaderFunction, findScriptName } from "@notcc/logic"
import { AsyncUnzipOptions, Unzipped, unzip, unzipSync } from "fflate"
import { join, normalize } from "path-browserify"

function getFilePath(file: File): string {
	return file.webkitRelativePath ?? file.name
}

function unzipAsync(
	zipData: ArrayBuffer,
	options?: AsyncUnzipOptions
): Promise<Unzipped> {
	return new Promise((res, rej) => {
		unzip(new Uint8Array(zipData), options ?? {}, (err, data) => {
			if (err) {
				rej(err)
			} else {
				res(data)
			}
		})
	})
}

async function unzipFileAsync(
	zipData: ArrayBuffer,
	fileName: string
): Promise<Uint8Array> {
	const unzipped = await unzipAsync(zipData, {
		filter: zipInfo => zipInfo.name.toLowerCase() === fileName.toLowerCase(),
	})
	const unzippedData = Object.values(unzipped)
	if (unzippedData.length < 1)
		throw new Error(`No such file ${fileName} in the zip archive.`)
	return unzippedData[0]
}

export function buildZipIndex(zipData: ArrayBuffer): string[] {
	const filePaths: string[] = []
	// Use the filter property to collect info about the files, but we don't care
	// about the contents, for now
	unzipSync(new Uint8Array(zipData), {
		filter: zipInfo => {
			filePaths.push(zipInfo.name.toLowerCase())
			return false
		},
	})
	return filePaths
}

export function makeZipFileLoader(
	zipData: ArrayBuffer
): LevelSetLoaderFunction {
	// This is Latin-1
	const decoder = new TextDecoder("iso-8859-1")
	return async (path: string, binary: boolean) => {
		const fileData = await unzipFileAsync(zipData, path.toLowerCase())
		if (binary) return fileData.buffer
		return decoder.decode(fileData)
	}
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
	return async (path: string, binary: boolean) => {
		const fileData = await files[path.toLowerCase()].arrayBuffer()
		if (binary) return fileData
		return decoder.decode(fileData)
	}
}

export function makeHttpFileLoader(url: string): LevelSetLoaderFunction {
	return async (path: string, binary: boolean) => {
		const fileData = await fetch(`${url}${path}`)
		if (!fileData.ok)
			throw new Error(
				`Could not load ${path}: ${fileData.status} ${
					fileData.statusText
				}, ${await fileData.text()}`
			)
		if (binary) return await fileData.arrayBuffer()
		return await fileData.text()
	}
}

export function buildFileListIndex(fileList: File[]): string[] {
	return fileList.map(file => getFilePath(file))
}

export function makeLoaderWithPrefix(
	prefix: string,
	loader: LevelSetLoaderFunction
): LevelSetLoaderFunction {
	return (path: string, binary: boolean) => {
		const joinedPath = normalize(join(prefix, path))
		return loader(joinedPath, binary)
	}
}

export interface LevelSetData {
	loaderFunction: LevelSetLoaderFunction
	scriptFile: string
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
			"This ZIP archive doesn't contain a script. Are you sure this is the correct file?"
		)
	return { loaderFunction, scriptFile: c2gFiles[0].path }
}

export async function makeSetDataFromFiles(
	files: File[]
): Promise<LevelSetData> {
	const loaderFunction = makeFileListFileLoader(files)
	const fileIndex = buildFileListIndex(files)
	return findEntryFilePath(loaderFunction, fileIndex)
}

export interface ImportantSetInfo {
	setIdent: string
	setName: string
}
export const IMPORTANT_SETS: ImportantSetInfo[] = [
	{ setIdent: "cc1", setName: "Chips Challenge" },
	{ setIdent: "cc2", setName: "Chips Challenge 2" },
	{ setIdent: "cc2lp1", setName: "Chips Challenge 2 Level Pack 1" },
]
