import { isDesktop, zipAsync } from "@/helpers"
import { AsyncZippable } from "fflate"
import * as idbFs from "./idb"
import * as neuFs from "./neutralino"
import { join } from "path"

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

export async function recusiveRemove(path: string): Promise<void> {
	const dirEnts = await readDir(path)
	for (const dirEnt of dirEnts) {
		if (await isDir(dirEnt)) {
			await recusiveRemove(dirEnt)
		} else {
			await remove(dirEnt)
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

export async function makeFsZip(): Promise<Uint8Array> {
	return await zipAsync(await buildFsTree())
}

export async function initNotCCFs(): Promise<void> {
	await exportMod.initFilesystem()
	await makeDir(".")
	await makeDir("solutions")
	await makeDir("solutions/default")
	await makeDir("routes")
	await makeDir("tilesets")
	await makeDir("sfx")
}
