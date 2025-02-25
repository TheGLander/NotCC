import {
	AutoScaleConfig,
	DumbLevelPlayer,
	useAutoScale,
} from "@/components/DumbLevelPlayer"
import {
	SetIntermission,
	globalC2GGameModifiersAtom,
	goToNextLevelGs,
	levelSetAtom,
	setIntermissionAtom,
	useSwrLevel,
} from "../levelData"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { LevelControls, levelControlsAtom } from "@/components/Sidebar"
import { preferenceAtom } from "@/preferences"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { ReplayInputProvider } from "@notcc/logic"
import { useJotaiFn } from "@/helpers"
import { tilesetAtom } from "@/components/PreferencesPrompt/TilesetsPrompt"

export const endOnNonlegalGlitchAtom = preferenceAtom<boolean>(
	"endOnNonlegalGlitch",
	true
)

function SetIntermissionComponent({
	intermission,
}: {
	intermission: SetIntermission
}) {
	// Use the level player's scaling algorithm to roughly match the size of the intermission box
	// with the basic level player
	const tileset = useAtomValue(tilesetAtom)
	const tileSize = tileset?.tileSize ?? 32
	const scaleArgs = useMemo<AutoScaleConfig>(
		() => ({
			cameraType: { width: 10, height: 10 },
			tileSize: tileSize,
			twPadding: [2, 10],
		}),
		[tileset, tileSize]
	)
	const scale = useAutoScale(scaleArgs)
	const textboxSize = tileSize * scale * 10
	const [interruptPage, setInterruptPage] = useState(0)
	const setSetIntermission = useSetAtom(setIntermissionAtom)
	return (
		<div class="flex h-full content-center items-center">
			<div class="box m-auto flex w-min flex-col gap-1">
				<h3 class="text-xl">Set intermission</h3>
				<div
					class="bg-theme-950 flex items-center justify-center overflow-auto whitespace-pre-line p-1 text-center text-xl"
					style={{
						width: textboxSize,
						height: textboxSize,
						// fontSize: `${(tileSize * scale) / 2}px`,
						lineHeight: 1.5,
					}}
				>
					{intermission.text[interruptPage].trim()}
				</div>
				<div class="flex flex-row gap-1">
					<button
						class="ml-auto"
						disabled={interruptPage === 0}
						onClick={() => setInterruptPage(val => val - 1)}
					>
						Back
					</button>
					<button
						disabled={interruptPage === intermission.text.length - 1}
						onClick={() => setInterruptPage(val => val + 1)}
					>
						Next
					</button>
					<button onClick={() => setSetIntermission(null)}>Skip</button>
				</div>
			</div>
		</div>
	)
}

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

	const setIntermission = useAtomValue(setIntermissionAtom)

	if (setIntermission) {
		return <SetIntermissionComponent intermission={setIntermission} />
	}

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
