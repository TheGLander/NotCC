import { Getter, Setter, atom } from "jotai"
import {
	IMPORTANT_SETS,
	LevelSetData,
	makeSetDataFromFsPath,
	makeSetDataFromZip,
} from "./setLoading"
import {
	exists,
	isDir,
	isFile,
	makeDirP,
	move,
	readDir,
	readFile,
	readJson,
	recusiveRemove,
	writeFile,
	writeJson,
} from "./fs"
import {
	BBClubSet,
	BBClubSetsRepository,
	BB_CLUB_SETS_URL,
	getBBClubSetUpdated,
} from "./setsApi"
import { ScriptMetadata, parseScriptMetadata } from "@notcc/logic"
import {
	join as joinPath,
	normalize as normalizePath,
	parse as parsePath,
} from "path"
import { PromptComponent, showPromptGs } from "./prompts"
import { Dialog } from "./components/Dialog"
import { Expl } from "./components/Expl"
import { aiFilter, aiGather } from "./helpers"
import { useMemo } from "preact/hooks"

export interface LocalBBClubLinkData {
	setIdent: string
	id: number
	/**
	 * A Unix timestamp
	 */
	lastUpdated: number
}

interface BBClubSetData {
	set: BBClubSet
	repo: BBClubSetsRepository
}

interface BuiltinSetData {
	link: string
	name: string
}
interface LocalSetData {
	loadData: () => Promise<LevelSetData>
	path: string
}

export interface ItemLevelSet {
	setName: string
	setIdent: string
	setKey: string
	bbClubSet?: BBClubSetData
	localSet?: LocalSetData
	localBBClubSet?: LocalBBClubLinkData
	builtinSet?: BuiltinSetData
	// hidden: boolean
	// lastPlayed?: Date
}

export const localSetsChangedAtom = atom(Symbol())
export function announceLocalSetsChangedGs(_get: Getter, set: Setter) {
	set(localSetsChangedAtom, Symbol())
}

const BB_CLUB_SETS_LINK_FILE = "/sets/bb-club-sets.json"
type BbClubLinks = Record<string, LocalBBClubLinkData>

async function getLocalSetData(path: string): Promise<LevelSetData> {
	if (await isDir(path)) return makeSetDataFromFsPath(path)
	else if (path.endsWith(".zip"))
		return makeSetDataFromZip(await readFile(path))
	else {
		throw new Error("Can't load local set")
	}
}

export async function findLocalSet(
	setIdent: string
): Promise<ItemLevelSet | null> {
	const dirPath = joinPath("/sets", setIdent)
	const hasDir = (await exists(dirPath)) && (await isDir(dirPath))
	const zipPath = joinPath("/sets", `${setIdent}.zip`)
	const hasZip = (await exists(zipPath)) && (await isFile(zipPath))

	if (hasDir && hasZip)
		throw new Error(`Local set ${setIdent} has both a zip file and a directory`)
	else if (!hasDir && !hasZip) return null
	const setPath = hasDir ? dirPath : zipPath

	const setData = await getLocalSetData(setPath)

	const setMetadata = parseScriptMetadata(
		(await setData.loaderFunction(setData.scriptFile, false)) as string
	)
	return {
		setName: setMetadata.title,
		setIdent,
		setKey: `local-${setIdent}`,
		localSet: {
			path: setPath,
			loadData: () => getLocalSetData(setPath),
		},
	}
}

export async function removeLocalSet(
	set: ItemLevelSet,
	removeBbClubLink = true
): Promise<void> {
	if (!set.localSet) throw new Error("Cannot remove a non-local set!")
	if (removeBbClubLink && (await exists(BB_CLUB_SETS_LINK_FILE))) {
		const bbClubLinks: BbClubLinks = await readJson(BB_CLUB_SETS_LINK_FILE)
		delete bbClubLinks[set.setIdent]
		await writeJson(BB_CLUB_SETS_LINK_FILE, bbClubLinks)
	}
	await recusiveRemove(set.localSet.path)
}

export async function* findAllLocalSets(): AsyncIterableIterator<ItemLevelSet> {
	const bbClubSetLink: BbClubLinks = (await exists(BB_CLUB_SETS_LINK_FILE))
		? await readJson(BB_CLUB_SETS_LINK_FILE)
		: {}
	for (let dirEnt of await readDir("/sets")) {
		// The set ident won't have the zip extension
		if (dirEnt.endsWith(".zip")) dirEnt = dirEnt.slice(0, -4)

		const localSet = await findLocalSet(dirEnt)
		// If we can't find a set in that entry, it's probably not actually a set
		if (!localSet) continue

		const bbClubLink = bbClubSetLink[localSet.setIdent]
		if (bbClubLink) {
			localSet.localBBClubSet = bbClubLink
		}
		yield localSet
	}
}

