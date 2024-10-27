import { filesystem, init as neuInit, os } from "@neutralinojs/lib"
import { basename, join, parse } from "path"
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
	if (!globalsResponse.ok)
		throw new Error("Failed to download Neutralino global variables")
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
	return join(await applicationConfigPath("NotCC"), pathName)
}

export async function initFilesystem(): Promise<void> {
	await loadNeuGlobalVariables()
	neuInit()
}

export async function readFile(path: string): Promise<ArrayBuffer> {
	return await filesystem.readBinaryFile(await getPath(path))
}

export async function writeFile(
	path: string,
	data: ArrayBuffer
): Promise<void> {
	await filesystem.writeBinaryFile(await getPath(path), data)
}

export async function remove(path: string): Promise<void> {
	await filesystem.remove(await getPath(path))
}

export async function makeDir(path: string): Promise<void> {
	const truePath = await getPath(path)
	if (!(await dirExists(truePath))) {
		await filesystem.createDirectory(truePath)
	}
}

export async function isDir(path: string): Promise<boolean> {
	const truePath = await getPath(path)
	const stat = await filesystem.getStats(truePath)
	return stat.isDirectory
}

export async function isFile(path: string): Promise<boolean> {
	const truePath = await getPath(path)
	const stat = await filesystem.getStats(truePath)
	return stat.isFile
}

export async function readDir(path: string): Promise<string[]> {
	const ents = await filesystem.readDirectory(await getPath(path))
	return ents.map(ent => ent.entry).filter(ent => ent !== "." && ent !== "..")
}

export async function exists(path: string): Promise<boolean> {
	const truePath = await getPath(path)
	return await filesystem
		.getStats(truePath)
		.then(() => true)
		.catch(err => err.code !== "NE_FS_NOPATHE")
}

export async function move(source: string, dest: string): Promise<void> {
	await filesystem.move(await getPath(source), await getPath(dest))
}

export async function showLoadPrompt(
	title?: string,
	options?: os.OpenDialogOptions
): Promise<File[] | null> {
	const fileNames = await os.showOpenDialog(title, options)
	if (fileNames.length === 0) return null
	const files: File[] = []
	for (const fileName of fileNames) {
		const stat = await filesystem.getStats(fileName)
		const bin = await filesystem.readBinaryFile(fileName)
		files.push(
			new File([bin], basename(fileName), {
				lastModified: stat.modifiedAt,
			})
		)
	}
	return files
}

async function scanDirectory(dirPath: string, prefix: string): Promise<File[]> {
	const entries = await filesystem.readDirectory(dirPath)
	const files: File[] = []
	for (const ent of entries) {
		if (ent.entry === "." || ent.entry === "..") continue
		const filePath = join(dirPath, ent.entry)
		const prefixPath = join(prefix, ent.entry)
		if (ent.type === "FILE") {
			const stat = await filesystem.getStats(filePath)
			const bin = await filesystem.readBinaryFile(filePath)
			const file = new File([bin], ent.entry, { lastModified: stat.modifiedAt })
			// Define the property explicitly on the `file`, since the underlying `File.prototype.webkitRelativePath`
			// getter (which assigning with `=` uses) doesn't allow writing. ugh
			Object.defineProperty(file, "webkitRelativePath", { value: prefixPath })
			files.push(file)
		} else {
			files.push(...(await scanDirectory(filePath, prefixPath)))
		}
	}
	return files
}

export async function showDirectoryPrompt(
	title?: string,
	options?: os.FolderDialogOptions
): Promise<File[] | null> {
	const dirName = await os.showFolderDialog(title, options)
	if (dirName === "") return null
	return await scanDirectory(dirName, parse(dirName).base)
}

export async function showSavePrompt(
	fileData: ArrayBuffer,
	title?: string,
	options?: os.SaveDialogOptions
): Promise<boolean> {
	const savePath = await os.showSaveDialog(title, options)
	if (savePath === "") return false
	await filesystem.writeBinaryFile(savePath, fileData)
	return true
}
