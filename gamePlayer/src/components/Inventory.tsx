import { Inventory as InventoryI, PlayerSeat, TileType } from "@notcc/logic"
import { Frame, Tileset } from "./GameRenderer/renderer"
import { Ref } from "preact"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { applyRef } from "@/helpers"

export function Inventory(props: {
	inventory: InventoryI | PlayerSeat
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
		if (!ctx || !canvas) return

		function drawFloor(x: number, y: number) {
			// TODO Don't tie this to the default ArtSet
			const floorFrame = props.tileset.art.artMap.floor as Frame
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
			props.inventory instanceof PlayerSeat
				? props.inventory.actor?.inventory
				: props.inventory
		if (!inv) return

		canvas.width = 4 * sTileSize
		canvas.style.width = `${4 * tileSize}px`
		canvas.height = 2 * sTileSize
		canvas.style.height = `${2 * tileSize}px`

		function drawItemTile(idx: number, item: TileType | null) {
			drawFloor(idx, 0)
			if (item) {
				drawItem(item.name, idx, 0)
			}
		}
		drawItemTile(0, inv.item1)
		drawItemTile(1, inv.item2)
		drawItemTile(2, inv.item3)
		drawItemTile(3, inv.item4)
		function drawKey(idx: number, keyId: string, keyN: number) {
			drawFloor(idx, 1)
			if (!keyN || keyN < 1) return

			drawItem(keyId, idx, 1)
			if (keyN > 1) {
				const digitFrame = props.tileset.art.letters[keyN > 9 ? "+" : keyN]
				ctx!.drawImage(
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
		drawKey(0, "keyRed", inv.keysRed)
		drawKey(1, "keyBlue", inv.keysBlue)
		drawKey(2, "keyYellow", inv.keysYellow)
		drawKey(3, "keyGreen", inv.keysGreen)
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
}
