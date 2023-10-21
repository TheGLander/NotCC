import {
	findScriptName,
	LevelSetLoaderFunction,
	parseScriptMetadata,
	ScriptMetadata,
} from "@notcc/logic"
import { basename, join } from "path-browserify"
import { makeHttpFileLoader } from "./fileLoaders"

const censoredSetNames: string[] = ["CC1STEAM", "steamcc1", "cc1cropped", "cc2"]

// Some important sets (CC2LP1, CCLP ports) don't have set metadata as of writing,
// so inject our own metadata to put them near the top
const subsituteSetMetadata: Record<string, ScriptMetadata> = {
	cc2lp1: {
		title: "Chips Challenge 2 Level Pack 1",
		by: "The Community",
		description:
			"Chip's Challenge 2 Level Pack 1 is the first community level pack for Chip's Challenge 2. It contains 200 levels created by and voted on by fans. Read about it at https://bitbusters.club/cc2lp1",
		difficulty: 4,
		listingPriority: "top",
	},
	"cclp1-cc2": {
		title: "Chips Challenge Level Pack 1 (Steam)",
		by: "The Community",
		difficulty: 3,
		description:
			"Chip's Challenge Level Pack 1 is a beginner-friendly level pack for Chip's Challenge. This is the port of CCLP1 to the Steam ruleset. May be incomplete.",
		listingPriority: "top",
	},
	"CCLP4-CC2": {
		title: "Chips Challenge Level Pack 4 (Steam)",
		by: "The Community",
		difficulty: 4,
		description:
			"Chip's Challenge Level Pack 4 is the community's fourth level pack for Chip's Challenge. This is the port of CCLP4 to the Steam ruleset. May be incomplete.",
		listingPriority: "top",
	},
}

const listingRegex = /<a href="(?!\.\.\/")(.+)">.+<\/a>\s+(.+:..)/g
const gliderbotWebsite = "https://bitbusters.club/gliderbot/sets/cc2/"

export interface GliderbotSet {
	metadata: ScriptMetadata
	previewImage: string | null
	mainScript: string
	rootDirectory: string
	ident: string
	lastChanged: Date
	loaderFunction: LevelSetLoaderFunction
}

function getMetadataPriority(set: GliderbotSet): number {
	let priority = 0
	if (set.metadata.listingPriority === "top") priority += 100
	if (set.metadata.listingPriority === "bottom") priority -= 100
	// Unlisted sets should be sorted out by getGbSets
	if (set.metadata.description !== undefined) priority += 2
	else if (set.previewImage !== null) priority += 1
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
	findNode(pathStr: string): NginxNode {
		const parsedPath = /^(.+)\/(.*)/.exec(pathStr)
		const dirName = parsedPath?.[1] ?? null
		const nodeName = parsedPath?.[2] ?? pathStr
		if (dirName === null || dirName[1] === ".") {
			const node = this.contents[nodeName.toLowerCase()]
			if (node === undefined)
				throw new Error(
					`No such file or directory ${nodeName} in ${this.getPath()}`
				)
			// We're looking for a node in this directory
			return node
		}
		const node = this.contents[`${dirName.toLowerCase()}/`]
		if (node === undefined)
			throw new Error(`No such directory ${dirName} in ${this.getPath()}`)
		if (!(node instanceof NginxDirectory))
			throw new Error(`${dirName} in ${this.getPath()} is not a directory.`)
		return node.findNode(nodeName)
	}
}

export function makeNginxHttpFileLoader(
	url: string,
	dir: NginxDirectory
): LevelSetLoaderFunction {
	const httpLoader = makeHttpFileLoader(url)
	return (path: string, binary: boolean) => {
		// Note that `path` and `node.getPath()` won't always be the same - `path` might have the wrong casitivy
		// `findNode` correctly resolves it, and so `node.getPath()` will always have the correct casitivy
		const node = dir.findNode(path)
		const correctPath = node.getPath()
		return httpLoader(correctPath, binary)
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
		const entryName = decodeURIComponent(match[1])
		const lastEdited = new Date(match[2])
		if (entryName.endsWith("/")) {
			if (censoredSetNames.includes(entryName.slice(0, -1))) continue
			// This is a directory
			childPromises.push(
				scanNginxIndex(entryName, directory).then(ent => {
					ent.lastEdited = lastEdited
					directory.contents[entryName.toLowerCase()] = ent
				})
			)
		} else {
			const file = new NginxFile(directory, entryName)
			file.lastEdited = lastEdited
			directory.contents[entryName.toLowerCase()] = file
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
		const metadata =
			subsituteSetMetadata[dir.name] ?? parseScriptMetadata(scriptText)
		return {
			mainScript: file.name,
			metadata,
			previewImage:
				"preview.png" in dir.contents ? dir.contents["preview.png"].name : null,
			lastChanged: dir.lastEdited!,
			rootDirectory: `${gliderbotWebsite}${dir.getPath()}/`,
			ident: dir.name,
			loaderFunction: makeNginxHttpFileLoader(gliderbotWebsite, dir),
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

export async function lookupGbSet(name: string): Promise<GliderbotSet | null> {
	if (censoredSetNames.includes(name)) return null
	const localIndex = await scanNginxIndex(name)
	return await findGbSet(localIndex)
}
