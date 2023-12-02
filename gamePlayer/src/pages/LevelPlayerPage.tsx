import { levelNAtom, levelSetIdentAtom } from "../routing"
import { useAtomValue } from "jotai"

export function LevelPlayerPage() {
	const levelSetIdent = useAtomValue(levelSetIdentAtom)
	const levelN = useAtomValue(levelNAtom)
	return (
		<div class="box m-auto">
			This is sure playing {levelSetIdent} #{levelN}
		</div>
	)
}
