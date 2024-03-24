import { DumbLevelPlayer } from "@/components/DumbLevelPlayer"
import {
	levelControlsAtom,
	levelSetUnwrappedAtom,
	useSwrLevel,
} from "../levelData"
import { useAtomValue, useSetAtom } from "jotai"

export function LevelPlayerPage() {
	const level = useSwrLevel()
	const set = useAtomValue(levelSetUnwrappedAtom)
	const setControls = useSetAtom(levelControlsAtom)
	if (level === null) {
		return <div class="box m-auto">Fetching level data...</div>
	}
	return (
		<div class="flex h-full content-center items-center">
			<DumbLevelPlayer
				level={level}
				levelSet={set ?? undefined}
				controlsRef={controls => {
					setControls(controls ?? {})
				}}
			/>
		</div>
	)
}
