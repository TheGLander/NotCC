import { CameraType, Direction, Tile, Wires } from "@notcc/logic"
import { LevelState } from "@notcc/logic"
import { Actor } from "@notcc/logic"
import { Layer } from "@notcc/logic"
import { DirectionString } from "@notcc/logic"
import { specialFuncs, stateFuncs } from "./artSetSpecials"

export type HTMLImage = HTMLImageElement | HTMLCanvasElement

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

export type Frame = [x: number, y: number]
export type Position = [x: number, y: number]
export type Size = [w: number, h: number]

export function frange(a: Frame, b: Frame): Frame[] {
	const frames: Frame[] = []
	const lengthX = b[0] - a[0]
	if (a[1] !== b[1]) throw new Error("Can't use `frange` over vertical frames.")

	for (let xi = 0; xi <= Math.abs(lengthX); xi++) {
		const x = a[0] + (lengthX > 0 ? xi : -xi)
		frames.push([x, a[1]])
	}
	return frames
}

type StaticArt = Frame

/** Directic is a portmanteau of directional and static */
interface DirecticArt {
	type: "directic"
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}
interface AnimatedArt {
	type: "animated"
	duration: number | "steps"
	baseFrame?: number
	randomizedFrame?: boolean
	frames: Frame[]
}
interface DirectionalArt {
	type: "directional"
	duration: number | "steps"
	baseFrame?: number
	randomizedFrame?: boolean
	UP: Frame[]
	RIGHT: Frame[]
	DOWN: Frame[]
	LEFT: Frame[]
}
interface OverlayArt {
	type: "overlay"
	bottom: Art
	top: Art
}
interface WiresArt {
	type: "wires"
	base?: Frame
	top: Art
	alwaysShowTop?: boolean
}
type StateArt = { type: "state" } & { [state: string]: string | Art }

export type SpecialArt = {
	type: "special"
	specialType: string
} & {
	[arg: string]:
		| Art
		| Frame[]
		| string
		| undefined
		| boolean
		| number
		| Record<string, Art>
}
export type Art =
	| StaticArt
	| DirecticArt
	| AnimatedArt
	| DirectionalArt
	| OverlayArt
	| WiresArt
	| StateArt
	| SpecialArt
	| null

export interface ArtSet {
	floor: Art
	currentPlayerMarker: Frame
	wireBase: Frame
	wire: [StaticArt, StaticArt]
	wireTunnel: DirecticArt
	letters: Record<string, StaticArt>
	artMap: Record<string, Art>
}

export interface Tileset {
	image: HTMLImage
	art: ArtSet
	wireWidth: number
	tileSize: number
}

function clamp(value: number, min: number, max: number): number {
	if (value < min) return min
	if (value > max) return max
	return value
}

export interface ArtContext {
	ctx: CanvasRenderingContext2D
	ticks: number
	offset: Position
}

export function actorToDir(actor: Actor): DirectionString {
	return Direction[actor.direction] as DirectionString
}

export class Renderer {
	cameraPosition: Position = [0, 0]
	level: LevelState | null = null
	cameraSize: CameraType | null = null

