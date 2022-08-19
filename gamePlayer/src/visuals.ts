import { Direction } from "@notcc/logic"
import { LevelState, crossLevelData } from "@notcc/logic"
import ogData from "./cc2ImageFormat"
import { SizedWebGLTexture, WebGLRenderer } from "./rendering"
import { keyNameList } from "@notcc/logic"
import { Actor } from "@notcc/logic"
import { artDB } from "./const"
import { Layer } from "@notcc/logic"
import { Wirable, WireOverlapMode, Wires } from "@notcc/logic"
import { Tile } from "@notcc/logic"

function getArt(actor: Actor): ActorArt[] {
	let art = artDB[actor.id]
	if (!art) return [{ actorName: "unknown" }]
	if (typeof art === "function") art = art(actor)
	if (art instanceof Array)
		return art.filter<ActorArt>((art): art is ActorArt => !!art)
	else return [art]
}

function getFloorArt(tile: Tile): ActorArt[] {
	let art = artDB["floor"]
	if (!art) return [{ actorName: "unknown" }]
	// Hack, as the floor art code takes any wirable, not onlt actors
	if (typeof art === "function") art = art(tile as Wirable as Actor)
	if (art instanceof Array)
		return art.filter<ActorArt>((art): art is ActorArt => !!art)
	else return [art]
}

export interface ActorArt {
	actorName: string | null
	/**
	 * Name of the art piece to display, "default" by default, if null, doesn't draw anything
	 */
	animation?: string | null
	frame?: number
	/**
	 * Offsets the art by a certain amount, 0 is up/left, 1 is bottom/right, [0, 0] by default
	 */
	imageOffset?: [number, number]
	/**
	 * Crops the art by a certain amount `1` is one tile worth of art, [1, 1] by default
	 */
	cropSize?: [number, number]
	/**
	 * Offsets the source image frame by a certain amount.
	 * [0, 0] by default
	 */
	sourceOffset?: [number, number]
}

type CC2Animation =
	| [number, number]
	| [[number, number], [number, number]]
	| [number, number][]

type CC2AnimationCollection = Record<string, CC2Animation>

export interface CC2ImageFormat {
	actorMapping: Record<string, CC2Animation | CC2AnimationCollection>
}

export interface InflatedCC2ImageFormat {
	actorMapping: Record<string, Record<string, [number, number][]>>
}

const renderer = new WebGLRenderer()
const itemCtx = document
	.createElement("canvas")
	.getContext("2d") as CanvasRenderingContext2D

async function removeBackground(link: string): Promise<HTMLCanvasElement> {
	const img = await new Promise<HTMLImageElement>((res, rej) => {
		const img = new Image()
		img.addEventListener("load", () => res(img))
		img.addEventListener("error", err => rej(err.error))
		img.src = link
	})
	const ctx = document.createElement("canvas").getContext("2d")
	if (!ctx) throw new Error("When does this even happen, anyways?")
	;[ctx.canvas.width, ctx.canvas.height] = [img.width, img.height]
	ctx.drawImage(img, 0, 0)
	const rawData = ctx.getImageData(0, 0, img.width, img.height)
	for (let i = 0; i < rawData.data.length; i += 4)
		if (
			rawData.data[i] === rawData.data[0] &&
			rawData.data[i + 1] === rawData.data[1] &&
			rawData.data[i + 2] === rawData.data[2]
		)
			rawData.data[i + 3] = 0

	ctx.putImageData(rawData, 0, 0)
	return ctx.canvas
}

const data: InflatedCC2ImageFormat = { actorMapping: {} }

