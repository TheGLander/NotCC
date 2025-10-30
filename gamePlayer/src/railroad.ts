import { Route } from "@notcc/logic"
import { atom } from "jotai"
import { atomEffect } from "jotai-effect"
import { unwrap } from "jotai/utils"
import { importantSetAtom } from "./levelData"
import { Falliable, falliable } from "./helpers"

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

export const setRRRoutesAtom = unwrap(
	atom<Promise<Falliable<RRLevel[]>> | null>(null)
)

export const rrRoutesSyncAtom = atomEffect((get, set) => {
	const importantSet = get(importantSetAtom)
	if (!importantSet) {
		set(setRRRoutesAtom, null)
	} else {
		set(setRRRoutesAtom, falliable(getRRRoutes(importantSet.setIdent, true)))
	}
})
