import { Actor, BasicTile, Direction, Level } from "@notcc/logic"
import {
	Art,
	ArtContext,
	Frame,
	Position,
	Renderer,
	Size,
	SpecialArt,
} from "./renderer"

export const stateFuncs: Record<
	string,
	(actor: Actor | BasicTile, level: Level) => string
> = {}

export function registerStateFunction<T extends BasicTile | Actor = BasicTile>(
	id: string,
	func: (actor: T, level: Level) => string
): void {
	stateFuncs[id] = func as (typeof stateFuncs)[string]
}

export const specialFuncs: Record<
	string,
	(
		this: Renderer,
		ctx: ArtContext,
		level: Level,
		actor: Actor | BasicTile,
		art: SpecialArt
	) => void
> = {}

export function registerSpecialFunction<
	T extends BasicTile | Actor = BasicTile,
>(
	id: string,
	func: (
		this: Renderer,
		ctx: ArtContext,
		level: Level,
		actor: T,
		art: SpecialArt
	) => void
): void {
	specialFuncs[id] = func as (typeof specialFuncs)[string]
}

function getPlayableState(actor: Actor): string {
	// const inWater = actor.tile.findActor(actor => actor.hasTag("water"))
	// if (inWater) return "water"
	// TODO: extract isPushing and inWater from customData
	if (actor.bonked) return "bump"
	return "normal"
}

registerStateFunction("chip", getPlayableState)
registerStateFunction("melinda", getPlayableState)

function animationStateFunction(actor: Actor): string {
	return (4n - (actor.customData + 3n) / 4n).toString()
}

registerStateFunction("splashAnim", animationStateFunction)
registerStateFunction("explosionAnim", animationStateFunction)

interface PerspectiveSpecialArt extends SpecialArt {
	somethingUnderneathOnly?: boolean
	default: Art
	revealed: Art
}

registerSpecialFunction<Actor>(
	"perspective",
	function (ctx, level, actor, art) {
		const spArt = art as PerspectiveSpecialArt
		// let perspective = level.getPerspective()
		let perspective = false
		if (perspective && spArt.somethingUnderneathOnly) {
			const pos = actor.position
			const tile = level.getCell(pos[0], pos[1])
			perspective = !!(
				tile.itemMod ||
				tile.item ||
				tile.terrain!.type.name !== "floor" ||
				tile.terrain!.customData !== 0n
			)
		}
		this.drawArt(ctx, actor, perspective ? spArt.revealed : spArt.default)
	}
)
registerStateFunction<BasicTile>(
	"iceCorner",
	// @ts-ignore This is blatantly incorrect
	actor => Direction[actor.customData]
)
registerStateFunction<BasicTile>(
	"forceFloor",
	// @ts-ignore This is blatantly incorrect
	actor => Direction[actor.customData]
)
registerStateFunction<BasicTile>(
	"swivel",
	// @ts-ignore This is blatantly incorrect
	actor => Direction[actor.customData]
)

interface ScrollingSpecialArt extends SpecialArt {
	duration: number
	UP: [Frame, Frame]
	DOWN: [Frame, Frame]
	RIGHT: [Frame, Frame]
	LEFT: [Frame, Frame]
}

registerSpecialFunction<BasicTile>(
	"scrolling",
	function (ctx, _level, actor, art) {
		const spArt = art as ScrollingSpecialArt
		const offsetMult = (ctx.ticks / spArt.duration) % 1
		// @ts-ignore This is blatantly incorrect
		const baseFrames = spArt[Direction[actor.customData] as "UP"]
		const offset: Frame = [
			baseFrames[1][0] - baseFrames[0][0],
			baseFrames[1][1] - baseFrames[0][1],
		]
		const frame: Frame = [
			baseFrames[0][0] + offset[0] * offsetMult,
			baseFrames[0][1] + offset[1] * offsetMult,
		]
		this.tileBlit(ctx, [0, 0], frame)
	}
)

registerStateFunction<BasicTile>("invisibleWall", (actor, level) =>
	actor.customData - BigInt(level.subticksPassed()) > 0 ? "touched" : "default"
)
registerStateFunction<BasicTile>(
	"bonusFlag",
	actor =>
		(actor.customData & 0x8000n ? "x" : "") +
		(actor.customData & 0x7fffn).toString()
)
function mapCustomTile(data: bigint) {
	return { 0: "green", 1: "pink", 2: "yellow", 3: "blue" }[
		(data % 4n).toString()
	] as string
}

