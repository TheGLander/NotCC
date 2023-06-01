import {
	findScriptName,
	parseScriptMetadata,
	ScriptMetadata,
} from "@notcc/logic"
import { basename, join } from "path-browserify"

const censoredSetNames: string[] = ["CC1STEAM", "steamcc1", "cc1cropped", "cc2"]

const listingRegex = /<a href="(?!\.\.\/")(.+)">.+<\/a>\s+(.+:..)/g
const gliderbotWebsite = "https://bitbusters.club/gliderbot/sets/cc2/"

export interface GliderbotSet {
	metadata: ScriptMetadata
	hasPreviewImage: boolean
	mainScript: string
	rootDirectory: string
	lastChanged: Date
}

function getMetadataPriority(set: GliderbotSet): number {
	let priority = 0
	if (set.metadata.listingPriority === "top") priority += 100
	if (set.metadata.listingPriority === "bottom") priority -= 100
	// Unlisted sets should be sorted out by getGbSets
	if (set.metadata.description !== undefined) priority += 2
	else if (set.hasPreviewImage) priority += 1
	return priority
}

export function metadataComparator(a: GliderbotSet, b: GliderbotSet): number {
	return getMetadataPriority(a) - getMetadataPriority(b)
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
		const metadata = parseScriptMetadata(scriptText)
		return {
			mainScript: file.name,
			metadata,
			rootDirectory: `${gliderbotWebsite}${dir.getPath()}/`,
			hasPreviewImage: "preview.png" in dir.contents,
			lastChanged: dir.lastEdited!,
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
		(set): set is GliderbotSet =>
			set !== null && set.metadata.listingPriority !== "unlisted"
	)
}
