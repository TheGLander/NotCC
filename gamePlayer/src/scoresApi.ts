// /players
export interface ApiPlayerGeneric {
	player_id: number
	player: string
}

// /players/[id]
export interface ApiPlayerSummary extends ApiPlayerGeneric {
	score_summary: Record<string, ApiPlayerPackMetric[]>
	designed_levels: ApiDesignedLevelsSummary[]
}

export interface ApiPlayerPackMetric {
	pack: string
	rule_type: string
	metric: string
	avg_ranking: string
	calc_score: number
	bold_count: number
}

export interface ApiDesignedLevelsSummary {
	pack: string
	level_count: number
}

export async function getPlayerSummary(id: number): Promise<ApiPlayerSummary> {
	const res = await fetch(`https://api.bitbusters.club/players/${id}`)
	return await res.json()
}

// /players/[id]/[pack]
export interface ApiPlayerPackDetails extends ApiPlayerGeneric {
	scores: ApiPackReports
}

export interface ApiPackReports {
	pack: string
	/**
	 * Note: If there are no report for a specific level, the key isn't present
	 */
	levels: Partial<Record<string, ApiPackReport[]>>
}

export interface ApiAttributeIdentifier {
	rule_type: string
	metric: string
}

export interface ApiPackReport extends ApiAttributeIdentifier {
	reported_value: number
	ranking: number
	tiebreaker: number
	date_reported: string
}

export interface ApiDesignedLevel {
	level: number
	level_name: string
	wiki_article: string
}

export async function getPlayerPackDetails(
	id: number,
	pack: string
): Promise<ApiPlayerPackDetails> {
	const res = await fetch(`https://api.bitbusters.club/players/${id}/${pack}`)
	return await res.json()
}

export interface ApiPackLevel {
	level: number
	name: string
	game: string
	pack: string
	designers: string
	adapted: boolean
	password: string | null
	time_limit: number
	chips_required: number
	total_chips: number
	chips_note?: string
	wiki_article: string
	steam_map: string
	level_attribs: ApiPackLevelAttribute[]
}

export interface ApiPackLevelAttribute extends ApiAttributeIdentifier {
	attribs: {
		melinda: number
		highest_reported: number
		casual_diff: number
		exec_diff: number
		luck_diff: number
		routing_diff: number
	}
}

export async function getPackLevels(pack: string): Promise<ApiPackLevel[]> {
	const res = await fetch(`https://api.bitbusters.club/packs/${pack}/levels`)
	return await res.json()
}

export interface ApiRRPackLevel {
	level_attribs: ApiRRPackLevelAttribute[]
}

export interface ApiRRPackLevelAttribute extends ApiAttributeIdentifier {
	attribs: {
		highest_reported: number
		highest_confirmed: number
	}
}

export async function getRRPackLevels(pack: string): Promise<ApiRRPackLevel[]> {
	const res = await fetch(`https://glander.club/railroad/bolds/${pack}`)
	return await res.json()
}

export function tryGetRRPackLevels(
	pack: string
): Promise<ApiRRPackLevel[] | ApiPackLevel[]> {
	return getRRPackLevels(pack).catch(err => {
		console.error(err)
		return getPackLevels(pack)
	})
}