async function saveBBClubSetLocally(
	set: ItemLevelSet,
	zip: ArrayBuffer
): Promise<void> {
	const bbclubSet = set.bbClubSet?.set
	if (!bbclubSet) throw new Error("Trying to save a non-bb.club set")
	const setPath = `/sets/${bbclubSet.pack_name}.zip`
	await writeFile(setPath, zip)
	let localBBClubSets: Record<string, LocalBBClubLinkData> = {}
	if (await exists(BB_CLUB_SETS_LINK_FILE)) {
		localBBClubSets = await readJson(BB_CLUB_SETS_LINK_FILE)
	}
	const localBBClubLink: LocalBBClubLinkData = {
		id: bbclubSet.id,
		setIdent: bbclubSet.pack_name,
		lastUpdated: getBBClubSetUpdated(bbclubSet).getTime(),
	}

	localBBClubSets[bbclubSet.pack_name] = localBBClubLink
	set.localBBClubSet = localBBClubLink
	set.localSet = {
		loadData: () => getLocalSetData(setPath),
		path: setPath,
	}
	await writeJson(BB_CLUB_SETS_LINK_FILE, localBBClubSets)
}

export async function downloadAndOverwriteBBClubSetGs(
	get: Getter,
	set: Setter,
	levelSet: ItemLevelSet,
	reportProgress?: (progress: number) => void
) {
	if (!levelSet.bbClubSet)
		throw new Error("Can't download a set item which isn't from bb.club")
	const zip = await levelSet.bbClubSet.repo.downloadSet(
		levelSet.bbClubSet.set.id,
		reportProgress
	)
	await saveBBClubSetLocally(levelSet, zip)
	announceLocalSetsChangedGs(get, set)
}

export async function downloadBBClubSetGs(
	get: Getter,
	set: Setter,
	levelSet: ItemLevelSet,
	reportProgress?: (progress: number) => void
) {
	const setIsFine = await findLocalSetConflictsGs(
		get,
		set,
		levelSet.setIdent,
		levelSet.setName
	)
	if (!setIsFine) return false
	await downloadAndOverwriteBBClubSetGs(get, set, levelSet, reportProgress)
	return true
}

export async function getSetMetadata(
	set: ItemLevelSet
): Promise<ScriptMetadata | null> {
	if (!set.localSet) return null
	const setData = await set.localSet.loadData()
	const entryScript = (await setData.loaderFunction(
		setData.scriptFile,
		false
	)) as string
	return parseScriptMetadata(entryScript)
}

const MAX_LOCAL_SET_NAME_SUBSTITUTES = 10000

async function findSubstituteLocalName(
	replacementName: string
): Promise<string> {
	if (!(await findLocalSet(replacementName))) return replacementName
	let suffixNum = 2
	while (
		suffixNum < MAX_LOCAL_SET_NAME_SUBSTITUTES &&
		(await findLocalSet(replacementName + suffixNum))
	)
		suffixNum += 1
	if (suffixNum === MAX_LOCAL_SET_NAME_SUBSTITUTES)
		throw new Error(
			"Okay, what are you doing. Why do you have 10000 sets formatted specifically to break NotCC. Stop."
		)
	return replacementName + suffixNum
}

export async function moveLocalSet(set: ItemLevelSet, newIdent: string) {
	if (!set.localSet) throw new Error("Cannot move a non-local set")
	if (await isDir(set.localSet.path)) {
		// This is a dir, no ext
		await move(set.localSet.path, `/sets/${newIdent}`)
	} else {
		// This is a zip, append .zip
		await move(set.localSet.path, `/sets/${newIdent}.zip`)
	}
	// Change the local-bb.club reference
	if (set.localBBClubSet) {
		const bbClubLinks: BbClubLinks = await readJson(BB_CLUB_SETS_LINK_FILE)
		bbClubLinks[newIdent] = bbClubLinks[set.setIdent]
		delete bbClubLinks[set.setIdent]
		await writeJson(BB_CLUB_SETS_LINK_FILE, bbClubLinks)
	}
}

export const SetIdentExpl = () => (
	<Expl mode="dialog" title="Set ident">
		A set identifier is a unique name of the set which NotCC uses for the set's
		directory/file name.
	</Expl>
)

const SameIdentSetExistsPrompt =
	(
		newSetName: string,
		oldSet: ItemLevelSet
	): PromptComponent<"overwrite" | "rename local" | "cancel"> =>
	pProps => {
		return (
			<Dialog
				header="Set ident conflict!"
				buttons={[
					["Overwrite", () => pProps.onResolve("overwrite")],
					["Rename local", () => pProps.onResolve("rename local")],
					["Cancel", () => pProps.onResolve("cancel")],
				]}
				onClose={() => pProps.onResolve("cancel")}
			>
				The set you're trying to add, "{newSetName}", has the same set ident{" "}
				<SetIdentExpl /> as the local set "{oldSet.setName}", which has been
				previously loaded from a local file or directory. To add the new set,
				you must do one of the following:
				<ul>
					<li>
						Overwrite - if the added set is an newer version of the local set,
						you can replace the local set with the new set.
					</li>
					<li>
						Rename local - if the local set is unrelated to the new set and you
						wish to keep both sets, the local set's ident can be changed to
						allow both to be stored.
					</li>
				</ul>
			</Dialog>
		)
	}

