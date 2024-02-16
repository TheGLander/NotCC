import {
	Inventory as InventoryI,
	cc1BootNameList,
	keyNameList,
} from "@notcc/logic"
import { Frame, Tileset } from "./GameRenderer/renderer"
import { Ref } from "preact"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { applyRef } from "@/helpers"
import { memo } from "preact/compat"

export const Inventory = memo(function Inventory(props: {
	inventory: InventoryI | { current: InventoryI }
	cc1Boots?: boolean
	tileScale: number
	tileset: Tileset
	renderRef?: Ref<(() => void) | undefined | null>
}) {
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	const ctx = useMemo(() => canvas?.getContext("2d"), [canvas])
	const tileSize = props.tileset.tileSize * props.tileScale
	const sTileSize = props.tileset.tileSize
	const render = useCallback(() => {
		if (!ctx) return

		function drawFloor(x: number, y: number) {
			// TODO Don't tie this to the default ArtSet
			const floorFrame = (props.tileset.art.floor! as { base: Frame }).base
			ctx!.drawImage(
				props.tileset.image,
				floorFrame[0] * sTileSize,
				floorFrame[1] * sTileSize,
				sTileSize,
				sTileSize,
				x * sTileSize,
				y * sTileSize,
				sTileSize,
				sTileSize
			)
		}
		function drawItem(id: string, x: number, y: number) {
			let art = props.tileset.art.artMap[id]!
			if (!(art instanceof Array)) {
				if (art.type !== "animated") {
					console.warn(`Art for ${id} too complex for inventory.`)
					return
				}
				art = art.frames[art.baseFrame ?? 0]
			}
			ctx!.drawImage(
				props.tileset.image,
				art[0] * sTileSize,
				art[1] * sTileSize,
				sTileSize,
				sTileSize,
				x * sTileSize,
				y * sTileSize,
				sTileSize,
				sTileSize
			)
		}
		const inv =
			"current" in props.inventory ? props.inventory.current! : props.inventory

		canvas!.width = inv.itemMax * sTileSize
		canvas!.style.width = `${inv.itemMax * tileSize}px`
		canvas!.height = 2 * sTileSize
		canvas!.style.height = `${2 * tileSize}px`

		if (props.cc1Boots) {
			for (const [idx, itemId] of Object.entries(cc1BootNameList)) {
				const hasBoot = inv.items.some(item => item.id === itemId)
				drawFloor(parseInt(idx), 0)
				if (!hasBoot) continue
				drawItem(itemId, parseInt(idx), 0)
			}
		} else {
			for (let idx = 0; idx < inv.itemMax; idx += 1) {
				const item = inv.items[idx]
				drawFloor(idx, 0)
				if (item) {
					drawItem(item.id, idx, 0)
				}
			}
		}
		for (const [idxStr, keyId] of Object.entries(keyNameList)) {
			const idx = parseInt(idxStr)
			const keyN = inv.keys[keyId]?.amount

			drawFloor(idx, 1)
			if (!keyN || keyN < 1) continue

			drawItem(keyId, idx, 1)
			if (keyN > 1) {
				const digitFrame = props.tileset.art.letters[keyN > 9 ? "+" : keyN]
				ctx.drawImage(
					props.tileset.image,
					digitFrame[0] * sTileSize,
					digitFrame[1] * sTileSize,
					sTileSize / 2,
					sTileSize / 2,
					(idx + 0.5) * sTileSize,
					sTileSize * 1.5,
					sTileSize / 2,
					sTileSize / 2
				)
			}
		}
	}, [props.tileset, props.cc1Boots, props.tileScale, ctx, props.inventory])
	useEffect(() => {
		render()
	}, [render])

	useEffect(() => {
		if (props.renderRef) {
			applyRef(props.renderRef, render)
		}
	}, [props.renderRef, render])

	return (
		<canvas
			class="[image-rendering:pixelated]"
			ref={ref => setCanvas(ref)}
		></canvas>
	)
})
