import {
	goToLevelNGs,
	goToNextLevelGs,
	levelSetAtom,
	levelSetChangedAtom,
	setIntermissionAtom,
} from "@/levelData"
import { PromptComponent, showPromptGs } from "@/prompts"
import {
	FullC2GLevelSet,
	SolutionMetrics,
	findBestMetrics,
	protobuf,
} from "@notcc/logic"
import { useAtomValue, useSetAtom } from "jotai"
import { Dialog } from "./Dialog"
import { useCallback, useMemo } from "preact/hooks"
import { formatTimeLeft, useJotaiFn } from "@/helpers"
import { twJoin } from "tailwind-merge"
import { preferenceAtom } from "@/preferences"
import {
	ReportGrade,
	getReportGradesForMetrics,
	setPlayerScoresAtom,
	setScoresAtom,
} from "@/scoresApi"
import { Grade } from "./Grade"
import { ReportGeneratorPrompt } from "./ReportGenerator"

export const showTimeFractionInMetricsAtom = preferenceAtom(
	"showTimeFractionInMetrics",
	false
)

interface LevelListLevel {
	metrics: SolutionMetrics | null
	info: protobuf.ILevelInfo
}

export const LevelListPrompt: PromptComponent<void> = pProps => {
	const levelSet = useAtomValue(levelSetAtom)
	useAtomValue(levelSetChangedAtom)
	const levels = useMemo<LevelListLevel[]>(() => {
		return (
			levelSet?.listLevels().map(lvl => ({
				info: lvl.levelInfo,
				metrics: findBestMetrics(lvl.levelInfo),
			})) ?? []
		)
	}, [levelSet])
	const levelsBeaten = useMemo(
		() => levels.reduce((acc, val) => acc + (val.metrics ? 1 : 0), 0),
		[levels]
	)
	const totalTime = useMemo(
		() =>
			levels.reduce(
				(acc, val) =>
					acc +
					(val.metrics?.timeLeft ? Math.ceil(val.metrics.timeLeft / 60) : 0),
				0
			),
		[]
	)
	const totalScore = useMemo(
		() => levels.reduce((acc, val) => acc + (val.metrics?.score ?? 0), 0),
		[]
	)

	const setScores = useAtomValue(setScoresAtom)
	const setPlayerScores = useAtomValue(setPlayerScoresAtom)

	const showPrompt = useJotaiFn(showPromptGs)

	const showGrades = setScores && setPlayerScores

	// const _setIsLinear = levelSet instanceof LinearLevelSet
	const setIsIncomplete =
		levelSet instanceof FullC2GLevelSet && !levelSet.hasReahedPostgame
	const goToLevelN = useJotaiFn(goToLevelNGs)
	const goToNextLevel = useJotaiFn(goToNextLevelGs)
	const showFraction = useAtomValue(showTimeFractionInMetricsAtom)

	interface SetPseudoLevelProps {
		type: "prologue" | "epilogue"
		levelInfo: protobuf.ILevelInfo
		// Need to pass idx so that we can open the level *after* this one for epilogue intermissions
		levelIdx: number
	}
	const setSetIntermission = useSetAtom(setIntermissionAtom)

	const GRID_ROW = "bg-theme-900 col-span-full grid grid-cols-subgrid px-4"
	function ScriptPseudoLevel(props: SetPseudoLevelProps) {
		const showIntermission = useCallback(async () => {
			if (props.type === "epilogue") {
				const nextLevel = levels[props.levelIdx + 1]
				if (nextLevel === undefined) {
					// FIXME: hack: go to the last level and force the intermission to get the post-level state
					await goToLevelN(props.levelInfo.levelNumber!)
					await goToNextLevel()
				} else {
					await goToLevelN(nextLevel.info.levelNumber!)
				}
			} else {
				await goToLevelN(props.levelInfo.levelNumber!)
			}

			setSetIntermission({
				type: props.type,
				text: (props.type === "prologue"
					? props.levelInfo.prologueText
					: props.levelInfo.epilogueText)!,
			})
			pProps.onResolve()
		}, [props])

		return (
			<div
				tabindex={0}
				class={twJoin(
					GRID_ROW,
					"hover:bg-theme-950 my-[calc(-1_*_theme(spacing.1))] cursor-pointer rounded-md py-0.5 text-sm"
				)}
				onClick={showIntermission}
			>
				<div class="text-right">📜︎</div>
				<div>Intermission</div>
			</div>
		)
	}
	return (
		<Dialog
			header="Level list"
			buttons={[
				["Generate report", () => void showPrompt(ReportGeneratorPrompt)],
				["Close", () => pProps.onResolve()],
			]}
			onClose={pProps.onResolve}
		>
			{/* 	<h3 class="text-xl">{levelSet?.gameTitle()}</h3> */}
			{/* <div></div> */}
			<div
				class={twJoin(
					"grid gap-x-4 gap-y-2",
					"[grid:auto-flow/auto_1fr_auto_auto]"
				)}
			>
				<div
					class={twJoin(
						GRID_ROW,
						"border-b-theme-700 sticky top-0 rounded-b-md border-b-2 px-4 pb-0.5 shadow"
					)}
				>
					<div class="text-right">#</div>
					<div>Title</div>
					<div class="text-center">Best time</div>
					<div class="text-center">Best score</div>
				</div>
				{levels.map(({ info, metrics }, idx) => {
					const scoresLevel = setScores?.find(
						lvl => lvl.level === info.levelNumber
					)
					const grades =
						metrics && scoresLevel
							? getReportGradesForMetrics(metrics, scoresLevel)
							: {
									time: "unsolved" as ReportGrade,
									score: "unsolved" as ReportGrade,
								}
					return (
						<>
							{info.prologueText && (
								<ScriptPseudoLevel
									type="prologue"
									levelInfo={info}
									levelIdx={idx}
								/>
							)}
							<div
								class={twJoin(
									GRID_ROW,
									"hover:bg-theme-950 cursor-pointer rounded-md px-4 py-0.5",
									levelSet?.currentLevel === info.levelNumber && "bg-theme-950"
								)}
								tabindex={0}
								onClick={async () => {
									await goToLevelN(info.levelNumber!)
									pProps.onResolve()
								}}
							>
								<div class="text-right">{info.levelNumber}</div>
								<div>{info.title}</div>
								<div class="flex items-baseline justify-end gap-2">
									{metrics?.timeLeft != null
										? showFraction
											? formatTimeLeft(metrics.timeLeft, false)
											: Math.ceil(metrics.timeLeft / 60)
										: "—"}
									{showGrades && <Grade grade={grades.time} short />}
								</div>
								<div class="flex items-baseline justify-end gap-2">
									{metrics?.score != null ? metrics.score : "—"}
									{showGrades && <Grade grade={grades.score} short />}
								</div>
							</div>
							{info.epilogueText && (
								<ScriptPseudoLevel
									type="epilogue"
									levelInfo={info}
									levelIdx={idx}
								/>
							)}
						</>
					)
				})}
				{setIsIncomplete && (
					<div class="col-span-full self-center px-2 text-sm">
						Set list is incomplete; try going forwards from the last level
					</div>
				)}
				<div
					class={twJoin(
						GRID_ROW,
						"border-t-theme-700 sticky bottom-0 z-10 rounded-t-md border-t-2 pt-0.5"
					)}
				>
					<div class="col-span-2">
						{levelsBeaten}/{levels.length} solved
					</div>
					<div class="text-right">{totalTime}</div>
					<div class="text-right">{totalScore}</div>
				</div>
			</div>
		</Dialog>
	)
}