	constructor(public tileset: Tileset) {}
	updateTileSize(canvas: HTMLCanvasElement): void {
		if (!this.level || !this.cameraSize)
			throw new Error("Can't update the tile size without a level!")
		canvas.width = this.cameraSize.width * this.tileset.tileSize
		canvas.height = this.cameraSize.height * this.tileset.tileSize
	}
	tileBlit(
		{ ctx, offset }: ArtContext,
		pos: Position,
		frame: Frame,
		size: Size = [1, 1]
	): void {
		const tileSize = this.tileset.tileSize
		ctx.drawImage(
			this.tileset.image,
			frame[0] * tileSize,
			frame[1] * tileSize,
			size[0] * tileSize,
			size[1] * tileSize,
			Math.floor((pos[0] + offset[0]) * tileSize),
			Math.floor((pos[1] + offset[1]) * tileSize),
			size[0] * tileSize,
			size[1] * tileSize
		)
	}
	drawWireBase(
		ctx: ArtContext,
		pos: Position,
		wires: Wires,
		state: boolean
	): void {
		const frame = this.tileset.art.wire[state ? 1 : 0]
		const radius = this.tileset.wireWidth / 2
		const cropStart: Position = [0.5 - radius, 0.5 - radius]
		const cropEnd: Position = [0.5 + radius, 0.5 + radius]
		if (wires & Wires.UP) {
			cropStart[1] = 0
		}
		if (wires & Wires.RIGHT) {
			cropEnd[0] = 1
		}
		if (wires & Wires.DOWN) {
			cropEnd[1] = 1
		}
		if (wires & Wires.LEFT) {
			cropStart[0] = 0
		}
		const cropSize: Size = [
			cropEnd[0] - cropStart[0],
			cropEnd[1] - cropStart[1],
		]
		this.tileBlit(
			ctx,
			[pos[0] + cropStart[0], pos[1] + cropStart[1]],
			[frame[0] + cropStart[0], frame[1] + cropStart[1]],
			cropSize
		)
	}
	/**
	 * Generalized logic of drawing directional block and clone machine arrows
	 * @param width The length from the side of the tile to crop to get the
	 * required tile
	 */
	drawCompositionalSides(
		ctx: ArtContext,
		pos: Position,
		art: Record<DirectionString, Frame>,
		width: number,
		drawnDirections: Direction[]
	): void {
		for (const direction of drawnDirections) {
			const offset =
				direction === Direction.RIGHT
					? [1 - width, 0]
					: direction === Direction.DOWN
						? [0, 1 - width]
						: [0, 0]
			this.tileBlit(
				ctx,
				[pos[0] + offset[0], pos[1] + offset[1]],
				art[Direction[direction] as DirectionString],
				direction === Direction.UP || direction === Direction.DOWN
					? [1, width]
					: [width, 1]
			)
		}
	}
	drawStatic(ctx: ArtContext, actor: Actor, art: StaticArt): void {
		this.tileBlit(ctx, actor.getVisualPosition(), art)
	}
	drawDirectic(ctx: ArtContext, actor: Actor, art: DirecticArt): void {
		this.drawArt(ctx, actor, art[actorToDir(actor)])
	}
	drawAnimated(
		ctx: ArtContext,
		actor: Actor,
		art: AnimatedArt | DirectionalArt
	): void {
		const frames = art.type === "animated" ? art.frames : art[actorToDir(actor)]
		const duration = art.duration
		let frameN: number

		if (typeof duration === "number") {
			frameN = Math.floor(frames.length * ((ctx.ticks / duration) % 1))
		} else if (actor.cooldown !== 0) {
			frameN = Math.floor(
				frames.length * (1 - actor.cooldown / actor.currentMoveSpeed!)
			)
		} else {
			frameN = art.baseFrame || 0
		}
		// TODO `art.randomizedFrame`
		this.drawStatic(ctx, actor, frames[frameN])
	}
	drawOverlay(ctx: ArtContext, actor: Actor, art: OverlayArt): void {
		this.drawArt(ctx, actor, art.bottom)
		this.drawArt(ctx, actor, art.top)
	}
	drawWires(ctx: ArtContext, actor: Actor, art: WiresArt): void {
		const pos = actor.getVisualPosition()
		this.tileBlit(ctx, pos, this.tileset.art.wireBase)
		if (actor.level.hideWires && !art.alwaysShowTop) return
		if (!actor.level.hideWires) {
			this.drawWireBase(ctx, pos, actor.wires, false)
			this.drawWireBase(ctx, pos, actor.poweredWires & actor.wires, true)
		}
		this.drawArt(ctx, actor, art.top)
	}
	drawState(ctx: ArtContext, actor: Actor, art: StateArt): void {
		const stateFunc = stateFuncs[actor.id]
		if (stateFunc === undefined) {
			console.warn(`No state function for actor ${actor.id ?? "floor"}.`)
			return
		}

		const state = stateFunc(actor)
		const newArt = art[state] as Art
		if (newArt === undefined) {
			console.warn(
				`Unexpected state ${state} for actor ${actor.id ?? "floor"}.`
			)
			return
		}

		this.drawArt(ctx, actor, newArt)
	}
	drawSpecial(ctx: ArtContext, actor: Actor, art: SpecialArt): void {
		const specialFunc = specialFuncs[art.specialType]
		if (specialFunc == undefined) {
			console.warn(
				`No special draw function for specialType ${art.specialType}.`
			)
			return
		}

		specialFunc.call(this, ctx, actor, art)
	}
	drawArt(ctx: ArtContext, actor: Actor, art: Art): void {
		if (!art) return
		if (Array.isArray(art)) {
			this.drawStatic(ctx, actor, art)
		} else if (art.type === "directic") {
			this.drawDirectic(ctx, actor, art)
		} else if (art.type === "animated" || art.type === "directional") {
			this.drawAnimated(ctx, actor, art)
		} else if (art.type === "overlay") {
			this.drawOverlay(ctx, actor, art)
		} else if (art.type === "wires") {
			this.drawWires(ctx, actor, art)
		} else if (art.type === "state") {
			this.drawState(ctx, actor, art)
		} else if (art.type === "special") {
			this.drawSpecial(ctx, actor, art)
		}
	}
	drawFloor(ctx: ArtContext, tile: Tile | Position): void {
		this.drawArt(ctx, tile as unknown as Actor, this.tileset.art.floor)
	}
	drawActor(ctxSession: ArtContext, actor: Actor): void {
		const art = this.tileset.art.artMap[actor.id]
		if (art === undefined) {
			console.warn(`No art for actor ${actor.id}.`)
			return
		}
		const ctx = { ...ctxSession, actor }
		if (
			actor.level.playablesLeft > 1 &&
			actor === actor.level.selectedPlayable
		) {
			this.tileBlit(
				ctx,
				actor.getVisualPosition(),
				this.tileset.art.currentPlayerMarker
			)
		}
		this.drawArt(ctx, actor, art)
	}
	updateCameraPosition(): void {
		if (!this.level) {
			throw new Error("There's no camera without a level!")
		}
		if (!this.level.selectedPlayable || !this.cameraSize) {
			this.cameraPosition = [0, 0]
			return
		}
		const playerPos = this.level.selectedPlayable.getVisualPosition()
		// Note: the opposite of what you'd expect, since `visualPosition` gives
		// absolute positions, so we need to recenter by subtracting the camera
		// position, but ArtContext adds offsets, so we need to negate
		this.cameraPosition = [
			-(
				clamp(
					playerPos[0] + 0.5,
					this.cameraSize.width / 2,
					this.level.width - this.cameraSize.width / 2
				) -
				this.cameraSize.width / 2
			),
			-(
				clamp(
					playerPos[1] + 0.5,
					this.cameraSize.height / 2,
					this.level.height - this.cameraSize.height / 2
				) -
				this.cameraSize.height / 2
			),
		]
	}
	frame(ctx: CanvasRenderingContext2D): void {
		if (!this.level || !this.cameraSize) return
		this.updateCameraPosition()
		const session: ArtContext = {
			ctx: ctx,
			offset: this.cameraPosition,
			ticks: this.level.currentTick * 3 + this.level.subtick,
		}
		for (let layer = Layer.STATIONARY; layer <= Layer.SPECIAL; layer++) {
			for (let xi = -1; xi <= this.cameraSize.width + 1; xi++) {
				for (let yi = -1; yi <= this.cameraSize.height + 1; yi++) {
					const x = Math.floor(xi - this.cameraPosition[0])
					const y = Math.floor(yi - this.cameraPosition[1])
					const tile = this.level.field[x]?.[y]
					if (!tile) continue
					if (layer === Layer.STATIONARY && !tile.hasLayer(Layer.STATIONARY)) {
						// If there's nothing on the terrain level, draw floor
						this.drawFloor(session, tile)
					} else if (tile.hasLayer(layer)) {
						this.drawActor(session, tile[layer]!)
					}
				}
			}
		}
	}
}
