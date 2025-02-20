import { goToLevelNGs, levelSetAtom, levelSetChangedAtom } from "@/levelData"
import { PromptComponent } from "@/prompts"
import {
	FullC2GLevelSet,
	SolutionMetrics,
	metricsFromAttempt,
	protobuf,
} from "@notcc/logic"
import { useAtomValue } from "jotai"
import { Dialog } from "./Dialog"
import { useMemo } from "preact/hooks"
import { formatTimeLeft, useJotaiFn } from "@/helpers"
import { twJoin } from "tailwind-merge"
import { preferenceAtom } from "@/preferences"

export const showDecimalsInLevelListAtom = preferenceAtom(
	"showDecimalsInLevelList",
	false
)

function findBestMetrics(
	levelN: number,
	attempts: protobuf.IAttemptInfo[]
): SolutionMetrics | null {
	let metrics: SolutionMetrics | null = null
	for (const attempt of attempts) {
		if (!attempt.solution?.outcome) continue
		const attMetrics = metricsFromAttempt(levelN, attempt.solution.outcome)
		if (!metrics) {
			metrics = attMetrics
			continue
		}
		if (attMetrics.timeLeft > metrics.timeLeft) {
			metrics.timeLeft = attMetrics.timeLeft
		}
		if (attMetrics.realTime < metrics.realTime) {
			metrics.realTime = attMetrics.realTime
		}
		if (attMetrics.points > metrics.points) {
			metrics.points = attMetrics.points
		}
	}
	return metrics
}

interface LevelListLevel {
	metrics: SolutionMetrics | null
	info: protobuf.ILevelInfo
}

export const LevelListPrompt: PromptComponent<void> = props => {
	const levelSet = useAtomValue(levelSetAtom)
	useAtomValue(levelSetChangedAtom)
	const levels = useMemo<LevelListLevel[]>(() => {
		return (
			levelSet?.listLevels().map(lvl => ({
				info: lvl.levelInfo,
				metrics: findBestMetrics(
					lvl.levelInfo.levelNumber!,
					lvl.levelInfo.attempts ?? []
				),
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
					acc + (val.metrics?.timeLeft ? Math.ceil(val.metrics.timeLeft) : 0),
				0
			),
		[]
	)
	const totalScore = useMemo(
		() => levels.reduce((acc, val) => acc + (val.metrics?.points ?? 0), 0),
		[]
	)
	// const _setIsLinear = levelSet instanceof LinearLevelSet
	const setIsIncomplete =
		levelSet instanceof FullC2GLevelSet && !levelSet.hasReahedPostgame
	const goToLevelN = useJotaiFn(goToLevelNGs)
	const showDecimals = useAtomValue(showDecimalsInLevelListAtom)

	const GRID_ROW = "bg-theme-900 col-span-full grid grid-cols-subgrid px-4"
	function ScriptPseudoLevel(_props: {
		type: "prologue" | "epilogue"
		levelN: number
	}) {
		return (
			<div
				class={twJoin(
					GRID_ROW,
					"hover:bg-theme-950 my-[calc(-1_*_theme(spacing.1))] cursor-pointer rounded-md py-0.5 text-sm"
				)}
			>
				<div class="text-right">📜︎</div>
				<div>Intermission</div>
			</div>
		)
	}
	return (
		<Dialog
			header="Level list"
			buttons={[["Close", () => {}]]}
			onResolve={props.onResolve}
		>
			{/* 	<h3 class="text-xl">{levelSet?.gameTitle()}</h3> */}
			{/* <div></div> */}
			<div class="grid gap-x-4 gap-y-2 [grid:auto-flow/auto_1fr_auto_auto]">
				<div
					class={twJoin(
						GRID_ROW,
						"border-b-theme-800 sticky top-0 rounded-b-md border-b-2 px-4 pb-0.5 shadow"
					)}
				>
					<div class="text-right">#</div>
					<div>Title</div>
					<div class="text-center">Best time</div>
					<div class="text-center">Best score</div>
				</div>
				{levels.map(({ info, metrics }) => (
					<>
						{info.prologueText && (
							<ScriptPseudoLevel type="prologue" levelN={info.levelNumber!} />
						)}
						<div
							class={twJoin(
								GRID_ROW,
								"hover:bg-theme-950 cursor-pointer rounded-md px-4 py-0.5",
								levelSet?.currentLevel === info.levelNumber && "bg-theme-950"
							)}
							onClick={async () => {
								await goToLevelN(info.levelNumber!)
								props.onResolve()
							}}
						>
							<div class="text-right">{info.levelNumber}</div>
							<div>{info.title}</div>
							<div class="text-right">
								{metrics?.timeLeft != null
									? showDecimals
										? formatTimeLeft(metrics.timeLeft * 60, false)
										: Math.ceil(metrics.timeLeft)
									: "—"}
							</div>
							<div class="text-right">
								{metrics?.points != null ? metrics.points : "—"}
							</div>
						</div>
						{info.epilogueText && (
							<ScriptPseudoLevel type="epilogue" levelN={info.levelNumber!} />
						)}
					</>
				))}
				{setIsIncomplete && (
					<div class="col-span-full self-center px-2 text-sm">
						Set list is incomplete; try going forwards from the last level
					</div>
				)}
				<div
					class={twJoin(
						GRID_ROW,
						"border-t-theme-800 sticky bottom-0 z-10 rounded-t-md border-t-2 pt-0.5"
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
