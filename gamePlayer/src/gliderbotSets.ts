import { findScriptName } from "@notcc/logic"
import { basename, join } from "path-browserify"

const censoredSetNames: string[] = ["CC1STEAM", "steamcc1", "cc1cropped", "cc2"]

const listingRegex = /<a href="(?!\.\.\/")(.+)">.+<\/a>\s+(.+:..)/g
const gliderbotWebsite = "https://bitbusters.club/gliderbot/sets/cc2/"

export interface GliderbotSet {
	title: string
	mainScript: string
	rootDirectory: string
}

class NginxNode {
	lastEdited?: Date
	constructor(
		public parent: NginxDirectory | null = null,
		public name: string
	) {}
	getPath(): string {
		if (!this.parent) return this.name
		return join(this.parent.getPath(), this.name)
	}
}

class NginxFile extends NginxNode {
	async download(binary: false): Promise<string>
	async download(binary: true): Promise<ArrayBuffer>
	async download(binary: boolean): Promise<string | ArrayBuffer> {
		const fileRes = await fetch(`${gliderbotWebsite}/${this.getPath()}`)
		if (binary) {
			return await fileRes.arrayBuffer()
		} else {
			return await fileRes.text()
		}
	}
}

class NginxDirectory extends NginxNode {
	constructor(
		parent: NginxDirectory | null,
		name: string,
		public contents: Record<string, NginxNode> = {}
	) {
		super(parent, name)
	}
}

async function scanNginxIndex(
	dirPath: string,
	parent?: NginxDirectory
): Promise<NginxDirectory> {
	const indexRes = await fetch(
		`${gliderbotWebsite}/${parent ? join(parent.getPath(), dirPath) : dirPath}`
	)
	if (!indexRes.ok) throw new Error(indexRes.statusText)
	const pageData = await indexRes.text()
	const directory = new NginxDirectory(parent ?? null, basename(dirPath))
	const childPromises: Promise<void>[] = []
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const match = listingRegex.exec(pageData)
		if (!match) break
		const entryName = match[1]
		const lastEdited = new Date(match[2])
		if (entryName.endsWith("/")) {
			if (censoredSetNames.includes(entryName.slice(0, -1))) continue
			// This is a directory
			childPromises.push(
				scanNginxIndex(entryName, directory).then(ent => {
					ent.lastEdited = lastEdited
					directory.contents[entryName] = ent
				})
			)
		} else {
			const file = new NginxFile(directory, entryName)
			file.lastEdited = lastEdited
			directory.contents[entryName] = file
		}
	}
	await Promise.all(childPromises)
	return directory
}

async function findGbSet(dir: NginxDirectory): Promise<GliderbotSet | null> {
	for (const file of Object.values(dir.contents)) {
		if (!(file instanceof NginxFile)) continue
		if (!file.name.endsWith(".c2g")) continue
		const scriptText = await file.download(false)
		const scriptTitle = findScriptName(scriptText)
		// A c2g file without a title. Could possibly be a `chain`-able helper script
		if (!scriptTitle) continue
		return {
			mainScript: file.name,
			title: scriptTitle,
			rootDirectory: `${gliderbotWebsite}${dir.getPath()}/`,
		}
	}
	return null
}

export async function getGbSets(): Promise<GliderbotSet[]> {
	const rootIndex = await scanNginxIndex(".")
	const setPromises: Promise<GliderbotSet | null>[] = []
	for (const setDir of Object.values(rootIndex.contents)) {
		if (!(setDir instanceof NginxDirectory)) continue
		setPromises.push(findGbSet(setDir))
	}
	return (await Promise.all(setPromises)).filter(
		(set): set is GliderbotSet => set !== null
	)
}