// Convert the shortcutted image data to the full, bloat-ish version
for (const actorAnimsName in ogData.actorMapping) {
	data.actorMapping[actorAnimsName] = {}
	let actorAnims = ogData.actorMapping[actorAnimsName]
	if (actorAnims instanceof Array) actorAnims = { default: actorAnims }
	for (const actorAnimName in actorAnims) {
		const actorAnim = actorAnims[actorAnimName]
		if (actorAnim[0] instanceof Array) {
			if (actorAnim.length === 2) {
				data.actorMapping[actorAnimsName][actorAnimName] = []
				const animRanges = actorAnim as [[number, number], [number, number]]
				const reverseX = animRanges[0][0] > animRanges[1][0],
					reverseY = animRanges[0][1] > animRanges[1][1]
				for (
					let x = animRanges[0][0];
					reverseX ? x >= animRanges[1][0] : x <= animRanges[1][0];
					reverseX ? x-- : x++
				)
					for (
						let y = animRanges[0][1];
						reverseY ? y >= animRanges[1][1] : y <= animRanges[1][1];
						reverseY ? y-- : y++
					)
						data.actorMapping[actorAnimsName][actorAnimName].push([x, y])
			} else
				data.actorMapping[actorAnimsName][actorAnimName] = actorAnim as [
					number,
					number
				][]
		} else
			data.actorMapping[actorAnimsName][actorAnimName] = [
				actorAnim as [number, number],
			]
	}
}
/**
 * Converts a direction to x and y multipliers
 * @param direction
 */
function convertDirection(direction: Direction): [number, number] {
	switch (direction) {
		case Direction.UP:
			return [0, -1]
		case Direction.RIGHT:
			return [1, 0]
		case Direction.DOWN:
			return [0, 1]
		case Direction.LEFT:
			return [-1, 0]
	}
}

const tileSize = 32 as const

// TODO Custom tilsets
let fetchTiles = (async (): Promise<SizedWebGLTexture> =>
	renderer.addTexture(await removeBackground("./data/img/tiles.png")))()

export default class Renderer {
	ready: Promise<void>
	readyBool = false
	// @ts-expect-error We don't use it unless we have it
	renderTexture: SizedWebGLTexture

	/**
	 * Initializes the renderer, optional `this.ready` promise
	 * @param level
	 */
	constructor(
		public level: LevelState,
		public renderSpace?: HTMLElement | null,
		public itemSpace?: HTMLElement | null
	) {
		this.updateCameraSizes()
		this.ready = (async () => {
			this.renderTexture = await fetchTiles
			renderSpace?.appendChild(renderer.canvas)
			itemSpace?.appendChild(itemCtx.canvas)
			this.readyBool = true
		})()
	}
	updateCameraSizes(): void {
		renderer.scaling = 2
		;[renderer.canvas.width, renderer.canvas.height] = [
			this.level.cameraType.width * tileSize,
			this.level.cameraType.height * tileSize,
		]
		renderer.updateSize()
	}