registerStateFunction<BasicTile>("customWall", actor =>
	mapCustomTile(actor.customData)
)
registerStateFunction<BasicTile>("customFloor", actor =>
	mapCustomTile(actor.customData)
)
registerStateFunction<BasicTile>("dynamiteLit", actor =>
	Math.floor((Number(actor.customData) / 256) * 4).toString()
)
registerStateFunction<BasicTile>("flameJet", actor =>
	actor.customData ? "on" : "off"
)
//
// interface FreeformWiresSpecialArt extends SpecialArt {
// 	base: Frame
// 	overlap: Frame
// 	overlapCross: Frame
// }
//
// registerSpecialFunction<Tile | [number, number] | Actor>(
// 	"freeform wires",
// 	function (ctx, actor, art) {
// 		const spArt = art as FreeformWiresSpecialArt
// 		const pos = Array.isArray(actor)
// 			? actor
// 			: actor instanceof Tile
// 				? actor.position
// 				: actor.tile.position
// 		const wires = Array.isArray(actor) ? 0 : actor.wires
// 		const wireTunnels = Array.isArray(actor) ? 0 : actor.wireTunnels
// 		this.tileBlit(ctx, pos, spArt.base)
// 		// If we don't have anything else to draw, don't draw the overlay
// 		// TODO Wire tunnels are drawn on top of everything else, so maybe they
// 		// don't cause the base to be drawn?
// 		if (wires === 0 && wireTunnels === 0) {
// 			return
// 		}
// 		if (actor instanceof Array || actor.level.hideWires) {
// 			return
// 		}
// 		const crossWires =
// 			(actor.wireOverlapMode === WireOverlapMode.CROSS &&
// 				actor.wires === 0b1111) ||
// 			actor.wireOverlapMode === WireOverlapMode.ALWAYS_CROSS
// 		if (crossWires) {
// 			this.drawWireBase(
// 				ctx,
// 				pos,
// 				wires & 0b0101,
// 				(actor.poweredWires & 0b0101) !== 0
// 			)
// 			this.drawWireBase(
// 				ctx,
// 				pos,
// 				wires & 0b1010,
// 				(actor.poweredWires & 0b1010) !== 0
// 			)
// 		} else {
// 			this.drawWireBase(ctx, pos, wires, actor.poweredWires !== 0)
// 		}
// 		this.tileBlit(ctx, pos, crossWires ? spArt.overlapCross : spArt.overlap)
// 		this.drawCompositionalSides(
// 			ctx,
// 			pos,
// 			this.tileset.art.wireTunnel,
// 			0.25,
// 			bitfieldToDirs(wireTunnels)
// 		)
// 	}
// )
interface ArrowsSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
	CENTER: Frame
}

registerSpecialFunction<Actor | BasicTile>(
	"arrows",
	function (ctx, _level, tile, art) {
		const spArt = art as ArrowsSpecialArt
		this.drawCompositionalSides(ctx, [0, 0], spArt, 0.25, tile.customData)
		this.tileBlit(ctx, [0.25, 0.25], spArt.CENTER, [0.5, 0.5])
	}
)
interface FuseSpecialArt extends SpecialArt {
	duration: number
	frames: Frame[]
}

registerSpecialFunction<BasicTile>("fuse", function (ctx, _level, _tile, art) {
	const spArt = art as FuseSpecialArt
	const frameN = Math.floor(
		spArt.frames.length * ((ctx.ticks / spArt.duration) % 1)
	)
	this.tileBlit(ctx, [0.5, 0], spArt.frames[frameN], [0.5, 0.5])
})

