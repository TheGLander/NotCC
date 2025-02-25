import { DumbLevelPlayer } from "@/components/DumbLevelPlayer"
import {
	globalC2GGameModifiersAtom,
	goToNextLevelGs,
	levelSetAtom,
	useSwrLevel,
} from "../levelData"
import { useAtom, useAtomValue } from "jotai"
import { LevelControls, levelControlsAtom } from "@/components/Sidebar"
import { preferenceAtom } from "@/preferences"
import { useCallback, useEffect, useRef } from "preact/hooks"
import { ReplayInputProvider } from "@notcc/logic"
import { useJotaiFn } from "@/helpers"

export const endOnNonlegalGlitchAtom = preferenceAtom<boolean>(
	"endOnNonlegalGlitch",
	true
)

export function LevelPlayerPage() {
	const level = useSwrLevel()
	const set = useAtomValue(levelSetAtom)
	const gameModifiers = useAtomValue(globalC2GGameModifiersAtom)
	const endOnNonlegalGlitch = useAtomValue(endOnNonlegalGlitchAtom)
	const [controls, setControls] = useAtom(levelControlsAtom)

	const lastLevelRef = useRef(level)
	const tryApplyC2GReplay = useCallback(
		(controls: LevelControls) => {
			if (lastLevelRef.current === level) return
			lastLevelRef.current = level
			if (!gameModifiers.autoPlayReplay || !level?.replay) return

			controls.playInputs?.(new ReplayInputProvider(level.replay))
		},
		[gameModifiers, level]
	)
	useEffect(() => {
		if (controls) {
			tryApplyC2GReplay(controls)
		}
	}, [controls, tryApplyC2GReplay])
	const goToNextLevel = useJotaiFn(goToNextLevelGs)
	const tryAdvanceC2GAutoAdvance = useCallback(() => {
		if (gameModifiers.autoNext) {
			goToNextLevel()
		}
	}, [gameModifiers])
	const controlsRefCallback = useCallback(
		(controls: LevelControls | null) => {
			setControls(controls ?? {})
			if (controls) {
				tryApplyC2GReplay(controls)
			}
		},
		[tryApplyC2GReplay, level]
	)

	if (level === null) {
		return <div class="box m-auto">Fetching level data...</div>
	}
	return (
		<div class="flex h-full content-center items-center">
			<DumbLevelPlayer
				level={level}
				levelSet={set ?? undefined}
				controlsRef={controlsRefCallback}
				endOnNonlegalGlitch={endOnNonlegalGlitch}
				levelFinished={tryAdvanceC2GAutoAdvance}
				speedMult={gameModifiers.speedMultiplier}
			/>
		</div>
	)
}