	updateItems(): void {
		const player = this.level.selectedPlayable,
			expectedWidth = (player?.inventory.itemMax ?? 4) * tileSize,
			expectedHeight = 2 * tileSize
		if (
			itemCtx.canvas.width !== expectedWidth ||
			itemCtx.canvas.height !== expectedHeight
		) {
			itemCtx.canvas.width = (player?.inventory.itemMax ?? 4) * tileSize
			itemCtx.canvas.height = 2 * tileSize
		} else itemCtx.clearRect(0, 0, expectedWidth, expectedHeight)
		if (!player) return
		for (const [i, item] of player.inventory.items.entries()) {
			const artPiece = getArt(item)[0]
			if (!artPiece.actorName) continue
			const frame =
				data.actorMapping[artPiece.actorName]?.[
					artPiece.animation ?? "default"
				]?.[artPiece.frame ?? 0]
			if (!frame) continue
			itemCtx.drawImage(
				this.renderTexture.image as HTMLImageElement,
				frame[0] * tileSize,
				frame[1] * tileSize,
				tileSize,
				tileSize,
				i * tileSize,
				0,
				tileSize,
				tileSize
			)
		}
		let nonRegisteredOffset = keyNameList.length
		for (const key of Object.values(player.inventory.keys)) {
			if (key.amount <= 0) continue
			const artPiece = getArt(key.type)[0]
			if (!artPiece.actorName) continue

			const frame =
				data.actorMapping[artPiece.actorName]?.[
					artPiece.animation ?? "default"
				]?.[artPiece.frame ?? 0]

			if (!frame) continue
			let index = keyNameList.indexOf(key.type.id)
			if (index === -1) index = nonRegisteredOffset++
			itemCtx.drawImage(
				this.renderTexture.image as HTMLImageElement,
				frame[0] * tileSize,
				frame[1] * tileSize,
				tileSize,
				tileSize,
				index * tileSize,
				tileSize,
				tileSize,
				tileSize
			)
		}
	}
	/**
	 * Updates the positions of the rendred sprites
	 */
	frame(): void {
		if (!this.readyBool) return
		// Update the camera ASAP
		let cameraPos: [number, number] = [0, 0]
		if (this.level.selectedPlayable) {
			const movedPos = [
				this.level.selectedPlayable.tile.x,
				this.level.selectedPlayable.tile.y,
			]
			if (
				this.level.selectedPlayable.cooldown &&
				this.level.selectedPlayable.currentMoveSpeed
			) {
				const mults = convertDirection(this.level.selectedPlayable.direction)
				const offsetMult =
					1 -
					(this.level.selectedPlayable.currentMoveSpeed -
						this.level.selectedPlayable.cooldown +
						1) /
						this.level.selectedPlayable.currentMoveSpeed
				movedPos[0] -= offsetMult * mults[0]
				movedPos[1] -= offsetMult * mults[1]
			}
			cameraPos = [
				Math.max(
					0,
					Math.min(
						movedPos[0] + 0.5,
						this.level.width - this.level.cameraType.width / 2
					) -
						this.level.cameraType.width / 2
				),
				Math.max(
					0,
					Math.min(
						movedPos[1] + 0.5,
						this.level.height - this.level.cameraType.height / 2
					) -
						this.level.cameraType.height / 2
				),
			]
			renderer.cameraPosition = [
				cameraPos[0] * tileSize,
				cameraPos[1] * tileSize,
			]
		}
		const drawArt = (
			arr: ActorArt[],
			x: number,
			y: number,
			colorMult?: [number, number, number, number],
			desaturate: boolean = false
		) => {
			for (const art of arr) {
				if (!art) continue
				if (art.actorName === null || art.animation === null) continue
				const frame =
					data.actorMapping[art.actorName]?.[art.animation ?? "default"]?.[
						art.frame ?? 0
					] ?? data.actorMapping.floor.default[0]
				const croppedSize = art.cropSize ?? [1, 1]
				renderer.drawImage(
					this.renderTexture,
					frame[0] * tileSize + (art.sourceOffset?.[0] ?? 0) * tileSize,
					frame[1] * tileSize + (art.sourceOffset?.[1] ?? 0) * tileSize,
					croppedSize[0] * tileSize,
					croppedSize[1] * tileSize,
					Math.floor((x + (art.imageOffset?.[0] ?? 0)) * tileSize),
					Math.floor((y + (art.imageOffset?.[1] ?? 0)) * tileSize),
					croppedSize[0] * tileSize,
					croppedSize[1] * tileSize,
					colorMult,
					desaturate
				)
			}
		}
		const drawActor = (
			actor: Actor,
			x: number,
			y: number,
			colorMult?: [number, number, number, number],
			desaturate?: boolean
		) => {
			const movedPos = [x, y]
			if (actor.cooldown && actor.currentMoveSpeed) {
				const mults = convertDirection(actor.direction)
				const offsetMult =
					1 - (actor.currentMoveSpeed - actor.cooldown) / actor.currentMoveSpeed
				movedPos[0] -= offsetMult * mults[0]
				movedPos[1] -= offsetMult * mults[1]
			}
			drawArt(getArt(actor), movedPos[0], movedPos[1], colorMult, desaturate)
		}
		for (let layer = Layer.STATIONARY; layer <= Layer.SPECIAL; layer++)
			for (
				let x = Math.max(0, Math.floor(cameraPos[0] - 1));
				x <= Math.ceil(cameraPos[0] + this.level.cameraType.width + 1) &&
				x < this.level.width;
				x++
			)
				for (
					let y = Math.max(0, Math.floor(cameraPos[1] - 1));
					y <= Math.ceil(cameraPos[1] + this.level.cameraType.height + 1) &&
					y < this.level.height;
					y++
				) {
					if (
						layer === Layer.STATIONARY &&
						!this.level.field[x][y].hasLayer(Layer.STATIONARY)
					)
						drawArt(getFloorArt(this.level.field[x][y]), x, y)
					else
						for (const actor of this.level.field[x][y][layer])
							drawActor(actor, x, y)
				}
		if (crossLevelData.despawnedActors)
			for (const actor of crossLevelData.despawnedActors)
				drawActor(actor, actor.tile.x, actor.tile.y, [1, 1, 1, 0.75], true)
		this.updateItems()
	}
	destroy(): void {
		this.renderSpace?.removeChild(renderer.canvas)
		this.itemSpace?.removeChild(itemCtx.canvas)
	}
	async setTileset(tilesetImage: string): Promise<void> {
		this.readyBool = false
		fetchTiles = renderer.addTexture(await removeBackground(tilesetImage))
		this.renderTexture = await fetchTiles
		this.readyBool = true
	}
}

