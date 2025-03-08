import { PromptComponent } from "@/prompts"
import {
	ApiPackLevel,
	ApiPackLevelAttribute,
	ApiPackReport,
	MetricGrades,
	ReportGrade,
	getLevelAttribute,
	getMetricsForPlayerReports,
	getPlayerPackDetails,
	getReportGradesForMetrics,
	optimizerIdAtom,
	setScoresAtom,
} from "@/scoresApi"
import { Dialog } from "./Dialog"
import { useAtomValue } from "jotai"
import { importantSetAtom, levelSetAtom } from "@/levelData"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { SolutionMetrics, findBestMetrics, protobuf } from "@notcc/logic"
import { usePromise } from "@/helpers"

interface ReportMetric {
	value: number
	grade: ReportGrade
	// The extra value for P+ and B+ grades
	gradeImprovement?: number
	alreadyReported: boolean
}

function formatReportMetric(
	metric: ReportMetric,
	type: "time" | "score"
): string {
	let gradeLetter: string | undefined
	if (metric.grade === "better than bold") {
		gradeLetter = `b+${metric.gradeImprovement ?? 0}`
	} else if (metric.grade === "bold confirm") {
		// If this exact metric value was already reported, it cannot be a bold confirm, since that
		// requires a different player to achieve the same time
		gradeLetter = metric.alreadyReported ? "b" : "bc"
	} else if (metric.grade === "partial confirm") {
		gradeLetter = "pc"
	} else if (metric.grade === "bold") {
		gradeLetter = "b"
	} else if (metric.grade === "better than public") {
		gradeLetter = `p+${metric.gradeImprovement ?? 0}`
	} else if (metric.grade === "public") {
		gradeLetter = "p"
	}
	return `${metric.value}${type === "time" ? "s" : "pts"}${gradeLetter ? ` (${gradeLetter})` : ""}`
}

function formatReportLine(line: ReportLine, timeOnly: boolean): string {
	return `#${line.levelN} (${line.title}): ${formatReportMetric(line.time, "time")}${timeOnly ? "" : ` / ${formatReportMetric(line.score, "score")}`}\n`
}

interface ReportLine {
	lineIncluded: boolean
	levelN: number
	title: string
	time: ReportMetric
	score: ReportMetric
	hasImprovements: boolean
}

function getGradeImprovement(
	grade: ReportGrade,
	value: number,
	attr?: ApiPackLevelAttribute
): number | undefined {
	if (grade === "better than bold")
		return value - (attr?.attribs.highest_reported ?? 0)
	if (grade === "better than public")
		return value - (attr?.attribs.highest_public ?? 0)
	return undefined
}

function makeReportLine(
	levelInfo: protobuf.ILevelInfo,
	levelScores?: ApiPackLevel,
	playerScores?: ApiPackReport[]
): ReportLine | null {
	const localMetrics = findBestMetrics(levelInfo)
	if (!localMetrics) return null
	const reportedMetrics = getMetricsForPlayerReports(playerScores ?? [])
	const maxMetrics: SolutionMetrics = {
		timeLeft: Math.max(localMetrics.timeLeft, reportedMetrics.timeLeft ?? 0),
		score: Math.max(localMetrics.score, reportedMetrics.score ?? 0),
		realTime: Math.min(
			localMetrics.realTime,
			reportedMetrics.realTime ?? Infinity
		),
	}
	const grades: MetricGrades = !levelScores
		? { time: "solved", score: "solved" }
		: getReportGradesForMetrics(maxMetrics, levelScores)

	const maxTimeLeftS = Math.ceil(maxMetrics.timeLeft / 60)

	return {
		levelN: levelInfo.levelNumber!,
		title: levelInfo.title! ?? "untitled level",
		time: {
			value: maxTimeLeftS,
			grade: grades.time,
			alreadyReported:
				reportedMetrics.timeLeft !== undefined &&
				Math.ceil(reportedMetrics.timeLeft / 60) >=
					Math.ceil(localMetrics.timeLeft / 60),
			gradeImprovement: getGradeImprovement(
				grades.time,
				maxTimeLeftS,
				levelScores && getLevelAttribute("time", levelScores)
			),
		},
		score: {
			value: maxMetrics.score,
			grade: grades.score,
			alreadyReported:
				reportedMetrics.score !== undefined &&
				reportedMetrics.score >= localMetrics.score,
			gradeImprovement: getGradeImprovement(
				grades.score,
				maxMetrics.score,
				levelScores && getLevelAttribute("score", levelScores)
			),
		},
		lineIncluded: true,
		hasImprovements:
			(reportedMetrics.score === undefined ||
				localMetrics.score > reportedMetrics.score) &&
			(reportedMetrics.timeLeft === undefined ||
				Math.ceil(localMetrics.timeLeft / 60) >=
					Math.ceil(reportedMetrics.timeLeft / 60)),
	}
}

