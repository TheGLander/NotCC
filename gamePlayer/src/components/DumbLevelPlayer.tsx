import {
	InputType,
	KeyInputs,
	LevelData,
	createLevelFromData,
} from "@notcc/logic"
import { GameRenderer } from "./GameRenderer"
import { useAtomValue, useSetAtom } from "jotai"
import { tilesetAtom } from "./Preloader"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { IntervalTimer, TimeoutTimer } from "@/helpers"
import { embedReadyAtom, embedModeAtom } from "@/routing"

type RepeatKeyType = "released" | "held" | "repeated"

interface RepeatKeyEvent {
	code: string
	state: RepeatKeyType
}

const KEY_REPEAT_DELAY = 0.25

function useRepeatKeyListener(listener: (state: RepeatKeyEvent) => void) {
	const repeatTimerRef = useRef<TimeoutTimer | null>(null)
	const repeatCodeRef = useRef<string | null>(null)

	useEffect(() => {
		const onListener = (ev: KeyboardEvent) => {
			if (ev.repeat) return
			repeatTimerRef.current?.cancel()
			if (repeatCodeRef.current) {
				listener({ code: repeatCodeRef.current, state: "held" })
				repeatCodeRef.current = null
			}
			repeatTimerRef.current = new TimeoutTimer(() => {
				repeatCodeRef.current = ev.code
				listener({ state: "repeated", code: ev.code })
			}, KEY_REPEAT_DELAY)
			listener({ state: "held", code: ev.code })
		}
		const offListener = (ev: KeyboardEvent) => {
			repeatTimerRef.current?.cancel()
			if (repeatCodeRef.current && repeatCodeRef.current !== ev.code) {
				listener({ code: repeatCodeRef.current, state: "held" })
			}
			repeatCodeRef.current = null
			listener({ code: ev.code, state: "released" })
		}
		document.addEventListener("keydown", onListener)
		document.addEventListener("keyup", offListener)
		return () => {
			document.removeEventListener("keydown", onListener)
			document.removeEventListener("keyup", offListener)
			repeatTimerRef.current?.cancel()
		}
	}, [listener])
}

const keyToInputMap: Record<string, InputType> = {
	ArrowUp: "up",
	ArrowRight: "right",
	ArrowDown: "down",
	ArrowLeft: "left",
	KeyZ: "drop",
	KeyX: "rotateInv",
	KeyC: "switchPlayable",
}

function useKeyInputs(
	keySource: (listener: (ev: RepeatKeyEvent) => void) => void
): {
	inputs: KeyInputs
	releaseKeys: (keys: KeyInputs) => void
} {
	const { current: repeatInputs } = useRef<KeyInputs>({
		up: false,
		right: false,
		down: false,
		left: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	})
	const { current: gameInputs } = useRef<KeyInputs>({
		up: false,
		right: false,
		down: false,
		left: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	})
	keySource(ev => {
		const key = keyToInputMap[ev.code]
		if (!key) return
		repeatInputs[key] = ev.state === "repeated"
		gameInputs[key] = ev.state !== "released"
	})
	const releaseKeys = useCallback((releaseInputs: KeyInputs) => {
		if (releaseInputs.up && !repeatInputs.up) gameInputs.up = false
		if (releaseInputs.right && !repeatInputs.right) gameInputs.right = false
		if (releaseInputs.down && !repeatInputs.down) gameInputs.down = false
		if (releaseInputs.left && !repeatInputs.left) gameInputs.left = false
		if (releaseInputs.drop && !repeatInputs.drop) gameInputs.drop = false
		if (releaseInputs.rotateInv && !repeatInputs.rotateInv)
			gameInputs.rotateInv = false
		if (releaseInputs.switchPlayable && !repeatInputs.switchPlayable)
			gameInputs.switchPlayable = false
	}, [])
	return {
		inputs: gameInputs,
		releaseKeys: releaseKeys,
	}
}

export function DumbLevelPlayer(props: { level: LevelData }) {
	const tileset = useAtomValue(tilesetAtom)
	if (!tileset) return <div class="box m-auto p-1">No tileset loaded.</div>

	const level = useMemo(() => createLevelFromData(props.level), [props.level])
	const { inputs, releaseKeys } = useKeyInputs(useRepeatKeyListener)
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
		</div>
	)
}
