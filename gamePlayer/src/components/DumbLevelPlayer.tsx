import { LevelData, createLevelFromData } from "@notcc/logic"
import { GameRenderer } from "./GameRenderer"
import { useAtomValue, useSetAtom } from "jotai"
import { tilesetAtom } from "./Preloader"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { IntervalTimer } from "@/helpers"
import { embedReadyAtom, embedModeAtom } from "@/routing"
import { MobileControls } from "./MobileControls"
import { keyboardEventSource, useKeyInputs } from "@/inputs"

export function DumbLevelPlayer(props: { level: LevelData }) {
	const tileset = useAtomValue(tilesetAtom)
	if (!tileset) return <div class="box m-auto p-1">No tileset loaded.</div>

	const { inputs, releaseKeys, handler: inputHandler } = useKeyInputs()
	useEffect(() => {
		inputHandler.addEventSource(keyboardEventSource)
	})

	const level = useMemo(() => createLevelFromData(props.level), [props.level])
	useEffect(() => {
		level.gameInput = inputs
	}, [level])

	const tickLevel = useCallback(() => {
		level.tick()
		releaseKeys(level.releasedKeys)
	}, [level, releaseKeys])

	const [autoTick, setAutoTick] = useState(false)
	useEffect(() => {
		if (!autoTick) return
		const timer = new IntervalTimer(() => tickLevel(), 1 / 60)
		return () => timer.cancel()
	}, [autoTick, level])

	const embedMode = useAtomValue(embedModeAtom)
	const setEmbedReady = useSetAtom(embedReadyAtom)
	useEffect(() => {
		if (!embedMode) return
		setEmbedReady(true)
	}, [embedMode])

	return (
		<div class="box m-auto flex flex-col gap-1 p-1">
			<GameRenderer
				tileset={tileset}
				level={level}
				autoDraw={autoTick}
				tileScale={4}
			/>
			<button onClick={() => setAutoTick(!autoTick)}>
				{!autoTick ? "Start" : "Stop"}
			</button>
			<div class="absolute md:hidden">
				<MobileControls handler={inputHandler} />
			</div>
		</div>
	)
}
