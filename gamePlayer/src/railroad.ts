import { Route } from "@notcc/logic"
import { atom } from "jotai"
import { unwrap } from "jotai/utils"

export interface RRRoute {
	id: string
	moves?: Route
	absoluteTime: number
	timeLeft: number
	points: number
	routeLabel: string
	submitter: string
	createdAt: Date
}

export interface RRLevel {
	routes: RRRoute[]
	setName: string
	title: string
	levelN: number
	boldTime: number
	boldScore: number
	mainlineTimeRoute?: string
	mainlineScoreRoute?: string
}

export async function getRRRoutes(
	pack: string,
	noMoves = false
): Promise<RRLevel[]> {
	const res = await fetch(
		`https://glander.club/railroad/packs/${pack}${noMoves ? "?noMoves" : ""}`
	)
	return await res.json()
}

export async function getRRLevel(
	pack: string,
	levelN: number,
	noMoves = false
): Promise<RRLevel> {
	const res = await fetch(
		`https://glander.club/railroad/packs/${pack}/${levelN}/${
			noMoves ? "?noMoves" : ""
		}`
	)
	return await res.json()
}

export const setRRRoutesAtomWrapped = atom<Promise<RRLevel[]> | null>(null)
export const setRRRoutesAtom = unwrap(setRRRoutesAtomWrapped)
