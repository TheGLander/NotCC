import { findBestMetrics, SolutionMetrics } from "@notcc/logic"
import { Pager } from "./pager"
import { instanciateTemplate, resetListeners } from "./utils"
import {
	ApiAttributeIdentifier,
	ApiPackLevelAttribute,
	ApiRRPackLevelAttribute,
	getPlayerPackDetails,
	tryGetRRPackLevels,
} from "./scoresApi"

const scoreReportGenDialog = document.querySelector<HTMLDialogElement>(
	"#scoreReportGenDialog"
)!

const reportLineTemplate =
	scoreReportGenDialog.querySelector<HTMLTemplateElement>(
		"#reportLineTemplate"
	)!

interface ReportLevel {
	levelN: number
	levelName: string
	metrics: Partial<SolutionMetrics>
	reportedMetrics: Partial<SolutionMetrics>
	boldMetrics: Partial<SolutionMetrics>
	confirmedMetrics: Partial<SolutionMetrics>
}

interface ReportEntry {
	text: string
	enabled: boolean
}

type ReportMode = "cc1" | "cc2"

const setNameToScoreboardName: Partial<Record<string, [ReportMode, string]>> = {
	"Chips Challenge": ["cc1", "cc1"],
	"Chips Challenge 2": ["cc2", "cc2"],
	"Chips Challenge 2 Level Pack 1": ["cc2", "cc2lp1"],
}

function determineMetricReportType(
	level: ReportLevel,
	metric: keyof SolutionMetrics
): string | null {
	const userMetric = level.metrics[metric]
	if (userMetric === undefined) throw new Error("No user metric")
	const reportedMetric = level.reportedMetrics[metric]
	const boldMetric = level.boldMetrics[metric]
	const confirmedMetric = level.confirmedMetrics[metric]
	// The bold metric should exist as long as there's at least one report for the level
	// So, if we don't find one, it's probably the first report for level! Fun stuff.
	if (boldMetric === undefined) return null
	if (userMetric > boldMetric) return `b+${userMetric - boldMetric}`
	if (userMetric === boldMetric)
		return confirmedMetric === undefined || boldMetric === confirmedMetric
			? "b"
			: "bc"
	if (confirmedMetric !== undefined && userMetric > confirmedMetric) return "pc"
	if (reportedMetric !== undefined && userMetric > reportedMetric)
		return `+${userMetric - reportedMetric}`
	return null
}

function makeReportText(level: ReportLevel, mode: ReportMode): string {
	let reportText = `#${level.levelN} ${level.levelName}: `

	const timeRepType = determineMetricReportType(level, "timeLeft")

	reportText += `${Math.max(
		level.metrics.timeLeft ?? -Infinity,
		level.reportedMetrics.timeLeft ?? -Infinity
	)}s`

	if (timeRepType) {
		reportText += ` (${timeRepType})`
	}

	if (mode === "cc2") {
		const pointsRepType = determineMetricReportType(level, "points")
		reportText += ` | ${Math.max(
			level.metrics.points ?? -Infinity,
			level.reportedMetrics.points ?? -Infinity
		)}pts`
		if (pointsRepType) {
			reportText += ` (${pointsRepType})`
		}
	}
	return reportText
}

function generateReportLines(
	entries: ReportEntry[],
	showDisabled: boolean
): void {
	const reportText = scoreReportGenDialog.querySelector("#linesPoint")!
	// Nuke all current data
	reportText.textContent = ""
	for (const entry of entries) {
		if (!showDisabled && !entry.enabled) continue
		const reportLine = instanciateTemplate<HTMLDivElement>(reportLineTemplate)
		const checkbox = reportLine.querySelector("input")!
		checkbox.checked = entry.enabled
		reportLine.classList.toggle("disabled", !entry.enabled)
		checkbox.addEventListener("change", () => {
			entry.enabled = checkbox.checked
			generateReportLines(entries, showDisabled)
		})
		const textSpan = reportLine.querySelector("span")!
		textSpan.textContent = entry.text
		reportText.appendChild(reportLine)
	}
}

