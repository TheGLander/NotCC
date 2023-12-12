import { useSwrLevel } from "../levelData"
import { levelNAtom, levelSetIdentAtom } from "../routing"
import { useAtomValue } from "jotai"

export function LevelPlayerPage() {
	const levelSetIdent = useAtomValue(levelSetIdentAtom)
	const levelN = useAtomValue(levelNAtom)
	const level = useSwrLevel()
	if (level === null) {
		return <div class="box m-auto">Fetching level data...</div>
	}
	return (
		<div class="box m-auto">
			This is sure playing {levelSetIdent} #{levelN}:{" "}
			{level.name ?? "[UNTITLED]"}
		</div>
	)
}
