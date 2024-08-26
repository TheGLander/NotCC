import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from "preact/hooks"
import { Renderer, Tileset } from "./renderer"
import { Level, PlayerSeat } from "@notcc/logic"
import { Ref as RefG } from "preact"
import { AnimationTimer, applyRef } from "@/helpers"
import { twJoin } from "tailwind-merge"
import { HTMLProps } from "preact/compat"

export interface CameraType {
	width: number
	height: number
}

export interface GameRendererProps extends HTMLProps<HTMLCanvasElement> {
	tileset: Tileset
	level: Level | { current: Level }
	tileScale?: number
	class?: string
	autoDraw?: boolean
	renderRef?: RefG<(() => void) | null | undefined>
	rendererRef?: RefG<Renderer>
	cameraType: CameraType
	playerSeat: PlayerSeat
}

export function GameRenderer(props: GameRendererProps) {
	const {
		tileset,
		level,
		tileScale,
		autoDraw,
		renderRef,
		rendererRef,
		cameraType,
		playerSeat,
		...canvasProps
	} = props
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

	const renderer = useMemo(() => new Renderer(props.tileset), [])
	useEffect(() => {
		applyRef(rendererRef, renderer)
	}, [renderer, rendererRef])
	const ctx = useMemo(
		() => canvas?.getContext("2d", { alpha: false }),
		[canvas]
	)
	useLayoutEffect(() => {
		renderer.level =
			"current" in props.level ? props.level.current : props.level
		renderer.cameraSize = props.cameraType
		renderer.playerSeat = props.playerSeat
		renderer.tileset = props.tileset
		if (canvas) {
			renderer.updateTileSize(canvas)
			renderer.frame(ctx!)
		}
	}, [props.tileset, props.cameraType, props.level, props.playerSeat, canvas])

	useLayoutEffect(() => {
		if (!props.autoDraw || !ctx) return
		let lastTick = -1
		const timer = new AnimationTimer(() => {
			const curTick =
				renderer.level!.currentTick * 3 + renderer.level!.currentSubtick
			if (lastTick === curTick) return
			renderer.frame(ctx!)
			lastTick = curTick
		})
		return () => timer.cancel()
	}, [ctx, props.autoDraw])
	const render = useCallback(() => {
		if ("current" in props.level) {
			renderer.level = props.level.current
		}
		renderer.frame(ctx!)
	}, [ctx, renderer, props.level])

	useLayoutEffect(() => {
		if (!props.renderRef) return
		applyRef(props.renderRef, render)
	}, [render, props.renderRef])

	return (
		<canvas
			{...canvasProps}
			ref={canvas => setCanvas(canvas)}
			class={twJoin("[image-rendering:pixelated]", props.class)}
			style={{
				width: `${
					props.tileset.tileSize *
					props.cameraType.width *
					(props.tileScale ?? 1)
				}px`,
				height: `${
					props.tileset.tileSize *
					props.cameraType.height *
					(props.tileScale ?? 1)
				}px`,
			}}
		></canvas>
	)
}
