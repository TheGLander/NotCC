import { atom } from "jotai"
import { unwrap } from "jotai/utils"
import { preferenceAtom } from "./preferences"
import { atomEffect } from "jotai-effect"
import { importantSetAtom } from "./levelData"
import { SolutionMetrics } from "@notcc/logic"

// /players
export interface ApiPlayerGeneric {
	player_id: number
	player: string
	country?: string
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

export async function getPlayerSummary(
	id: number
): Promise<ApiPlayerSummary | null> {
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

export async function getPlayerPackDetails(
	id: number,
	pack: string
): Promise<ApiPlayerPackDetails> {
	const res = await fetch(`https://api.bitbusters.club/players/${id}/${pack}`)
	return await res.json()
}

// /packs/[pack]/levels

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
		highest_reported?: number
		highest_public?: number
		highest_confirmed?: number
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

export const optimizerIdAtom = preferenceAtom<number | null>(
	"optimizerId",
	null
)

export const setScoresAtom = unwrap(atom<Promise<ApiPackLevel[]> | null>(null))
export const setPlayerScoresAtom = unwrap(
	atom<Promise<ApiPlayerPackDetails> | null>(null)
)

export const setScoresSyncAtom = atomEffect((get, set) => {
	const importantSet = get(importantSetAtom)
	set(setScoresAtom, null)
	set(setPlayerScoresAtom, null)

	if (!importantSet) return
	set(setScoresAtom, getPackLevels(importantSet.setIdent))
	const optimizerId = get(optimizerIdAtom)

	if (optimizerId === null) return
	set(
		setPlayerScoresAtom,
		getPlayerPackDetails(optimizerId, importantSet.setIdent)
	)
})

export type ReportGrade =
	| "better than bold"
	| "bold confirm"
	| "partial confirm"
	| "bold"
	| "better than public"
	| "public"
	| "solved"
	| "unsolved"

export function getReportGradeForValue(
	value: number,
	level: ApiPackLevelAttribute
): ReportGrade {
	const {
		highest_reported: highestReported,
		highest_confirmed: highestConfirmed,
		highest_public: highestPublic,
	} = level.attribs
	if (highestReported === undefined || value > highestReported)
		return "better than bold"
	if (highestConfirmed === undefined)
		throw new Error(
			"If there's a reported score, there should also be a confirmed score. Score server error?"
		)
	if (value > highestConfirmed)
		return value === highestReported ? "bold confirm" : "partial confirm"
	if (value === highestReported) return "bold"
	if (highestPublic === undefined || value > highestPublic)
		return "better than public"
	if (value === highestPublic) return "public"
	return "solved"
}

function getLevelAttribute(metric: "time" | "score", level: ApiPackLevel) {
	return level.level_attribs.find(
		attr => attr.rule_type === "steam" && attr.metric === metric
	)
}

export type MetricGrades = Record<"time" | "score", ReportGrade>

export function getReportGradesForMetrics(
	metrics: SolutionMetrics,
	level: ApiPackLevel
): MetricGrades {
	const timeAttr = getLevelAttribute("time", level)
	if (!timeAttr) throw new Error("Scores level is missing Steam time attribute")

	const timeGrade = getReportGradeForValue(
		Math.ceil(metrics.timeLeft / 60),
		timeAttr
	)
	// If there's no score leaderboard (eg. CC1 Steam), assume no levels have flags and time === score,  grade-wise
	const scoreAttr = getLevelAttribute("score", level)
	if (!scoreAttr) {
		return {
			time: timeGrade,
			score: timeGrade,
		}
	}
	return {
		time: timeGrade,
		score: getReportGradeForValue(metrics.score, scoreAttr),
	}
}
