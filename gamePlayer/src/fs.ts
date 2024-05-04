import { AsyncZippable } from "fflate"
import { UseStore, createStore, del, get, set, update } from "idb-keyval"
import { join, parse } from "path"
import { zipAsync } from "./helpers"

const store = !globalThis.window
	? (null as unknown as UseStore)
	: createStore("notcc", "fs")

async function addDirEnt(path: string): Promise<void> {
	const parsedPath = parse(path)
	if (parsedPath.base === "") return
	await update(
		parsedPath.dir,
		ents => {
			if (!ents.includes(parsedPath.base)) {
				ents.push(parsedPath.base)
			}
			return ents
		},
		store
	)
}

async function removeDirEnt(path: string): Promise<void> {
	const parsedPath = parse(path)
	await update(
		parsedPath.dir,
		ents => {
			if (ents.includes(parsedPath.base)) {
				ents.splice(ents.indexOf(parsedPath.base), 1)
			}
			return ents
		},
		store
	)
}

export async function readFile(path: string): Promise<ArrayBuffer> {
	path = join("/", path)
	const result = await get<ArrayBuffer>(path, store)
	if (!result) throw new Error(`${path}: no such file`)
	return result
}

export async function writeFile(
	path: string,
	data: ArrayBuffer
): Promise<void> {
	path = join("/", path)
	await addDirEnt(path)
	await set(path, data, store)
}

export async function remove(path: string): Promise<void> {
	path = join("/", path)
	await removeDirEnt(path)
	await del(path, store)
}

export async function isFile(path: string): Promise<boolean> {
	path = join("/", path)
	const result = await get<ArrayBuffer>(path, store)
	return !!result && result instanceof ArrayBuffer
}

export async function readDir(path: string): Promise<string[]> {
	path = join("/", path)
	const result = await get<string[]>(path, store)
	if (!result) throw new Error(`${path}: no such directory`)
	return result
}

export async function makeDir(path: string): Promise<void> {
	path = join("/", path)
	if (await isDir(path)) return
	await addDirEnt(path)
	await set(path, [], store)
}

export async function recusiveRemove(path: string): Promise<void> {
	path = join("/", path)
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

export async function isDir(path: string): Promise<boolean> {
	path = join("/", path)
	const result = await get<string[]>(path, store)
	return !!result && result instanceof Array
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
	await makeDir(".")
	await makeDir("solutions")
	await makeDir("solutions/default")
	await makeDir("tilesets")
	await makeDir("sfx")
}
