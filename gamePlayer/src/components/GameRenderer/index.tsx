import { useEffect, useMemo, useState } from "preact/hooks"
import { Renderer, Tileset } from "./renderer"
import { LevelState } from "@notcc/logic"
import { Ref } from "preact"
import { AnimationTimer, applyRef } from "@/helpers"
import { twJoin } from "tailwind-merge"
import { memo } from "preact/compat"

export interface GameRendererProps {
	tileset: Tileset
	level: LevelState
	tileScale?: number
	class?: string
	autoDraw?: boolean
	renderRef?: Ref<() => void>
}

export const GameRenderer = memo(function GameRenderer(
	props: GameRendererProps
) {
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

	const renderer = useMemo(() => new Renderer(props.tileset), [])
	const ctx = useMemo(
		() => canvas?.getContext("2d", { alpha: false }),
		[canvas]
	)
	useEffect(() => {
		renderer.level = props.level
		renderer.cameraSize = props.level.cameraType
		renderer.tileset = props.tileset
		if (canvas) {
			renderer.updateTileSize(canvas)
			renderer.frame(ctx!)
		}
	}, [props.tileset, props.level, canvas])

	useEffect(() => {
		if (!props.autoDraw || !ctx) return
		let lastTick = -1
		const timer = new AnimationTimer(() => {
			const curTick = renderer.level!.currentTick * 3 + renderer.level!.subtick
			if (lastTick === curTick) return
			renderer.frame(ctx!)
			lastTick = curTick
		})
		return () => timer.cancel()
	}, [ctx, props.autoDraw])

	useEffect(() => {
		if (props.renderRef) {
			applyRef(props.renderRef, () => renderer.frame(ctx!))
		}
	}, [ctx, props.renderRef])

	return (
		<canvas
			ref={canvas => setCanvas(canvas)}
			class={twJoin("[image-rendering:pixelated]", props.class)}
			style={{
				width: `${
					props.tileset.tileSize *
					props.level.cameraType.width *
					(props.tileScale ?? 1)
				}px`,
				height: `${
					props.tileset.tileSize *
					props.level.cameraType.height *
					(props.tileScale ?? 1)
				}px`,
			}}
		></canvas>
	)
})
