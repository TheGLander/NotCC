import { DumbLevelPlayer } from "@/components/DumbLevelPlayer"
import { levelSetAtom, useSwrLevel } from "../levelData"
import { useAtomValue, useSetAtom } from "jotai"
import { levelControlsAtom } from "@/components/Sidebar"

export function LevelPlayerPage() {
	const level = useSwrLevel()
	const set = useAtomValue(levelSetAtom)
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
