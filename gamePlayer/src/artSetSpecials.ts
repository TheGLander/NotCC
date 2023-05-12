import {
	Actor,
	BonusFlag,
	CloneMachine,
	CustomFloor,
	CustomWall,
	Direction,
	DirectionString,
	DirectionalBlock,
	FlameJet,
	InvisibleWall,
	LitTNT,
	Playable,
	ThinWall,
	Tile,
	Trap,
} from "@notcc/logic"
import { registerSpecialFunction, registerStateFunction } from "./const"
import { Art, Frame, Position, Size, SpecialArt, ctxToDir } from "./renderer"

function getPlayableState(actor: Playable): string {
	const inWater = actor.tile.findActor(actor =>
		actor.getCompleteTags("tags").includes("water")
	)
	if (inWater) return "water"
	if (actor.playerBonked) return "bump"
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
	function (ctx, art) {
		const spArt = art as FreeformWiresSpecialArt
		const pos = Array.isArray(ctx.actor)
			? ctx.actor
			: ctx.actor instanceof Tile
			? ctx.actor.position
			: ctx.actor.tile.position
		//const wires = Array.isArray(ctx.actor) ? 0 : ctx.actor.wires

		this.tileBlit(ctx, pos, spArt.base)
	}
)
interface ArrowsSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
	CENTER: Frame
}

const arrowOffsets: Record<DirectionString, Position> = {
	UP: [0, 0],
	RIGHT: [0.75, 0],
	DOWN: [0, 0.75],
	LEFT: [0, 0],
}

registerSpecialFunction<CloneMachine | DirectionalBlock>(
	"arrows",
	function (ctx, art) {
		const spArt = art as ArrowsSpecialArt
		const pos = ctx.actor.getVisualPosition()
		const directions =
			"legalDirections" in ctx.actor
				? ctx.actor.legalDirections
				: ctx.actor.cloneArrows
		for (const directionN of directions) {
			const direction = Direction[directionN] as DirectionString
			const offset = arrowOffsets[direction]
			this.tileBlit(
				ctx,
				[pos[0] + offset[0], pos[1] + offset[1]],
				spArt[direction],
				direction === "UP" || direction === "DOWN" ? [1, 0.25] : [0.25, 1]
			)
		}
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

registerSpecialFunction<Actor>("scrolling", function (ctx, art) {
	const spArt = art as ScrollingSpecialArt
	const offsetMult = (ctx.ticks / spArt.duration) % 1
	const baseFrames = spArt[ctxToDir(ctx)]
	const offset: Frame = [
		baseFrames[1][0] - baseFrames[0][0],
		baseFrames[1][1] - baseFrames[0][1],
	]
	const frame: Frame = [
		baseFrames[0][0] + offset[0] * offsetMult,
		baseFrames[0][1] + offset[1] * offsetMult,
	]
	const pos = ctx.actor.getVisualPosition()
	this.tileBlit(ctx, pos, frame)
})

interface FuseSpecialArt extends SpecialArt {
	duration: number
	frames: Frame[]
}

registerSpecialFunction<Actor>("fuse", function (ctx, art) {
	const spArt = art as FuseSpecialArt
	const frameN = Math.floor(
		spArt.frames.length * ((ctx.ticks / spArt.duration) % 1)
	)
	const pos = ctx.actor.getVisualPosition()
	this.tileBlit(ctx, [pos[0] + 0.5, pos[1]], spArt.frames[frameN], [0.5, 0.5])
})

interface PerspectiveSpecialArt extends SpecialArt {
	somethingUnderneathOnly?: boolean
	default: Art
	revealed: Art
}

registerSpecialFunction<Actor>("perspective", function (ctx, art) {
	const spArt = art as PerspectiveSpecialArt
	let perspective = ctx.actor.level.getPerspective()
	if (perspective && spArt.somethingUnderneathOnly) {
		perspective = !!ctx.actor.tile.findActor(
			actor => actor.layer < ctx.actor.layer
		)
	}
	this.drawArt(ctx, perspective ? spArt.revealed : spArt.default)
})

// freeform wires, letters
// wires in general

interface ThinWallsSpecialArt extends SpecialArt {
	UP: Frame
	RIGHT: Frame
	DOWN: Frame
	LEFT: Frame
}

const thinWallOffsets: Record<DirectionString, Position> = {
	UP: [0, 0],
	RIGHT: [0.5, 0],
	DOWN: [0, 0.5],
	LEFT: [0, 0],
}

registerSpecialFunction<ThinWall>("thin walls", function (ctx, art) {
	const spArt = art as ThinWallsSpecialArt
	const pos = ctx.actor.getVisualPosition()
	for (let dirN = Direction.UP; dirN <= Direction.LEFT; dirN += 1) {
		const hasDir = ctx.actor.allowedDirections & (1 << dirN)
		const dir = Direction[dirN] as DirectionString
		if (!hasDir) continue
		const cropSize: Size = dir === "UP" || dir === "DOWN" ? [1, 0.5] : [0.5, 1]
		const frame = spArt[dir]
		const offset = thinWallOffsets[dir]
		this.tileBlit(
			ctx,
			[pos[0] + offset[0], pos[1] + offset[1]],
			frame,
			cropSize
		)
	}
})

registerStateFunction<ThinWall>("thinWall", actor =>
	actor.getCompleteTags("tags").includes("canopy") ? "canopy" : "nothing"
)

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

registerSpecialFunction<StretchSpecialArt>("stretch", function (ctx, art) {
	const spArt = art as StretchSpecialArt
	if (ctx.actor.cooldown === 0) {
		this.drawArt(ctx, spArt.idle)
		return
	}
	// Use the base position, not the visual, the frames themselves provide the offset
	const pos = ctx.actor.tile.position
	let frames: Frame[]
	let framesReversed: boolean
	const dir = ctx.actor.direction
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
	let progress = 1 - ctx.actor.cooldown / ctx.actor.currentMoveSpeed!
	if (framesReversed) {
		progress = 1 - progress
	}
	const frame = frames[Math.floor(progress * frames.length)]
	this.tileBlit(ctx, [pos[0] + offset[0], pos[1] + offset[1]], frame, cropSize)
})
