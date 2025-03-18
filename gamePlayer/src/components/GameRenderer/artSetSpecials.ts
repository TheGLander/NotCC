import { Actor, BasicTile, Direction, Level } from "@notcc/logic"
import {
	Art,
	ArtContext,
	Frame,
	Position,
	Renderer,
	Size,
	SpecialArt,
	actorToDir,
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
	if (actor.customData & 0x2n) return "bump"
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
		let perspective = this.playerSeat!.hasPerspective()
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
	actor.customData & 0x1n ? "on" : "off"
)
//
interface FreeformWiresSpecialArt extends SpecialArt {
	base: Frame
	overlap: Frame
	overlapCross: Frame
}

registerSpecialFunction<BasicTile>(
	"freeform wires",
	function (ctx, level, tile, art) {
		const spArt = art as FreeformWiresSpecialArt
		const wires = tile.customData & 0x0fn
		const wireTunnels = (tile.customData & 0xf0n) >> 4n
		this.tileBlit(ctx, [0, 0], spArt.base)
		// If we don't have anything else to draw, don't draw the overlay
		// TODO: Wire tunnels are drawn on top of everything else, so maybe they
		// don't cause the base to be drawn?
		if (wires === 0n && wireTunnels === 0n) {
			return
		}
		if (level.metadata.wiresHidden) {
			return
		}
		const poweredWires = tile.getCell().poweredWires
		const crossWires = wires === 0xfn
		if (crossWires) {
			this.drawWireBase(
				ctx,
				[0, 0],
				wires & 0b0101n,
				(poweredWires & 0b0101) !== 0
			)
			this.drawWireBase(
				ctx,
				[0, 0],
				wires & 0b1010n,
				(poweredWires & 0b1010) !== 0
			)
		} else {
			this.drawWireBase(ctx, [0, 0], wires, poweredWires !== 0)
		}
		this.tileBlit(ctx, [0, 0], crossWires ? spArt.overlapCross : spArt.overlap)
		this.drawCompositionalSides(
			ctx,
			[0, 0],
			this.tileset.art.wireTunnel,
			0.25,
			wireTunnels
		)
	}
)
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
registerStateFunction<BasicTile>("teleportRed", tile => {
	const cell = tile.getCell()
	return !(cell.isWired && tile.customData & 0xfn) || cell.poweredWires !== 0
		? "on"
		: "off"
})
registerStateFunction<BasicTile>("transmogrifier", tile => {
	const cell = tile.getCell()
	return !(cell.isWired && tile.customData & 0xfn) || cell.poweredWires !== 0
		? "on"
		: "off"
})
registerStateFunction<BasicTile>("toggleSwitch", actor =>
	actor.customData & 0x10n ? "on" : "off"
)
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
interface RailroadSpecialArt extends SpecialArt {
	toggleMark: Frame
	wood: Record<string, Frame>
	rail: Record<string, Frame>
	toggleRail: Record<string, Frame>
}

const RailroadFlags = {
	TRACK_UR: 0x01n,
	TRACK_RD: 0x02n,
	TRACK_DL: 0x04n,
	TRACK_LU: 0x08n,
	TRACK_LR: 0x10n,
	TRACK_UD: 0x20n,
	TRACK_MASK: 0x3fn,
	TRACK_SWITCH: 0x40n,
	ACTIVE_TRACK_MASK: 0xf00n,
	ENTERED_DIR_MASK: 0xf000n,
}

function* railroadTracks(customData: bigint) {
	for (let trackIdx = 0n; trackIdx < 6n; trackIdx += 1n) {
		if (customData & (1n << trackIdx)) yield trackIdx
	}
}

registerSpecialFunction<BasicTile>(
	"railroad",
	function (ctx, _level, tile, art) {
		const spArt = art as RailroadSpecialArt
		const isSwitch = (tile.customData & RailroadFlags.TRACK_SWITCH) != 0n
		const activeTrackIdx =
			(tile.customData & RailroadFlags.ACTIVE_TRACK_MASK) >> 8n
		const activeTrack = 1n << activeTrackIdx
		for (const dir of railroadTracks(tile.customData)) {
			this.tileBlit(ctx, [0, 0], spArt.wood[dir as unknown as number])
		}
		for (const dir of railroadTracks(tile.customData)) {
			if (isSwitch) {
				if (dir === activeTrackIdx) continue
				this.tileBlit(ctx, [0, 0], spArt.toggleRail[dir as unknown as number])
			} else {
				this.tileBlit(ctx, [0, 0], spArt.rail[dir as unknown as number])
			}
		}
		if (isSwitch && activeTrack & tile.customData) {
			this.tileBlit(
				ctx,
				[0, 0],
				spArt.rail[activeTrackIdx as unknown as number]
			)
		}
		if (isSwitch) {
			this.tileBlit(ctx, [0, 0], spArt.toggleMark)
		}
	}
)
//
const roverEmulationPattern = [
	"teethRed",
	"glider",
	"ant",
	"ball",
	"teethBlue",
	"fireball",
	"centipede",
	"walker",
]
registerStateFunction<Actor>(
	"rover",
	actor =>
		roverEmulationPattern[
			((actor.customData & 0xff00n) >> 8n) as unknown as number
		]
)
//
interface RoverAntennaSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}