export function getMetricsFromAttrs<T extends ApiAttributeIdentifier>(
	attrs: T[],
	tranformer: (attr: T) => number
): Partial<SolutionMetrics> {
	const reportedMetrics: Partial<SolutionMetrics> = {}
	const timeMetric = attrs.find(
		report => report.metric === "time" && report.rule_type === "steam"
	)
	if (timeMetric) {
		reportedMetrics.timeLeft = tranformer(timeMetric)
	}
	const scoreMetric = attrs.find(
		report => report.metric === "score" && report.rule_type === "steam"
	)
	if (scoreMetric) {
		reportedMetrics.points = tranformer(scoreMetric)
	}
	return reportedMetrics
}

export async function openScoreReportGenDialog(pager: Pager): Promise<void> {
	const set = pager.loadedSet

	if (
		!pager.settings.optimizerId ||
		set === null ||
		!set.scriptRunner.state.scriptTitle ||
		!(set.scriptRunner.state.scriptTitle in setNameToScoreboardName)
	)
		return
	resetListeners(scoreReportGenDialog)

	const [reportMode, setName] =
		setNameToScoreboardName[set.scriptRunner.state.scriptTitle]!
	let reportsInfo
	let setInfo

	scoreReportGenDialog.setAttribute("stage", "loading")

	scoreReportGenDialog.showModal()

	try {
		reportsInfo = await getPlayerPackDetails(
			pager.settings.optimizerId,
			setName
		)
		setInfo = await tryGetRRPackLevels(setName)
	} catch (err) {
		scoreReportGenDialog.setAttribute("stage", "error")
		scoreReportGenDialog.querySelector(".errorField")!.textContent = (
			err as Error
		).message
		return
	}

	const sortedLevels = Object.values(set.seenLevels)
		.map(record => record.levelInfo)
		.sort((a, b) => (a.levelNumber ?? 0) - (b.levelNumber ?? 0))

	const entries: ReportEntry[] = []

	for (const levelRecord of sortedLevels) {
		const levelN = levelRecord.levelNumber!

		const reportedAttrs = reportsInfo.scores.levels[levelN.toString()] ?? []
		const setAttrs = setInfo[levelN - 1].level_attribs

		const metrics = findBestMetrics(levelRecord)
		if (metrics.timeLeft !== undefined) {
			metrics.timeLeft = Math.ceil(metrics.timeLeft)
		}
		const reportedMetrics = getMetricsFromAttrs(
			reportedAttrs,
			attr => attr.reported_value
		)

		let betterMetric = false

		for (const [metricName, userMetric] of Object.entries(metrics)) {
			// Real time isn't generally reported
			if (metricName === "realTime") continue
			if (
				reportedMetrics[metricName as keyof SolutionMetrics] === undefined ||
				reportedMetrics[metricName as keyof SolutionMetrics]! < userMetric
			) {
				betterMetric = true
				break
			}
		}

		if (!betterMetric) continue

		const boldMetrics = getMetricsFromAttrs<
			ApiRRPackLevelAttribute | ApiPackLevelAttribute
		>(setAttrs, attr => attr.attribs.highest_reported)

		let confirmedMetrics: Partial<SolutionMetrics> = {}
		if ("highest_confirmed" in setAttrs[0].attribs) {
			confirmedMetrics = getMetricsFromAttrs(
				setAttrs as ApiRRPackLevelAttribute[],
				attr => attr.attribs.highest_confirmed
			)
		}

		const level: ReportLevel = {
			levelN,
			levelName: levelRecord.title!,
			reportedMetrics,
			metrics,
			boldMetrics,
			confirmedMetrics,
		}

		entries.push({ enabled: true, text: makeReportText(level, reportMode) })
	}

	generateReportLines(entries, true)
	const setNameEl = scoreReportGenDialog.querySelector(".setName")
	if (setNameEl) {
		setNameEl.textContent = setName.toUpperCase()
		if (reportMode === "cc1") {
			setNameEl.textContent += " (Steam)"
		}
	}

	const reportText =
		scoreReportGenDialog.querySelector<HTMLDivElement>("#reportText")!
	const copyReportButton =
		scoreReportGenDialog.querySelector<HTMLButtonElement>("#copyReport")
	copyReportButton?.addEventListener("click", () => {
		// Stupid, but it works!
		generateReportLines(entries, false)
		navigator.clipboard.writeText(reportText.innerText)
		generateReportLines(entries, true)
	})

	scoreReportGenDialog.setAttribute("stage", "default")
}
