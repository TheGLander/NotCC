import { LevelData, createLevelFromData } from "@notcc/logic"
import { GameRenderer } from "./GameRenderer"
import { useAtomValue } from "jotai"
import { tilesetAtom } from "./Preloader"
import { useEffect, useMemo, useState } from "preact/hooks"
import { IntervalTimer } from "@/helpers"

export function DumbLevelPlayer(props: { level: LevelData }) {
	const tileset = useAtomValue(tilesetAtom)
	if (!tileset) return <div class="box m-auto p-1">No tileset loaded.</div>

	const level = useMemo(() => createLevelFromData(props.level), [props.level])

	const [autoTick, setAutoTick] = useState(false)
	useEffect(() => {
		if (!autoTick) return
		const timer = new IntervalTimer(() => level.tick(), 1 / 60)
		return () => timer.cancel()
	}, [autoTick, level])

	return (
		<div class="box m-auto flex flex-col gap-1 p-1">
			<GameRenderer
				tileset={tileset}
				level={level}
				autoDraw={autoTick}
				tileScale={10}
			/>
			<button onClick={() => setAutoTick(!autoTick)}>
				{!autoTick ? "Start" : "Stop"}
			</button>
		</div>
	)
}