registerSpecialFunction<Actor>(
	"rover antenna",
	function (ctx, _level, actor, art) {
		const spArt = art as RoverAntennaSpecialArt
		const frame = spArt[actorToDir(actor)]
		this.tileBlit(ctx, [0.25, 0.25], frame, [0.5, 0.5])
	}
)
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
registerStateFunction<BasicTile>("greenBomb", (actor, level) =>
	!!actor.customData != level.toggleWallInverted ? "echip" : "bomb"
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
type LogicGateArtEntry =
	| {
			type?: "normal" | "not"
			UP: Frame
			RIGHT: Frame
			DOWN: Frame
			LEFT: Frame
	  }
	| { type: "counter"; bottom: Frame; [arg: number]: Frame }

interface LogicGateSpecialArt extends SpecialArt {
	types: Record<string, LogicGateArtEntry>
	base: Frame
}

// NOTE: This differs from the `tiles.c` implementation, left/right are mirrored here so that we don't have to mirror the logic gate direction separately
function rotateWireBitsMirrored(bits: bigint, dir: Direction): bigint {
	if (dir == Direction.UP) return bits
	if (dir == Direction.LEFT)
		return ((bits >> 1n) & 0b0111n) | ((bits << 3n) & 0b1000n)
	if (dir == Direction.DOWN)
		return ((bits >> 2n) & 0b0011n) | ((bits << 2n) & 0b1100n)
	if (dir == Direction.RIGHT)
		return ((bits << 1n) & 0b1110n) | ((bits >> 3n) & 0b0001n)
	return 0n
}

function getLogicGateDirection(bits: bigint) {
	const wireBits = bits & 0xfn
	// Three-wire gates (AND, OR, XOR, NOR, latch, latch mirror)
	if (wireBits == 0b1011n) return Direction.UP
	if (wireBits == 0b0111n) return Direction.RIGHT
	if (wireBits == 0b1110n) return Direction.DOWN
	if (wireBits == 0b1101n) return Direction.LEFT
	// Two-wire gate (NOT)
	if (bits == 0b00101n) return Direction.UP
	if (bits == 0b01010n) return Direction.RIGHT
	if (bits == 0b10101n) return Direction.DOWN
	if (bits == 0b11010n) return Direction.LEFT
	// Four-wire gate (counter)
	if (wireBits == 0b1111n) return Direction.UP
	return Direction.NONE
}
function getLogicGateType(bits: bigint): string | null {
	const wireBits = bits & 0xfn
	if (wireBits == 0b1010n || wireBits == 0b0101n) return "not"
	if (wireBits == 0b1111n) return "counter"
	const specifier = (bits & 0x70n) >> 4n
	const threeWireLogicGates = [
		"or",
		"and",
		"nand",
		"xor",
		"latch",
		"latchMirror",
	]
	const gate = threeWireLogicGates[Number(specifier)]
	if (gate !== undefined) return gate
	return null
}

registerSpecialFunction<BasicTile>(
	"logic gate",
	function (ctx, level, tile, art) {
		const spArt = art as LogicGateSpecialArt
		if (level.metadata.wiresHidden) {
			this.tileBlit(ctx, [0, 0], spArt.base)
			return
		}
		const gateType = getLogicGateType(tile.customData)
		if (gateType === null) return

		const direction = getLogicGateDirection(tile.customData)
		const cell = tile.getCell()
		const poweredWires = tile.customData & 0xfn & BigInt(cell.poweredWires)

		const ent = spArt.types[gateType]

		if (ent.type === "counter") {
			this.drawWireBase(ctx, [0, 0], 0xfn, false)
			this.drawWireBase(ctx, [0, 0], poweredWires, true)
			this.tileBlit(ctx, [0, 0], ent.bottom)
			const value = (tile.customData & 0xf0n) >> 4n
			this.tileBlit(ctx, [0.125, 0], ent[Number(value)], [0.75, 1])
			return
		}

		if (ent.type === "not") {
			this.tileBlit(ctx, [0, 0], spArt.base)
			this.drawWireBase(ctx, [0, 0], tile.customData & 0xfn, false)
			this.drawWireBase(ctx, [0, 0], poweredWires, true)
			this.tileBlit(ctx, [0, 0], ent[Direction[direction] as "UP"])
			return
		}

		// Figure out which wires correspond to the which gate parts.
		const gateHead = rotateWireBitsMirrored(0b0001n, direction)
		const gateRight = rotateWireBitsMirrored(0b0010n, direction)
		const gateBack = rotateWireBitsMirrored(0b0100n, direction)
		const gateLeft = rotateWireBitsMirrored(0b1000n, direction)

		// Blit left and right as if they are also connected to the back,
		// to have the bends in some tilesets
		// Draw the left side first, the right one has control over the middle
		this.drawWireBase(
			ctx,
			[0, 0],
			gateLeft | gateBack,
			(gateLeft & poweredWires) !== 0n
		)
		this.drawWireBase(
			ctx,
			[0, 0],
			gateRight | gateBack,
			(gateRight & poweredWires) !== 0n
		)

		// And last, draw the output
		this.drawWireBase(ctx, [0, 0], gateHead, (poweredWires & gateHead) !== 0n)
		// Now, just draw the base
		this.tileBlit(ctx, [0, 0], ent[Direction[direction] as "UP"])
	}
)