function ReportLineC(props: { line: ReportLine; showTimeOnly: boolean }) {
	// FIXME: This whole component is really anti-React, but the correct way to do this
	// (I guess have an `onIncludedToggled` prop which etc. etc.) is really dumb
	const [, setChanged] = useState(false)
	return (
		<div>
			<label class={!props.line.lineIncluded ? "line-through" : ""}>
				<div class="absolute left-0 inline-block">
					<input
						type="checkbox"
						checked={props.line.lineIncluded}
						onInput={ev => {
							props.line.lineIncluded = ev.currentTarget.checked
							setChanged(v => !v)
						}}
					/>
				</div>
				{formatReportLine(props.line, props.showTimeOnly)}
			</label>
		</div>
	)
}

export const ReportGeneratorPrompt: PromptComponent<void> = pProps => {
	const setScores = useAtomValue(setScoresAtom)
	const levelSet = useAtomValue(levelSetAtom)
	const importantSet = useAtomValue(importantSetAtom)

	const optimizerId = useAtomValue(optimizerIdAtom)
	const playerScoresRes = usePromise(
		() =>
			optimizerId && importantSet
				? getPlayerPackDetails(optimizerId, importantSet.setIdent)
				: Promise.resolve(null),
		[optimizerId, importantSet]
	)

	useEffect(() => {
		if (!levelSet) {
			pProps.onResolve()
		}
	}, [])

	const reportPrologue = useMemo(
		() => `${levelSet?.gameTitle()} scores:\n\n`,
		[levelSet]
	)
	const reportEpilogue = useMemo(
		() =>
			`\n(NotCC v${import.meta.env.VITE_VERSION} ${import.meta.env.VITE_GIT_COMMIT})`,
		[]
	)
	const lines = useMemo(() => {
		if (!levelSet) return null
		return levelSet
			.listLevels()
			.map<ReportLine | null>(level =>
				makeReportLine(
					level.levelInfo,
					setScores?.find(
						scoresLevel => scoresLevel.level === level.levelInfo.levelNumber
					),
					playerScoresRes.value?.scores.levels[level.levelInfo.levelNumber!]
				)
			)
			.filter((line): line is ReportLine => !!line)
	}, [levelSet, setScores, playerScoresRes.value])

	const showTimeOnly = !(importantSet?.scoreboardHasScores ?? true)

	const [improvementsOnly, setImprovementsOnly] = useState(true)

	const copyReportToClipboard = useCallback(() => {
		const fullReport =
			reportPrologue +
			lines
				?.filter(line => line.lineIncluded)
				?.filter(line => !improvementsOnly || line.hasImprovements)
				?.map(line => formatReportLine(line, showTimeOnly))
				.join("") +
			reportEpilogue
		navigator.clipboard.writeText(fullReport)
	}, [reportPrologue, lines, reportEpilogue, improvementsOnly])

	return (
		<Dialog
			header="Report generator"
			buttons={[
				["Copy to clipboard", copyReportToClipboard],
				["Close", pProps.onResolve],
			]}
			onClose={pProps.onResolve}
		>
			<div class="relative">
				<div>
					{!setScores
						? "Not an official set"
						: `Official set, ${optimizerId === null ? "no optimizer ID" : playerScoresRes.state === "working" ? "loading optimizer data" : playerScoresRes.state === "error" ? "failed to load player data" : `player is ${playerScoresRes.value!.player}`}`}
				</div>
				<label>
					<input
						type="checkbox"
						checked={playerScoresRes.value ? improvementsOnly : false}
						onInput={ev => setImprovementsOnly(ev.currentTarget.checked)}
						disabled={!playerScoresRes.value}
					/>{" "}
					Show improvements only
				</label>
				<div class="bg-theme-950 ml-[calc(theme(spacing.4)_+_2px)] whitespace-pre-line rounded p-1 font-mono">
					{reportPrologue}
					{lines
						?.filter(line => !improvementsOnly || line.hasImprovements)
						?.map(line => (
							<ReportLineC line={line} showTimeOnly={showTimeOnly} />
						))}
					{reportEpilogue}
				</div>
			</div>
		</Dialog>
	)
}
