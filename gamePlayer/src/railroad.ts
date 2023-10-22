import { Route } from "@notcc/logic"

export interface RRRoute {
	id: string
	moves: Route
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
	mainlineTimeRoute: string
	mainlineScoreRoute: string
}

export async function getRRRoutes(pack: string): Promise<RRLevel[]> {
	const res = await fetch(`https://glander.club/railroad/packs/${pack}`)
	return await res.json()
}

export function identifyRRPack(setName: string): string | null {
	return (
		{
			"Chips Challenge": "cc1",
			"Chips Challenge 2": "cc2",
			"Chips Challenge 2 Level Pack 1": "cc2lp1",
		}[setName] ?? null
	)
}
