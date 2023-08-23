import { calculateLevelPoints, protobuf } from "@notcc/logic"
import { Pager } from "./pager"
import { BasicTooltipEntry } from "./sidebar"

function protoToNum(dur: protobuf.google.protobuf.IDuration): number {
	return (
		((dur.seconds as number) ?? 0) +
		(dur.nanos ? (dur.nanos as number) / 1_000_000 : 0)
	)
}

interface TTSolutionEntry {
	title: string
	solution: protobuf.ISolutionInfo
	showMetric: "time" | "score" | "time/score" | "custom"
	customMetric?: string
}

function getSolEntryMetric(
	lvlN: number | undefined,
	ent: TTSolutionEntry
): string {
	if (ent.showMetric === "custom") return ent.customMetric!
	if (ent.showMetric === "time") {
		return `${Math.ceil(protoToNum(ent.solution.outcome!.timeLeft!))}s`
	}
	const score = calculateLevelPoints(
		lvlN ?? 0,
		Math.ceil(protoToNum(ent.solution.outcome!.timeLeft!)),
		ent.solution.outcome!.bonusScore!
	)
	if (ent.showMetric === "score") return `${score}pts`
	const time = Math.ceil(protoToNum(ent.solution.outcome!.timeLeft!))
	return `${time}s / ${score}pts`
}

function findAbsTime(sol: protobuf.ISolutionInfo): number {
	const steps = sol.steps?.[0]
	return steps!.reduce((acc, val, i) => (i % 2 === 1 ? acc + val : acc), 0) / 60
}

function findAttemptEnts(
	lvlN: number,
	attempts: protobuf.IAttemptInfo[]
): TTSolutionEntry[] {
	const solutions: protobuf.ISolutionInfo[] = attempts
		.filter(att => !att.failReason && att.solution)
		.sort((a, b) => protoToNum(a.attemptStart!) - protoToNum(b.attemptStart!))
		.map(att => att.solution!)

	const bestTime = solutions.reduce(
		(acc, val) => (val.outcome!.timeLeft! > acc.outcome!.timeLeft! ? val : acc),
		solutions[0]
	)
	const bestScore = solutions.reduce((acc, val) => {
		const valScore = calculateLevelPoints(
			lvlN,
			Math.ceil(protoToNum(val.outcome!.timeLeft!)),
			val.outcome!.bonusScore!
		)
		const accScore = calculateLevelPoints(
			lvlN,
			Math.ceil(protoToNum(acc.outcome!.timeLeft!)),
			acc.outcome!.bonusScore!
		)
		return valScore > accScore ? val : acc
	}, solutions[0])

	const ents: TTSolutionEntry[] = []

	if (bestTime === bestScore) {
		ents.push({ title: "Best", solution: bestTime, showMetric: "time/score" })
	} else {
		ents.push(
			{ title: "Best time", solution: bestTime, showMetric: "time" },
			{ title: "Best score", solution: bestScore, showMetric: "score" }
		)
	}

	const lastSol = solutions[solutions.length - 1]

	if (lastSol !== bestTime && lastSol !== bestScore) {
		ents.push({
			title: "Last solution",
			solution: lastSol,
			showMetric: "time/score",
		})
	}

	return ents.filter(tt => tt.solution !== undefined)
}

export function generateSolutionTooltipEntries(
	pager: Pager
): BasicTooltipEntry[] {
	if (!pager.loadedLevel) return [{ name: "No level loaded.", shortcut: null }]

	const shownSolutions: TTSolutionEntry[] = []

	const builtinSolution = pager.loadedLevel?.associatedSolution
	if (builtinSolution) {
		shownSolutions.push({
			title: "Built-in",
			solution: builtinSolution,
			showMetric: "custom",
			customMetric: `~${Math.ceil(findAbsTime(builtinSolution))}rs`,
		})
	}

	const lvlN = pager.loadedSet?.currentLevel

	if (pager.loadedSet) {
		const levelRecord = pager.loadedSet.seenLevels[pager.loadedSet.currentLevel]
		const attempts = levelRecord.levelInfo.attempts

		if (attempts) {
			shownSolutions.push(...findAttemptEnts(lvlN!, attempts))
		}
	}

	if (shownSolutions.length === 0)
		return [{ name: "No solutions found.", shortcut: null }]

	return shownSolutions.map(solEntry => ({
		name: `${solEntry.title} - ${getSolEntryMetric(lvlN, solEntry)}`,
		shortcut: null,
		action() {
			pager.loadSolution(solEntry.solution)
		},
	}))
}