interface ThinWallsSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}
registerSpecialFunction<BasicTile>(
	"thin walls",
	function (ctx, _level, tile, art) {
		const spArt = art as ThinWallsSpecialArt
		this.drawCompositionalSides(ctx, [0, 0], spArt, 0.5, tile.customData)
	}
)
//
registerStateFunction<BasicTile>("thinWall", tile =>
	tile.customData & 0x10n ? "canopy" : "nothing"
)
//
registerStateFunction<BasicTile>("blueWall", actor =>
	actor.customData & 0x100n ? "real" : "fake"
)
// TODO: Green wall
registerStateFunction<BasicTile>("greenWall", _actor => "real")
registerStateFunction<BasicTile>("toggleWall", (actor, level) =>
	!!actor.customData != level.toggleWallInverted ? "on" : "off"
)
registerStateFunction<Actor>("holdWall", actor =>
	actor.customData ? "on" : "off"
)
registerStateFunction<BasicTile>("trap", actor =>
	actor.customData & 1n ? "open" : "closed"
)
// TODO: Red tp
registerStateFunction<Actor>(
	"teleportRed",
	actor =>
		// !actor.wired || actor.poweredWires !== 0 ? "on" : "off"
		"on"
)
//
// // Note: We also check for `wires` here, unlike in the logic.
// // This is intentional, this discrepency is also in CC2
// registerStateFunction<Actor>("transmogrifier", actor =>
// 	actor.wires !== 0 && actor.wired && !actor.poweredWires ? "off" : "on"
// )
// registerStateFunction<Actor>("toggleSwitch", actor => actor.customData)
//
interface StretchSpecialArt extends SpecialArt {
	idle: Art
	vertical: Frame[]
	horizontal: Frame[]
}

