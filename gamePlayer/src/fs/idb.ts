import { os } from "@neutralinojs/lib"
import { UseStore, createStore, del, get, set, update } from "idb-keyval"
import { join, parse } from "path"

// Use an IndexedDB for the filesystem and <input type="file"/> for save/load prompts

const store = !globalThis.window
	? (null as unknown as UseStore)
	: createStore("notcc", "fs")

function normalizeRootPath(path: string): string {
	path = join("/", path)
	if (path.endsWith("/") && path !== "/") {
		path = path.slice(0, -1)
	}
	return path
}

async function assertValidPath(path: string): Promise<void> {
	const parsedPath = parse(path)
	const dir = await get<string[]>(parsedPath.dir, store)
	if (!dir)
		throw new Error(`failed to access ${path}, no ${parsedPath.dir} directory`)
}

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
	const dir = await get<string[]>(parsedPath.dir, store)
	if (!dir)
		throw new Error(`failed to remove ${path}, no ${parsedPath.dir} directory`)
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
	path = normalizeRootPath(path)
	await assertValidPath(path)
	const result = await get<ArrayBuffer>(path, store)
	if (!result) throw new Error(`${path}: no such file`)
	if (result instanceof Array) throw new Error(`${path}: is a directory`)
	return result
}

export async function writeFile(
	path: string,
	data: ArrayBufferLike
): Promise<void> {
	path = normalizeRootPath(path)
	await assertValidPath(path)
	if (await isDir(path)) throw new Error(`${path}: is a directory`)
	await addDirEnt(path)
	await set(path, data, store)
}

export async function remove(path: string): Promise<void> {
	path = join("/", path)
	await assertValidPath(path)
	await removeDirEnt(path)
	await del(path, store)
}

export async function isFile(path: string): Promise<boolean> {
	path = normalizeRootPath(path)
	await assertValidPath(path)
	const result = await get<ArrayBuffer>(path, store)
	return !!result && result instanceof ArrayBuffer
}

export async function readDir(path: string): Promise<string[]> {
	path = normalizeRootPath(path)
	await assertValidPath(path)
	const result = await get<string[]>(path, store)
	if (!result) throw new Error(`${path}: no such directory`)
	if (result instanceof ArrayBuffer) throw new Error(`${path}: is a file`)
	return result
}

export async function makeDir(path: string): Promise<void> {
	path = normalizeRootPath(path)
	if (await isFile(path)) throw new Error(`${path}: is a file`)
	if (await isDir(path)) return
	await addDirEnt(path)
	await set(path, [], store)
}

export async function isDir(path: string): Promise<boolean> {
	path = normalizeRootPath(path)
	await assertValidPath(path)
	const result = await get<string[]>(path, store)
	return !!result && result instanceof Array
}

export async function exists(path: string): Promise<boolean> {
	path = normalizeRootPath(path)
	const ent = await get<string[] | ArrayBuffer | undefined>(path, store)
	return ent !== undefined
}

async function moveInternal(source: string, dest: string) {
	if (await isFile(source)) {
		const content = await readFile(source)
		await remove(source)
		await writeFile(dest, content)
		return
	}
	await makeDir(dest)

	for (const item of await readDir(source)) {
		await moveInternal(join(source, item), join(dest, item))
	}

	await remove(source)
}

export async function move(source: string, dest: string): Promise<void> {
	source = normalizeRootPath(source)
	await assertValidPath(source)

	dest = normalizeRootPath(dest)
	const destParent = parse(dest).dir
	await assertValidPath(destParent)
	await moveInternal(source, dest)
}

export async function initFilesystem(): Promise<void> {
	if (!(await exists("/"))) {
		await set("/", [], store)
	}
}

function showInputPrompt(fileLoader: HTMLInputElement): Promise<File[] | null> {
	return new Promise(res => {
		fileLoader.addEventListener("change", () => {
			if (fileLoader.files === null || fileLoader.files.length === 0) {
				res(null)
			} else {
				res(Array.from(fileLoader.files))
			}
			fileLoader.remove()
		})
		fileLoader.click()
	})
}

export function showLoadPrompt(
	_title?: string,
	options?: os.OpenDialogOptions
): Promise<File[] | null> {
	const fileLoader = document.createElement("input")
	fileLoader.type = "file"
	if (options?.filters !== undefined) {
		fileLoader.accept = options.filters
			.reduce<string[]>((acc, ent) => acc.concat(ent.extensions), [])
			.map(ext => `.${ext}`)
			.join(",")
	}
	fileLoader.multiple = !!options?.multiSelections
	return showInputPrompt(fileLoader)
}

export function showDirectoryPrompt(
	_title?: string,
	_options?: os.FolderDialogOptions
): Promise<File[] | null> {
	const fileLoader = document.createElement("input")
	fileLoader.type = "file"
	fileLoader.webkitdirectory = true
	return showInputPrompt(fileLoader)
}

export function showSavePrompt(
	fileData: ArrayBuffer,
	_title?: string,
	options?: os.SaveDialogOptions
) {
	const blob = new Blob([fileData], { type: "application/octet-stream" })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	if (options?.defaultPath !== undefined) {
		anchor.download = parse(options.defaultPath).base
	}
	anchor.href = url
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(url)
}
