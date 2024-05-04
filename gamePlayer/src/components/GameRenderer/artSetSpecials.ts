import {
	Actor,
	Animation,
	BonusFlag,
	CloneMachine,
	CounterGate,
	CustomFloor,
	CustomWall,
	Direction,
	DirectionalBlock,
	FlameJet,
	InvisibleWall,
	LitTNT,
	Playable,
	Railroad,
	Rover,
	ThinWall,
	Tile,
	Trap,
	VoodooTile,
	WireOverlapMode,
} from "@notcc/logic"
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

export const stateFuncs: Record<string, (actor: Actor) => string> = {}

export function registerStateFunction<T = Actor>(
	id: string,
	func: (actor: T) => string
): void {
	stateFuncs[id] = func as (typeof stateFuncs)[string]
}

export const specialFuncs: Record<
	string,
	(this: Renderer, ctx: ArtContext, actor: Actor, art: SpecialArt) => void
> = {}

export function registerSpecialFunction<T = Actor>(
	id: string,
	func: (this: Renderer, ctx: ArtContext, actor: T, art: SpecialArt) => void
): void {
	specialFuncs[id] = func as (typeof specialFuncs)[string]
}

function bitfieldToDirs(bitfield: number): Direction[] {
	const directions: Direction[] = []
	for (let dir = Direction.UP; dir <= Direction.LEFT; dir += 1) {
		if ((bitfield & (1 << dir)) !== 0) {
			directions.push(dir)
		}
	}
	return directions
}

function getPlayableState(actor: Playable): string {
	const inWater = actor.tile.findActor(actor => actor.hasTag("water"))
	if (inWater) return "water"
	if (actor.playerBonked || actor.isPushing) return "bump"
	return "normal"
}

registerStateFunction("chip", getPlayableState)
registerStateFunction("melinda", getPlayableState)
registerStateFunction<InvisibleWall>("invisibleWall", actor =>
	actor.animationLeft > 0 ? "touched" : "default"
)
registerStateFunction<BonusFlag>("bonusFlag", actor => actor.customData)
registerStateFunction<CustomWall>("customWall", actor => actor.customData)
registerStateFunction<CustomFloor>("customFloor", actor => actor.customData)
registerStateFunction<LitTNT>("tntLit", actor =>
	Math.floor((actor.lifeLeft / 253) * 4).toString()
)
registerStateFunction<FlameJet>("flameJet", actor => actor.customData)

interface FreeformWiresSpecialArt extends SpecialArt {
	base: Frame
	overlap: Frame
	overlapCross: Frame
}

