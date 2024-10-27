import { isDesktop, zipAsync } from "@/helpers"
import { AsyncZippable } from "fflate"
import * as idbFs from "./idb"
import * as neuFs from "./neutralino"
import { join, normalize } from "path"

const exportMod = isDesktop() ? neuFs : idbFs

export const readFile = exportMod.readFile
export const writeFile = exportMod.writeFile
export const remove = exportMod.remove
export const makeDir = exportMod.makeDir
export const readDir = exportMod.readDir
export const isDir = exportMod.isDir
export const isFile = exportMod.isFile
export const showLoadPrompt = exportMod.showLoadPrompt
export const showDirectoryPrompt = exportMod.showDirectoryPrompt
export const showSavePrompt = exportMod.showSavePrompt
export const exists = exportMod.exists
export const move = exportMod.move

export async function readJson<T>(path: string): Promise<T> {
	const buf = await readFile(path)
	return JSON.parse(new TextDecoder("utf-8").decode(buf))
}
export async function writeJson<T>(path: string, val: T): Promise<void> {
	const buf = new TextEncoder().encode(JSON.stringify(val))
	return writeFile(path, buf)
}

export async function recusiveRemove(path: string): Promise<void> {
	if (await isFile(path)) {
		await remove(path)
		return
	}
	const dirEnts = await readDir(path)
	for (const dirEnt of dirEnts) {
		const entPath = join(path, dirEnt)
		if (await isDir(entPath)) {
			await recusiveRemove(entPath)
		} else {
			await remove(entPath)
		}
	}
	await remove(path)
}

async function buildFsTree(dir: string = "."): Promise<AsyncZippable> {
	const tree: AsyncZippable = {}
	for (const leaf of await readDir(dir)) {
		const leafPath = join(dir, leaf)
		if (await isFile(leafPath)) {
			tree[leaf] = new Uint8Array(await readFile(leafPath))
		} else {
			tree[leaf] = await buildFsTree(leafPath)
		}
	}
	return tree
}
export async function findAllFiles(
	dir: string,
	postfixPath = "."
): Promise<string[]> {
	const files: string[] = []
	for (const leaf of await readDir(join(dir, postfixPath))) {
		const leafPath = join(dir, postfixPath, leaf)
		if (await isFile(leafPath)) {
			files.push(join(postfixPath, leaf))
		} else {
			files.push(...(await findAllFiles(dir, leaf)))
		}
	}
	return files
}

export async function makeFsZip(): Promise<Uint8Array> {
	return await zipAsync(await buildFsTree())
}

export async function makeDirP(dir: string): Promise<void> {
	dir = normalize(dir)
	let fullPath = ""
	for (const dirPart of dir.split("/")) {
		fullPath += dirPart + "/"
		if (!(await exists(fullPath))) {
			await makeDir(fullPath)
		} else if (await isFile(fullPath)) {
			throw new Error(`Can't makeDirP in ${fullPath} - it's a file`)
		}
	}
}

export async function initNotCCFs(): Promise<void> {
	await exportMod.initFilesystem()
	await makeDir(".")
	await makeDir("solutions")
	await makeDir("solutions/default")
	await makeDir("routes")
	await makeDir("tilesets")
	await makeDir("sfx")
	await makeDir("sets")
	await makeDir("cache")
}
