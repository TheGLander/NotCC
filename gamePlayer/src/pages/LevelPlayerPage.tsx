import { DumbLevelPlayer } from "@/components/DumbLevelPlayer"
import { levelControlsAtom, useSwrLevel } from "../levelData"
import { useSetAtom } from "jotai"

export function LevelPlayerPage() {
	const level = useSwrLevel()
	const setControls = useSetAtom(levelControlsAtom)
	if (level === null) {
		return <div class="box m-auto">Fetching level data...</div>
	}
	return (
		<div class="flex h-full content-center items-center">
			<DumbLevelPlayer
				level={level}
				controlsRef={controls => {
					setControls(controls ?? {})
				}}
			/>
		</div>
	)
}