/**
 * Creates an art function for a generic directionable actor
 */
export const genericDirectionableArt =
	(name: string, animLength: number) =>
	(actor: Actor): ActorArt => ({
		actorName: name,
		animation: ["up", "right", "down", "left"][actor.direction],
		frame: actor.cooldown ? actor.level.currentTick % animLength : 0,
	})

export const genericAnimatedArt =
	(name: string, animLength: number, animationName?: string) =>
	(actor: Actor): ActorArt => ({
		actorName: name,
		animation: animationName,
		frame: actor.level.currentTick % animLength,
	})

export const genericStretchyArt =
	(name: string) =>
	(actor: Actor): ActorArt => {
		let frame = Math.floor(
			(actor.cooldown * (12 / (actor.currentMoveSpeed ?? 1))) / 1.5
		)
		if (actor.direction === 1 || actor.direction === 2) {
			frame = 7 - frame
		}
		const offset = 1 - actor.cooldown / (actor.currentMoveSpeed ?? 1)
		return !actor.cooldown
			? { actorName: name, animation: "idle" }
			: actor.direction % 2 === 0
			? {
					actorName: name,
					animation: frame === 0 ? "idle" : "vertical",
					frame: frame === 0 ? 0 : frame - 1,
					cropSize: [1, frame === 0 ? 1 : 2],
					imageOffset: [0, actor.direction >= 2 ? -offset : offset - 1],
			  }
			: {
					actorName: name,
					animation: frame === 0 ? "idle" : "horizontal",
					frame: frame === 0 ? 0 : frame - 1,
					cropSize: [frame === 0 ? 1 : 2, 1],
					imageOffset: [actor.direction < 2 ? -offset : offset - 1, 0],
			  }
	}

const WIRE_WIDTH = 1 / 32

export const wireBaseArt = (wires: Wires, poweredWires: Wires) => {
	const toDraw: ActorArt[] = [] // Just draw the four wire corner things
	// Also, don't do it in a loop, don't want the JITc to unroll the loops weirdly
	// Up
	if (wires & 0b0001) {
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b0001 ? "true" : "false",
			cropSize: [2 * WIRE_WIDTH, 0.5 + WIRE_WIDTH],
			imageOffset: [0.5 - WIRE_WIDTH, 0],
		})
	}
	// Right
	if (wires & 0b0010) {
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b0010 ? "true" : "false",
			cropSize: [0.5 + WIRE_WIDTH, 2 * WIRE_WIDTH],
			imageOffset: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
		})
	}
	// Down
	if (wires & 0b0100) {
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b0100 ? "true" : "false",
			cropSize: [2 * WIRE_WIDTH, 0.5 + WIRE_WIDTH],
			imageOffset: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
		})
	}
	// Left
	if (wires & 0b1000) {
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b1000 ? "true" : "false",
			cropSize: [0.5 + WIRE_WIDTH, 2 * WIRE_WIDTH],
			imageOffset: [0, 0.5 - WIRE_WIDTH],
		})
	}
	return toDraw
}

