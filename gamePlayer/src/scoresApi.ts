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
	levels: Record<string, ApiPackReport[]>
}

export interface ApiPackReport {
	rule_type: string
	metric: string
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