const SameTitleSetExistsPrompt =
	(newSetName: string): PromptComponent<"continue" | "overwrite" | "cancel"> =>
	pProps => {
		return (
			<Dialog
				header="Set title conflict!"
				buttons={[
					["Continue", () => pProps.onResolve("continue")],
					["Overwrite", () => pProps.onResolve("overwrite")],
					["Cancel", () => pProps.onResolve("cancel")],
				]}
				onClose={() => pProps.onResolve("cancel")}
			>
				It appears that a set with the title of "{newSetName}" already exists.
				Multiple sets with the same title will use the same save file, which is
				generally undersirable behavior. If this set is a new version of the
				local set, you can overwrite this set.
			</Dialog>
		)
	}

export async function findLocalSetConflictsGs(
	get: Getter,
	set: Setter,
	newIdent: string,
	newSetName: string
): Promise<boolean> {
	const sameIdentSet = await findLocalSet(newIdent)
	if (sameIdentSet) {
		const promptRes = await showPromptGs(
			get,
			set,
			SameIdentSetExistsPrompt(newSetName, sameIdentSet)
		)
		if (promptRes === "cancel") return false
		else if (promptRes === "overwrite") {
			await removeLocalSet(sameIdentSet)
		} else if (promptRes === "rename local") {
			const newName = await findSubstituteLocalName(
				sameIdentSet.setIdent + "-local"
			)
			await moveLocalSet(sameIdentSet, newName)
			announceLocalSetsChangedGs(get, set)
		}
	}
	const sameTitleSets = await aiGather(
		aiFilter(findAllLocalSets(), set => set.setName === newSetName)
	)
	if (sameTitleSets.length > 0) {
		const promptRes = await showPromptGs(
			get,
			set,
			SameTitleSetExistsPrompt(newSetName)
		)
		if (promptRes === "cancel") return false
		else if (promptRes === "overwrite") {
			for (const set of sameTitleSets) {
				await removeLocalSet(set)
			}
			announceLocalSetsChangedGs(get, set)
		} else if (promptRes === "continue") {
		}
	}
	return true
}

async function saveFilesAtDir(files: File[], dir: string) {
	for (const file of files) {
		let pathStr = normalizePath(file.webkitRelativePath)
		// Have to strip out the top dir, since that's just the directory the files were in when they were uploaded
		// XXX: What if someone load the root directory (or a whole Windows drive), wouldn't there be no dir then?
		pathStr = pathStr.split("/").slice(1).join("/")

		const path = parsePath(pathStr)
		await makeDirP(joinPath(dir, path.dir))
		await writeFile(joinPath(dir, pathStr), await file.arrayBuffer())
	}
}

export async function saveFilesLocallyGs(
	get: Getter,
	set: Setter,
	files: File[],
	setTitle: string
): Promise<{ setIdent: string } | null> {
	let setIdent = files[0].webkitRelativePath.split("/")[0]
	// Okay this is cursed but bear with me: if this is actually an important set (as identified by
	// the set name), move it to the "correct" set ident so that links
	// like "/play/cc1/123" work even if you loaded CC1 as CC1STEAM or whatever
	const importantSet = IMPORTANT_SETS.find(set => set.setName === setTitle)
	if (importantSet) {
		setIdent = importantSet.setIdent
	}

	const setIsFine = await findLocalSetConflictsGs(get, set, setIdent, setTitle)
	if (!setIsFine) return null
	await saveFilesAtDir(files, `/sets/${setIdent}`)

	announceLocalSetsChangedGs(get, set)
	return { setIdent }
}

export async function fetchBBClubSets(url: string): Promise<ItemLevelSet[]> {
	const repo = new BBClubSetsRepository(url)
	await repo.loadInitCache()
	if (!navigator.onLine) throw new Error("Browser appears to be offline")
	return (await repo.getSets()).map<ItemLevelSet>(set => ({
		setName: set.display_name ?? set.pack_name,
		setIdent: set.pack_name,
		setKey: `bb.club-${set.id}`,
		bbClubSet: { repo, set },
	}))
}

export function useBBClubSetsPromise() {
	// TODO: Allow changing the URL
	const repoPromise = useMemo(() => fetchBBClubSets(BB_CLUB_SETS_URL), [])
	return repoPromise
}