export const wireBaseExtendedCornersArt = (
	wires: Wires,
	poweredWires: Wires,
	longerCorners: Direction
) => {
	const toDraw: ActorArt[] = [] // Just draw the four wire corner things
	// Also, don't do it in a loop, don't want the JITc to unroll the loops weirdly
	// Up
	if (wires & 0b0001) {
		if (longerCorners === 1 && poweredWires & 0b0001)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
			})
		if (longerCorners === 3 && poweredWires & 0b0001)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
				imageOffset: [0.5 + WIRE_WIDTH, 0],
			})
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b0001 ? "true" : "false",
			cropSize: [2 * WIRE_WIDTH, 0.5 + WIRE_WIDTH],
			imageOffset: [0.5 - WIRE_WIDTH, 0],
		})
	}
	// Right
	if (wires & 0b0010) {
		if (longerCorners === 0 && poweredWires & 0b0010)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
				imageOffset: [0.5 + WIRE_WIDTH, 0.5 + WIRE_WIDTH],
			})
		if (longerCorners === 2 && poweredWires & 0b0010)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
				imageOffset: [0.5 + WIRE_WIDTH, 0],
			})
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b0010 ? "true" : "false",
			cropSize: [0.5 + WIRE_WIDTH, 2 * WIRE_WIDTH],
			imageOffset: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
		})
	}
	// Down
	if (wires & 0b0100) {
		if (longerCorners === 1 && poweredWires & 0b0100)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
				imageOffset: [0, 0.5 + WIRE_WIDTH],
			})
		if (longerCorners === 3 && poweredWires & 0b0100)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
				imageOffset: [0.5 + WIRE_WIDTH, 0.5 + WIRE_WIDTH],
			})
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b0100 ? "true" : "false",
			cropSize: [2 * WIRE_WIDTH, 0.5 + WIRE_WIDTH],
			imageOffset: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
		})
	}
	// Left
	if (wires & 0b1000) {
		if (longerCorners === 0 && poweredWires & 0b1000)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
				imageOffset: [0, 0.5 + WIRE_WIDTH],
			})
		if (longerCorners === 2 && poweredWires & 0b1000)
			toDraw.push({
				actorName: "wire",
				animation: "true",
				cropSize: [0.5 - WIRE_WIDTH, 0.5 - WIRE_WIDTH],
			})
		toDraw.push({
			actorName: "wire",
			animation: poweredWires & 0b1000 ? "true" : "false",
			cropSize: [0.5 + WIRE_WIDTH, 2 * WIRE_WIDTH],
			imageOffset: [0, 0.5 - WIRE_WIDTH],
		})
	}
	return toDraw
}

export const wireTunnelArt = (wireTunnels: Wires): ActorArt[] => {
	const toDraw: ActorArt[] = []
	if (wireTunnels & 0b0001)
		toDraw.push({
			actorName: "wireTunnel",
			animation: "0",
			cropSize: [1, 0.25],
		})
	if (wireTunnels & 0b0010)
		toDraw.push({
			actorName: "wireTunnel",
			animation: "1",
			cropSize: [0.25, 1],
			imageOffset: [0.75, 0],
		})
	if (wireTunnels & 0b0100)
		toDraw.push({
			actorName: "wireTunnel",
			animation: "2",
			cropSize: [1, 0.25],
			imageOffset: [0, 0.75],
		})
	if (wireTunnels & 0b1000)
		toDraw.push({
			actorName: "wireTunnel",
			animation: "3",
			cropSize: [0.25, 1],
		})
	return toDraw
}

export const wiredTerrainArt = (name: string) => (actor: Wirable) =>
	[
		{ actorName: name, animation: "wireBase" },
		...wireBaseArt(actor.wires, actor.poweredWires),
		{
			actorName: name,
			animation:
				actor.wires === 0b1111 &&
				actor.wireOverlapMode === WireOverlapMode.CROSS
					? "wireOverlapCross"
					: "wireOverlap",
		},
		...wireTunnelArt(actor.wireTunnels),
	]

export const genericWiredTerrainArt =
	(name: string, animName?: string, animLength?: number) => (actor: Actor) =>
		[
			{ actorName: "floor" },
			...wireBaseArt(actor.wires, actor.poweredWires),
			,
			{
				actorName: name,
				animation: animName,
				frame: animLength && actor.level.currentTick % animLength,
			},
		]
