import { CameraType, LevelData, createLevelFromData } from "@notcc/logic"
import { GameRenderer } from "./GameRenderer"
import { useAtomValue, useSetAtom } from "jotai"
import { tilesetAtom } from "./Preloader"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { IntervalTimer } from "@/helpers"
import { embedReadyAtom, embedModeAtom } from "@/routing"
import { MobileControls } from "./MobileControls"
import { keyboardEventSource, useKeyInputs } from "@/inputs"

// A TW unit is 0.25rem
function twUnit(tw: number): number {
	const rem = parseFloat(getComputedStyle(document.body).fontSize)
	return rem * tw * 0.25
}

export function useAutoScale(args: {
	tileSize: number
	cameraType: CameraType
	twPadding?: [number, number]
	tilePadding?: [number, number]
	safetyCoefficient?: number
}) {
	const [scale, setScale] = useState(1)
	function resize() {
		const sidebar = document.querySelector<HTMLDivElement>("#sidebar")
		if (!sidebar) return
		const sidebarRect = sidebar.getBoundingClientRect()
		const availableSize = document.body.getBoundingClientRect()
		if (sidebarRect.width > sidebarRect.height) {
			availableSize.height -= sidebarRect.height
		} else {
			availableSize.width -= sidebarRect.width
		}
		availableSize.width -= twUnit(args.twPadding?.[0] ?? 0)
		availableSize.height -= twUnit(args.twPadding?.[1] ?? 0)
		availableSize.width *= args.safetyCoefficient ?? 0.97
		availableSize.height *= args.safetyCoefficient ?? 0.97

		const xTiles = args.cameraType.width + (args.tilePadding?.[0] ?? 0)
		const yTiles = args.cameraType.height + (args.tilePadding?.[1] ?? 0)

		const xScale = availableSize.width / (xTiles * args.tileSize)
		const yScale = availableSize.height / (yTiles * args.tileSize)

		const scale = Math.min(xScale, yScale)
		setScale(Math.floor(scale))
	}
	useEffect(() => {
		resize()
		window.addEventListener("resize", resize)
		return () => {
			window.removeEventListener("resize", resize)
		}
	}, [])
	return scale
}

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
	const scale = useAutoScale({
		cameraType: level.cameraType,
		tileSize: tileset.tileSize,
		twPadding: [2, 11],
	})

	return (
		<div class="box m-auto flex flex-col gap-1 p-1">
			<GameRenderer
				tileset={tileset}
				level={level}
				autoDraw={autoTick}
				tileScale={scale}
			/>
			<button class="h-8" onClick={() => setAutoTick(!autoTick)}>
				{!autoTick ? "Start" : "Stop"}
			</button>
			<div class="absolute md:hidden">
				<MobileControls handler={inputHandler} />
			</div>
		</div>
	)
}
