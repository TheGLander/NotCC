import { DumbLevelPlayer } from "@/components/DumbLevelPlayer"
import { useSwrLevel } from "../levelData"

export function LevelPlayerPage() {
	const level = useSwrLevel()
	if (level === null) {
		return <div class="box m-auto">Fetching level data...</div>
	}
	return (
		<div class="flex h-full content-center items-center">
			<DumbLevelPlayer level={level} />
		</div>
	)
}
