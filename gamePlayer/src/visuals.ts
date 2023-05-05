import { CameraType, Direction } from "@notcc/logic"
import { LevelState } from "@notcc/logic"
import { Actor } from "@notcc/logic"
import { artDB, Falsy } from "./const"
import { Layer } from "@notcc/logic"
import { Wirable, WireOverlapMode, Wires } from "@notcc/logic"
import { Tile } from "@notcc/logic"
import { keyNameList } from "@notcc/logic"

export type HTMLImage = HTMLImageElement | HTMLCanvasElement

export function fetchImage(link: string): Promise<HTMLImageElement> {
	return new Promise((res, rej) => {
		const img = new Image()
		img.addEventListener("load", () => res(img))
		img.addEventListener("error", err => rej(err.error))
		img.src = link
	})
}

export function removeBackground(image: HTMLImage): HTMLImage {
	const ctx = document
		.createElement("canvas")
		.getContext("2d", { willReadFrequently: true })
	if (!ctx) throw new Error("Couldn't create tileset canvas")
	;[ctx.canvas.width, ctx.canvas.height] = [image.width, image.height]
	ctx.drawImage(image, 0, 0)
	const rawData = ctx.getImageData(0, 0, image.width, image.height)
	const maskColor = rawData.data.slice(0, 4)
	for (let i = 0; i < rawData.data.length; i += 4)
		if (
			rawData.data[i] === maskColor[0] &&
			rawData.data[i + 1] === maskColor[1] &&
			rawData.data[i + 2] === maskColor[2] &&
			rawData.data[i + 3] === maskColor[3]
		)
			rawData.data[i + 3] = 0

	ctx.putImageData(rawData, 0, 0)
	return ctx.canvas
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

type ActorArtList = (ActorArt | Falsy)[]

type Frame = [number, number]

type CC2Animation = Frame | [Frame, Frame] | Frame[]

type CC2AnimationCollection = Record<string, CC2Animation>

export type TerseCC2FrameMap = Record<
	string,
	CC2Animation | CC2AnimationCollection
>

type CC2FrameMap = Record<string, Record<string, Frame[]>>

function generateFrameList(animation: CC2Animation): Frame[] {
	if (!(animation[0] instanceof Array)) {
		// This is a single frame
		return [animation as Frame]
	}
	if (animation.length === 2) {
		// When there are only two frames, treat it as an inclusive range between the two frame
		const frames: Frame[] = []
		const startFrame = animation[0]
		const endFrame = animation[1] as Frame
		const lengthX = endFrame[0] - startFrame[0]
		const lengthY = endFrame[1] - startFrame[1]
		for (let xi = 0; xi <= lengthX; xi++) {
			const x = startFrame[0] + (lengthX > 0 ? xi : -xi)
			for (let yi = 0; yi <= lengthY; yi++) {
				const y = startFrame[1] + (lengthY > 0 ? yi : -yi)
				frames.push([x, y])
			}
		}
		return frames
	}
	return animation as Frame[]
}

export function generateActorFrames(terseData: TerseCC2FrameMap): CC2FrameMap {
	const fullData: CC2FrameMap = {}
	for (const frameCollectionName in terseData) {
		const frameCollection: Record<string, Frame[]> = {}
		let terseFrameCollection = terseData[frameCollectionName]
		if (terseFrameCollection instanceof Array) {
			// If it's just a single frame list and not a collection, set the inlined animation to the `default` animation
			terseFrameCollection = { default: terseFrameCollection }
		}
		for (const animationName in terseFrameCollection) {
			frameCollection[animationName] = generateFrameList(
				terseFrameCollection[animationName]
			)
		}
		fullData[frameCollectionName] = frameCollection
	}
	return fullData
}

export interface Tileset {
	image: HTMLImage
	frameMap: CC2FrameMap
	wireWidth: number
	tileSize: number
}

function clamp(value: number, min: number, max: number): number {
	if (value < min) return min
	if (value > max) return max
	return value
}

export default class Renderer {
	ctx: CanvasRenderingContext2D
	itemCtx: CanvasRenderingContext2D | null = null
	cameraPosition: [number, number] = [0, 0]
	level: LevelState | null = null
	cameraSize: CameraType | null = null

	constructor(
		public tileset: Tileset,
		public viewportCanvas: HTMLCanvasElement,
		public itemCanvas?: HTMLCanvasElement
	) {
		// Get the viewport draw context
		const ctx = viewportCanvas.getContext("2d", {
			alpha: true,
		}) as CanvasRenderingContext2D
		if (ctx === null)
			throw new Error("The viewport canvas is already being used!")
		this.ctx = ctx

		if (this.itemCanvas) {
			// Also get the item draw context, if we are allowed
			const itemCtx = this.itemCanvas.getContext("2d", {
				alpha: true,
			}) as CanvasRenderingContext2D
			if (itemCtx === null)
				throw new Error("The item canvas is already being used!")
			this.itemCtx = itemCtx
		}
	}
	updateTileSize(): void {
		if (!this.level || !this.cameraSize)
			throw new Error("Can't update the tile size without a level!")
		this.viewportCanvas.width = this.cameraSize.width * this.tileset.tileSize
		this.viewportCanvas.height = this.cameraSize.height * this.tileset.tileSize
	}
	getArt(actor: Actor): ActorArtList {
		let art = artDB[actor.id]
		if (!art) throw new Error(`Actor id ${actor.id} has no art!`)
		if (typeof art === "function") art = art(actor, this.tileset)
		if (art instanceof Array) return art
		else return [art]
	}
	getFloorArt(tile?: Tile): ActorArtList {
		let art = artDB["floor"]
		if (!art) throw new Error(`The floor has no art!`)
		if (typeof art === "function") art = art(tile, this.tileset)
		if (art instanceof Array) return art
		else return [art]
	}
	drawActor(
		ctx: CanvasRenderingContext2D,
		tileSize: number,
		pos: [number, number],
		actorArt: ActorArtList
	): void {
		for (const art of actorArt) {
			if (!art || !art.actorName) continue
			let frame =
				this.tileset.frameMap[art.actorName]?.[art.animation ?? "default"]?.[
					art.frame ?? 0
				]
			const localPos = [pos[0], pos[1]]
			if (!frame) continue
			if (art.sourceOffset) {
				frame = [frame[0], frame[1]]
				frame[0] += art.sourceOffset[0]
				frame[1] += art.sourceOffset[1]
			}
			if (art.imageOffset) {
				localPos[0] += art.imageOffset[0] * tileSize
				localPos[1] += art.imageOffset[1] * tileSize
			}
			const cropSize = art.cropSize ?? [1, 1]
			ctx.drawImage(
				this.tileset.image,
				frame[0] * tileSize,
				frame[1] * tileSize,
				tileSize * cropSize[0],
				tileSize * cropSize[1],
				Math.floor(localPos[0]),
				Math.floor(localPos[1]),
				tileSize * cropSize[0],
				tileSize * cropSize[1]
			)
		}
	}

	updateItems(): void {
		if (!this.level || !this.level.selectedPlayable)
			throw new Error("Can't update the inventory without a playable!")
		if (!this.itemCanvas || !this.itemCtx) return
		const tileSize = this.tileset.tileSize
		const player = this.level.selectedPlayable
		const expectedWidth = player.inventory.itemMax * tileSize
		const expectedHeight = 2 * tileSize
		const floorArt = this.getFloorArt()
		for (let index = 0; index < player.inventory.itemMax * 2; index++) {
			const x = index % player.inventory.itemMax
			const y = Math.floor(index / player.inventory.itemMax)
			this.drawActor(
				this.itemCtx,
				tileSize,
				[x * tileSize, y * tileSize],
				floorArt
			)
		}
		if (
			this.itemCanvas.width !== expectedWidth ||
			this.itemCanvas.height !== expectedHeight
		) {
			this.itemCanvas.width = expectedWidth
			this.itemCanvas.height = expectedHeight
		}
		for (const [i, item] of player.inventory.items.entries()) {
			this.drawActor(
				this.itemCtx,
				tileSize,
				[i * tileSize, 0],
				this.getArt(item)
			)
		}
		let nonRegisteredOffset = keyNameList.length
		for (const key of Object.values(player.inventory.keys)) {
			if (key.amount <= 0) continue
			let index = keyNameList.indexOf(key.type.id)
			if (index === -1) {
				index = nonRegisteredOffset
				nonRegisteredOffset += 1
			}
			this.drawActor(
				this.itemCtx,
				tileSize,
				[index * tileSize, tileSize],
				this.getArt(key.type)
			)
		}
	}
	updateCameraPosition(): void {
		if (!this.level) {
			throw new Error("There's no camera without a level!")
		}
		if (!this.level.selectedPlayable) {
			this.cameraPosition = [0, 0]
			return
		}
		const playerPos = this.level.selectedPlayable.getVisualPosition()
		this.cameraPosition = [
			clamp(
				playerPos[0] + 0.5,
				this.level.cameraType.width / 2,
				this.level.width - this.level.cameraType.width / 2
			) -
				this.level.cameraType.width / 2,
			clamp(
				playerPos[1] + 0.5,
				this.level.cameraType.height / 2,
				this.level.height - this.level.cameraType.height / 2
			) -
				this.level.cameraType.width / 2,
		]
	}
	drawViewportActor(position: [number, number], art: ActorArtList): void {
		const tileSize = this.tileset.tileSize
		this.drawActor(
			this.ctx,
			tileSize,
			[
				(position[0] - this.cameraPosition[0]) * tileSize,
				(position[1] - this.cameraPosition[1]) * tileSize,
			],
			art
		)
	}
	frame(): void {
		if (!this.level || !this.cameraSize) return
		this.updateCameraPosition()
		for (let layer = Layer.STATIONARY; layer <= Layer.SPECIAL; layer++) {
			for (let xi = -1; xi <= this.cameraSize.width + 1; xi++) {
				for (let yi = -1; yi <= this.cameraSize.height + 1; yi++) {
					const x = Math.floor(xi + this.cameraPosition[0])
					const y = Math.floor(yi + this.cameraPosition[1])
					const tile = this.level.field[x]?.[y]
					if (!tile) continue
					if (layer === Layer.STATIONARY && !tile.hasLayer(Layer.STATIONARY)) {
						// If there's nothing on the terrain level, draw floor
						this.drawViewportActor([x, y], this.getFloorArt(tile))
					} else {
						for (const actor of tile[layer]) {
							this.drawViewportActor(
								actor.getVisualPosition(),
								this.getArt(actor)
							)
						}
					}
				}
			}
		}
		this.updateItems()
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
	const toDraw: ActorArt[] = []
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

export const wiredTerrainArt = (name: string) => (actor: Wirable | undefined) =>
	actor === undefined
		? { actorName: name, animation: "wireBase" }
		: [
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
			{
				actorName: name,
				animation: animName,
				frame: animLength && actor.level.currentTick % animLength,
			},
		]