registerSpecialFunction<Tile | [number, number] | Actor>(
	"freeform wires",
	function (ctx, actor, art) {
		const spArt = art as FreeformWiresSpecialArt
		const pos = Array.isArray(actor)
			? actor
			: actor instanceof Tile
			  ? actor.position
			  : actor.tile.position
		const wires = Array.isArray(actor) ? 0 : actor.wires
		const wireTunnels = Array.isArray(actor) ? 0 : actor.wireTunnels
		this.tileBlit(ctx, pos, spArt.base)
		// If we don't have anything else to draw, don't draw the overlay
		// TODO Wire tunnels are drawn on top of everything else, so maybe they
		// don't cause the base to be drawn?
		if (wires === 0 && wireTunnels === 0) {
			return
		}
		if (actor instanceof Array || actor.level.hideWires) {
			return
		}
		const crossWires =
			(actor.wireOverlapMode === WireOverlapMode.CROSS &&
				actor.wires === 0b1111) ||
			actor.wireOverlapMode === WireOverlapMode.ALWAYS_CROSS
		if (crossWires) {
			this.drawWireBase(
				ctx,
				pos,
				wires & 0b0101,
				(actor.poweredWires & 0b0101) !== 0
			)
			this.drawWireBase(
				ctx,
				pos,
				wires & 0b1010,
				(actor.poweredWires & 0b1010) !== 0
			)
		} else {
			this.drawWireBase(ctx, pos, wires, actor.poweredWires !== 0)
		}
		this.tileBlit(ctx, pos, crossWires ? spArt.overlapCross : spArt.overlap)
		this.drawCompositionalSides(
			ctx,
			pos,
			this.tileset.art.wireTunnel,
			0.25,
			bitfieldToDirs(wireTunnels)
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

registerSpecialFunction<CloneMachine | DirectionalBlock>(
	"arrows",
	function (ctx, actor, art) {
		const spArt = art as ArrowsSpecialArt
		const pos = actor.getVisualPosition()
		const directions =
			"legalDirections" in actor ? actor.legalDirections : actor.cloneArrows
		this.drawCompositionalSides(ctx, pos, spArt, 0.25, directions)
		this.tileBlit(ctx, [pos[0] + 0.25, pos[1] + 0.25], spArt.CENTER, [0.5, 0.5])
	}
)

interface ScrollingSpecialArt extends SpecialArt {
	duration: number
	UP: [Frame, Frame]
	DOWN: [Frame, Frame]
	RIGHT: [Frame, Frame]
	LEFT: [Frame, Frame]
}

registerSpecialFunction<Actor>("scrolling", function (ctx, actor, art) {
	const spArt = art as ScrollingSpecialArt
	const offsetMult = (ctx.ticks / spArt.duration) % 1
	const baseFrames = spArt[actorToDir(actor)]
	const offset: Frame = [
		baseFrames[1][0] - baseFrames[0][0],
		baseFrames[1][1] - baseFrames[0][1],
	]
	const frame: Frame = [
		baseFrames[0][0] + offset[0] * offsetMult,
		baseFrames[0][1] + offset[1] * offsetMult,
	]
	const pos = actor.getVisualPosition()
	this.tileBlit(ctx, pos, frame)
})

interface FuseSpecialArt extends SpecialArt {
	duration: number
	frames: Frame[]
}

registerSpecialFunction<Actor>("fuse", function (ctx, actor, art) {
	const spArt = art as FuseSpecialArt
	const frameN = Math.floor(
		spArt.frames.length * ((ctx.ticks / spArt.duration) % 1)
	)
	const pos = actor.getVisualPosition()
	this.tileBlit(ctx, [pos[0] + 0.5, pos[1]], spArt.frames[frameN], [0.5, 0.5])
})

interface PerspectiveSpecialArt extends SpecialArt {
	somethingUnderneathOnly?: boolean
	default: Art
	revealed: Art
}

registerSpecialFunction<Actor>("perspective", function (ctx, actor, art) {
	const spArt = art as PerspectiveSpecialArt
	let perspective = actor.level.getPerspective()
	if (perspective && spArt.somethingUnderneathOnly) {
		perspective =
			!!actor.tile.findActor(actor => actor.layer < actor.layer) ||
			actor.tile.wires !== 0
	}
	this.drawArt(ctx, actor, perspective ? spArt.revealed : spArt.default)
})

// TODO letters

interface ThinWallsSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}
registerSpecialFunction<ThinWall>("thin walls", function (ctx, actor, art) {
	const spArt = art as ThinWallsSpecialArt
	const pos = actor.getVisualPosition()

	this.drawCompositionalSides(
		ctx,
		pos,
		spArt,
		0.5,
		bitfieldToDirs(actor.allowedDirections)
	)
})

registerStateFunction<ThinWall>("thinWall", actor =>
	actor.hasTag("canopy") ? "canopy" : "nothing"
)

registerStateFunction<Actor>("blueWall", actor => actor.customData)
registerStateFunction<Actor>("greenWall", actor =>
	actor.customData === "fake" &&
	actor.tile.findActor(iterActor => iterActor.layer > actor.layer)
		? "stepped"
		: actor.customData
)
registerStateFunction<Actor>("toggleWall", actor => actor.customData)
registerStateFunction<Actor>("holdWall", actor => actor.customData)
registerStateFunction<Trap>("trap", actor => (actor.isOpen ? "open" : "closed"))
registerStateFunction<Actor>("teleportRed", actor =>
	!actor.wired || actor.poweredWires !== 0 ? "on" : "off"
)

// Note: We also check for `wires` here, unlike in the logic.
// This is intentional, this discrepency is also in CC2
registerStateFunction<Actor>("transmogrifier", actor =>
	actor.wires !== 0 && actor.wired && !actor.poweredWires ? "off" : "on"
)
registerStateFunction<Actor>("toggleSwitch", actor => actor.customData)

interface StretchSpecialArt extends SpecialArt {
	idle: Art
	vertical: Frame[]
	horizontal: Frame[]
}

registerSpecialFunction("stretch", function (ctx, actor, art) {
	const spArt = art as StretchSpecialArt
	if (actor.cooldown === 0) {
		this.drawArt(ctx, actor, spArt.idle)
		return
	}
	// Use the base position, not the visual, the frames themselves provide the offset
	const pos = actor.tile.position
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
	let progress = 1 - actor.cooldown / actor.currentMoveSpeed!
	if (framesReversed) {
		progress = 1 - progress
	}
	const frame = frames[Math.floor(progress * frames.length)]
	this.tileBlit(ctx, [pos[0] + offset[0], pos[1] + offset[1]], frame, cropSize)
})

registerSpecialFunction<VoodooTile>("voodoo", function (ctx, actor) {
	if (actor.tileOffset === null) return
	const pos = actor.getVisualPosition()
	const frame: Frame = [
		actor.tileOffset % 0x10,
		Math.floor(actor.tileOffset / 0x10),
	]
	this.tileBlit(ctx, pos, frame)
})

interface RailroadSpecialArt extends SpecialArt {
	toggleMark: Frame
	wood: Record<string, Frame>
	rail: Record<string, Frame>
	toggleRail: Record<string, Frame>
}

registerSpecialFunction<Railroad>("railroad", function (ctx, actor, art) {
	const spArt = art as RailroadSpecialArt
	const pos = actor.getVisualPosition()
	for (const dir of actor.baseRedirects) {
		this.tileBlit(ctx, pos, spArt.wood[dir])
	}
	for (const dir of actor.baseRedirects) {
		if (actor.isSwitch) {
			if (dir === actor.activeTrack) continue
			this.tileBlit(ctx, pos, spArt.toggleRail[dir])
		} else {
			this.tileBlit(ctx, pos, spArt.rail[dir])
		}
	}
	if (actor.isSwitch && actor.baseRedirects.includes(actor.activeTrack)) {
		this.tileBlit(ctx, pos, spArt.rail[actor.activeTrack])
	}
	if (actor.isSwitch) {
		this.tileBlit(ctx, pos, spArt.toggleMark)
	}
})

registerStateFunction<Rover>("rover", actor => actor.emulatedMonster)

interface RoverAntennaSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}

registerSpecialFunction<Rover>("rover antenna", function (ctx, actor, art) {
	const spArt = art as RoverAntennaSpecialArt
	const pos = actor.getVisualPosition()
	const frame = spArt[actorToDir(actor)]
	this.tileBlit(ctx, [pos[0] + 0.25, pos[1] + 0.25], frame, [0.5, 0.5])
})

registerSpecialFunction<Actor>("letters", function (ctx, actor) {
	const pos = actor.getVisualPosition()
	// A space doesn't render anything
	if (actor.customData === " ") return
	const frame = this.tileset.art.letters[actor.customData]
	this.tileBlit(ctx, [pos[0] + 0.25, pos[1] + 0.25], frame, [0.5, 0.5])
})

registerStateFunction<Actor>("greenBomb", actor => actor.customData)

interface CounterSpecialArt extends SpecialArt {
	0: Frame
	1: Frame
	2: Frame
	3: Frame
	4: Frame
	5: Frame
	6: Frame
	7: Frame
	8: Frame
	9: Frame
	"-": Frame
	"": Frame
}

registerSpecialFunction<CounterGate>("counter", function (ctx, actor, art) {
	const spArt = art as CounterSpecialArt
	const pos = actor.getVisualPosition()
	this.tileBlit(
		ctx,
		[pos[0] + 0.125, pos[1]],
		spArt[actor.memory as unknown as "0"],
		[0.75, 1]
	)
})

interface LogicGateSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}

