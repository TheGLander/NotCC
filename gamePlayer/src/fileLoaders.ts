import { LevelSetLoaderFunction } from "@notcc/logic"
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