registerSpecialFunction<Actor>("stretch", function (ctx, _level, actor, art) {
	const spArt = art as StretchSpecialArt
	if (actor.moveProgress === 0) {
		this.drawArt(ctx, actor, spArt.idle)
		return
	}
	const pos = [0, 0]
	// Have to manually undo the visual offset which is applied by default
	const builtinOffset = actor.getVisualOffset()
	pos[0] -= builtinOffset[0]
	pos[1] -= builtinOffset[1]
	let frames: Frame[]
	let framesReversed: boolean
	const dir = actor.direction
	let offset: Position = [0, 0]
	let cropSize: Size
	if (dir === Direction.UP) {
		frames = spArt.vertical
		framesReversed = true
		cropSize = [1, 2]
	} else if (dir === Direction.RIGHT) {
		frames = spArt.horizontal
		framesReversed = false
		offset = [-1, 0]
		cropSize = [2, 1]
	} else if (dir === Direction.DOWN) {
		frames = spArt.vertical
		framesReversed = false
		offset = [0, -1]
		cropSize = [1, 2]
	} else {
		// Direction.LEFT
		frames = spArt.horizontal
		framesReversed = true
		cropSize = [2, 1]
	}
	let progress = actor.moveProgress / actor.moveLength
	if (framesReversed) {
		progress = 1 - progress
	}
	const frame = frames[Math.floor(progress * frames.length)]
	this.tileBlit(ctx, [pos[0] + offset[0], pos[1] + offset[1]], frame, cropSize)
})
//
// registerSpecialFunction<VoodooTile>("voodoo", function (ctx, actor) {
// 	if (actor.tileOffset === null) return
// 	const pos = actor.getVisualPosition()
// 	const frame: Frame = [
// 		actor.tileOffset % 0x10,
// 		Math.floor(actor.tileOffset / 0x10),
// 	]
// 	this.tileBlit(ctx, pos, frame)
// })
//
// interface RailroadSpecialArt extends SpecialArt {
// 	toggleMark: Frame
// 	wood: Record<string, Frame>
// 	rail: Record<string, Frame>
// 	toggleRail: Record<string, Frame>
// }
//
// registerSpecialFunction<Railroad>("railroad", function (ctx, actor, art) {
// 	const spArt = art as RailroadSpecialArt
// 	const pos = actor.getVisualPosition()
// 	for (const dir of actor.baseRedirects) {
// 		this.tileBlit(ctx, pos, spArt.wood[dir])
// 	}
// 	for (const dir of actor.baseRedirects) {
// 		if (actor.isSwitch) {
// 			if (dir === actor.activeTrack) continue
// 			this.tileBlit(ctx, pos, spArt.toggleRail[dir])
// 		} else {
// 			this.tileBlit(ctx, pos, spArt.rail[dir])
// 		}
// 	}
// 	if (actor.isSwitch && actor.baseRedirects.includes(actor.activeTrack)) {
// 		this.tileBlit(ctx, pos, spArt.rail[actor.activeTrack])
// 	}
// 	if (actor.isSwitch) {
// 		this.tileBlit(ctx, pos, spArt.toggleMark)
// 	}
// })
//
// registerStateFunction<Rover>("rover", actor => actor.emulatedMonster)
//
// interface RoverAntennaSpecialArt extends SpecialArt {
// 	UP: Frame
// 	RIGHT: Frame
// 	DOWN: Frame
// 	LEFT: Frame
// }
//
// registerSpecialFunction<Rover>("rover antenna", function (ctx, actor, art) {
// 	const spArt = art as RoverAntennaSpecialArt
// 	const pos = actor.getVisualPosition()
// 	const frame = spArt[actorToDir(actor)]
// 	this.tileBlit(ctx, [pos[0] + 0.25, pos[1] + 0.25], frame, [0.5, 0.5])
// })
//
registerSpecialFunction<BasicTile>("letters", function (ctx, _level, actor) {
	let letter: string
	if (actor.customData >= 0x20n) {
		letter = String.fromCharCode(Number(actor.customData))
	} else {
		letter = Direction[(actor.customData - 0x1bn).toString() as "1"]
	}
	// A space doesn't render anything
	if (letter === " ") return
	const frame = this.tileset.art.letters[letter]
	this.tileBlit(ctx, [0.25, 0.25], frame, [0.5, 0.5])
})
//
registerStateFunction<BasicTile>("greenBomb", actor =>
	actor.customData ? "bomb" : "echip"
)
//
// interface CounterSpecialArt extends SpecialArt {
// 	0: Frame
// 	1: Frame
// 	2: Frame
// 	3: Frame
// 	4: Frame
// 	5: Frame
// 	6: Frame
// 	7: Frame
// 	8: Frame
// 	9: Frame
// 	"-": Frame
// 	"": Frame
// }
//
// registerSpecialFunction<CounterGate>("counter", function (ctx, actor, art) {
// 	const spArt = art as CounterSpecialArt
// 	const pos = actor.getVisualPosition()
// 	this.tileBlit(
// 		ctx,
// 		[pos[0] + 0.125, pos[1]],
// 		spArt[actor.memory as unknown as "0"],
// 		[0.75, 1]
// 	)
// })
//
// interface LogicGateSpecialArt extends SpecialArt {
// 	UP: Frame
// 	RIGHT: Frame
// 	DOWN: Frame
// 	LEFT: Frame
// }
//
// function rotateWires(wires: number, dir: Direction): number {
// 	return ((wires << dir) | (wires >> (4 - dir))) & 0b1111
// }
//
// registerSpecialFunction("logic gate", function (ctx, actor, art) {
// 	if (actor.level.hideWires) {
// 		this.drawFloor(ctx, actor.tile)
// 		return
// 	}
// 	const spArt = art as LogicGateSpecialArt
// 	const pos = actor.getVisualPosition()
// 	const poweredWires = actor.wires & actor.poweredWires
// 	// Figure out which wires correspond to the which gate parts.
// 	const gateHead = rotateWires(0b0001, actor.direction)
// 	const gateRight = rotateWires(0b0010, actor.direction)
// 	const gateBack = rotateWires(0b0100, actor.direction)
// 	const gateLeft = rotateWires(0b1000, actor.direction)
//
// 	// Blit left and right as if they are also connected to the back,
// 	// to have the bends in some tilesets
// 	// Draw the left side first, the right one has control over the middle
// 	this.drawWireBase(
// 		ctx,
// 		pos,
// 		gateLeft | gateBack,
// 		(gateLeft & poweredWires) !== 0
// 	)
// 	this.drawWireBase(
// 		ctx,
// 		pos,
// 		gateRight | gateBack,
// 		(gateRight & poweredWires) !== 0
// 	)
//
// 	// And last, draw the output
// 	this.drawWireBase(ctx, pos, gateHead, (poweredWires & gateHead) !== 0)
// 	// Now, just draw the base
// 	this.tileBlit(ctx, pos, spArt[actorToDir(actor)])
// })
//