function rotateWires(wires: number, dir: Direction): number {
	return ((wires << dir) | (wires >> (4 - dir))) & 0b1111
}

registerSpecialFunction("logic gate", function (ctx, actor, art) {
	if (actor.level.hideWires) {
		this.drawFloor(ctx, actor.tile)
		return
	}
	const spArt = art as LogicGateSpecialArt
	const pos = actor.getVisualPosition()
	const poweredWires = actor.wires & actor.poweredWires
	// Figure out which wires correspond to the which gate parts.
	const gateHead = rotateWires(0b0001, actor.direction)
	const gateRight = rotateWires(0b0010, actor.direction)
	const gateBack = rotateWires(0b0100, actor.direction)
	const gateLeft = rotateWires(0b1000, actor.direction)

	// Blit left and right as if they are also connected to the back,
	// to have the bends in some tilesets
	// Draw the left side first, the right one has control over the middle
	this.drawWireBase(
		ctx,
		pos,
		gateLeft | gateBack,
		(gateLeft & poweredWires) !== 0
	)
	this.drawWireBase(
		ctx,
		pos,
		gateRight | gateBack,
		(gateRight & poweredWires) !== 0
	)

	// And last, draw the output
	this.drawWireBase(ctx, pos, gateHead, (poweredWires & gateHead) !== 0)
	// Now, just draw the base
	this.tileBlit(ctx, pos, spArt[actorToDir(actor)])
})

function animationStateFunction(actor: Animation): string {
	return Math.floor(
		(1 - actor.animationCooldown / actor.animationLength) * 4
	).toString()
}

registerStateFunction("splashAnim", animationStateFunction)
registerStateFunction("explosionAnim", animationStateFunction)
