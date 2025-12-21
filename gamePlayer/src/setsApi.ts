import { parseC2M } from "@notcc/logic"
import {
	BasicSemaphore,
	progressiveBodyDownload,
	resErrorToString,
} from "./helpers"
import { LevelData } from "./levelData"
import { exists, readFile, readJson, remove, writeFile, writeJson } from "./fs"

export interface BBClubSet {
	id: number
	pack_name: string
	display_name: string
	game: "CC1" | "CC2"
	pack_type: string
	level_count: number
	description: string | null
	release_date: string
	last_updated: string
	file_name: string
	file_size: number
	download_url: string
}
export function getBBClubSetReleased(set: BBClubSet) {
	return new Date(set.release_date + "Z")
}
export function getBBClubSetUpdated(set: BBClubSet) {
	return new Date(set.last_updated + "Z")
}

export interface BBClubLevel {
	level: number
	name: string | null
	designer: string | null
	time_limit: number
	chips_required: number
	total_chips: number
	width: number
	height: number
	hint: string | null
	download_url: string | null
}

export const BB_CLUB_SETS_URL = "https://api.bitbusters.club/custom-packs"
const BB_CLUB_SETS_CACHE_PATH = "cache/bb-club-sets.json"

function getPreviewFilePath(set: string) {
	return `cache/bb-club-preview-${set}.c2m`
}

export class BBClubSetsRepository {
	fetchSemaphore = new BasicSemaphore(5)
	sets: BBClubSet[] | null = null
	constructor(public apiUrl: string) {}
	async loadInitCache(): Promise<void> {
		if (await exists(BB_CLUB_SETS_CACHE_PATH)) {
			this.sets = await readJson(BB_CLUB_SETS_CACHE_PATH)
		}
	}
	async setCache(sets: BBClubSet[]): Promise<void> {
		this.sets = sets
		await writeJson(BB_CLUB_SETS_CACHE_PATH, sets)
	}
	getUrl(path: string) {
		return `${this.apiUrl}${path}`
	}
	async fetch<T>(path: string): Promise<T> {
		await this.fetchSemaphore.enter()
		const res = await fetch(this.getUrl(path))
		if (!res.ok) {
			this.fetchSemaphore.leave()
			throw new Error(
				`Failed to fetch from the sets API: ${await resErrorToString(res)}`
			)
		}
		const json = await res.json()
		this.fetchSemaphore.leave()
		return json
	}
	// Fetches the sets raw, without any cache invalidation logic
	async _getSetsRaw(): Promise<BBClubSet[]> {
		return ((await this.fetch("/cc2")) as BBClubSet[]).filter(
			// Filter out sets without a download link, since we can't do anything with those
			set => set.download_url !== null
		)
	}
	async getSets(): Promise<BBClubSet[]> {
		const oldSets = this.sets
		const newSets = await this._getSetsRaw()
		// Compare the old and new set listings, and refetch previews for all new and updated sets
		// (user-updatable sets are handled separately)
		const changedSets = newSets.filter(newSet => {
			const oldSet = oldSets?.find(oldSet => oldSet.id === newSet.id)
			return (
				!oldSet || new Date(newSet.last_updated) > new Date(oldSet.last_updated)
			)
		})
		// Remove outdated preview files
		for (const set of changedSets) {
			const previewFile = getPreviewFilePath(set.pack_name)
			if (await exists(previewFile)) {
				await remove(previewFile)
			}
		}
		// Old commit the new sets listing after removing the previews, so that we can be sure that all the previews are up to date even if we crash mid-fetch
		await this.setCache(newSets)
		return newSets
	}
	async getSet(id: number): Promise<BBClubSet> {
		const sets = this.sets ?? (await this.getSets())
		const set = sets.find(set => set.id === id)
		if (!set) throw new Error(`No set with id ${id}`)
		return set
	}
	async getSetPreview(id: number): Promise<LevelData | null> {
		// If we have the preview file cached already, don't download it again
		const set = await this.getSet(id)
		const previewFile = getPreviewFilePath(set.pack_name)
		if (set && (await exists(previewFile!))) {
			const file = await readFile(previewFile!)
			return new LevelData(parseC2M(file))
		}
		const levels: BBClubLevel[] = await this.fetch(`/cc2/${id}/levels`)
		const firstLevelUrl = levels[0].download_url
		// Should never happen, since sets without a `download_url` were filtered out earlier
		if (firstLevelUrl === null) return null
		const res = await fetch(firstLevelUrl)
		if (!res.ok)
			throw new Error(
				`Failed to download first level: ${await resErrorToString(res)}`
			)
		const levelBuf = await res.arrayBuffer()
		if (levelBuf.byteLength === 0)
			throw new Error(
				"Failed to download set preview: server sent empty response"
			)
		await writeFile(previewFile, levelBuf)
		return new LevelData(parseC2M(levelBuf))
	}
	/**
	 * @returns The levelset in a Zip archive
	 * */
	async downloadSet(
		id: number,
		reportProgress?: (progress: number) => void
	): Promise<ArrayBuffer> {
		// No caching, if this is called, the user knows what they want
		const set = await this.getSet(id)
		await this.fetchSemaphore.enter()
		const res = await fetch(set.download_url)
		if (!res.ok) {
			this.fetchSemaphore.leave()
			throw new Error(`Failed to download set: ${await resErrorToString(res)}`)
		}
		return progressiveBodyDownload(res, reportProgress).catch(err => {
			this.fetchSemaphore.leave()
			throw err
		})
	}
}
