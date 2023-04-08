import { LevelSetLoaderFunction } from "@notcc/logic"
import { AsyncUnzipOptions, Unzipped, unzip, unzipSync } from "fflate"
import { join, normalize } from "path-browserify"

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
		filter: zipInfo => zipInfo.name === fileName,
	})
	if (!unzipped[fileName])
		throw new Error(`No such file ${fileName} in the zip archive.`)
	return unzipped[fileName]
}

export function buildZipIndex(zipData: ArrayBuffer): string[] {
	const filePaths: string[] = []
	// Use the filter property to collect info about the files, but we don't care
	// about the contents, for now
	unzipSync(new Uint8Array(zipData), {
		filter: zipInfo => {
			filePaths.push(zipInfo.name)
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
		const fileData = await unzipFileAsync(zipData, path)
		if (binary) return fileData.buffer
		return decoder.decode(fileData)
	}
}

export function makeFileListFileLoader(
	fileList: FileList
): LevelSetLoaderFunction {
	// This is Latin-1
	const decoder = new TextDecoder("iso-8859-1")
	const files: Record<string, File> = {}
	for (const file of Array.from(fileList)) {
		files[file.webkitRelativePath ?? file.name] = file
	}
	return async (path: string, binary: boolean) => {
		const fileData = await files[path].arrayBuffer()
		if (binary) return fileData
		return decoder.decode(fileData)
	}
}

export function buildFileListIndex(fileList: FileList): string[] {
	return Array.from(fileList).map(file => file.webkitRelativePath ?? file.name)
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
