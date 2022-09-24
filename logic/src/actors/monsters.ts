import { Actor, matchTags } from "../actor"
import { Layer } from "../tile"
import { Direction, hasOwnProperty, relativeToAbsolute } from "../helpers"
import { actorDB, Decision } from "../const"
import { Fire } from "./terrain"
import { Tile } from "../tile"
import {
	iterableFind,
	iterableIncludes,
	iterableSome,
} from "../iterableHelpers"
import { crossLevelData, onLevelAfterTick } from "../level"

export abstract class Monster extends Actor {
	blocks(): true {
		return true
	}
	tags = ["autonomous-monster", "normal-monster", "movable"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	bumped(other: Actor, _bumpedDirection: Direction): void {
		// Monsters kill players which bump into
		if (
			other.getCompleteTags("tags").includes("real-playable") &&
			!this.getCompleteTags("tags")
				.concat(other.getCompleteTags("tags"))
				.includes("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
	// Monsters kill players which they bump into
	bumpedActor(
		other: Actor,
		_bumpedDirection: Direction,
		_exiting: boolean
	): void {
		// Monsters kill players which bump into them if they can move into them
		if (
			other.getCompleteTags("tags").includes("real-playable") &&
			!this.getCompleteTags("tags")
				.concat(other.getCompleteTags("tags"))
				.includes("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
}

export class Centipede extends Monster {
	id = "centipede"
	transmogrifierTarget = "fireball"
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
}

actorDB["centipede"] = Centipede

export class Ant extends Monster {
	id = "ant"
	transmogrifierTarget = "glider"
	//
	blockedByTags = ["canopy"]
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.LEFT, dir.FORWARD, dir.RIGHT, dir.BACKWARD]
	}
}

actorDB["ant"] = Ant

export class Glider extends Monster {
	id = "glider"
	transmogrifierTarget = "centipede"
	ignoreTags = ["water-ish"]
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.LEFT, dir.RIGHT, dir.BACKWARD]
	}
}

actorDB["glider"] = Glider

export class Fireball extends Monster {
	id = "fireball"
	transmogrifierTarget = "ant"
	collisionIgnoreTags = ["fire"]
	ignoreTags = ["fire"]
	tags = ["autonomous-monster", "normal-monster", "movable", "melting"]
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.RIGHT, dir.LEFT, dir.BACKWARD]
	}
}

actorDB["fireball"] = Fireball

export class Ball extends Monster {
	id = "ball"
	transmogrifierTarget = "walker"
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.BACKWARD]
	}
}

actorDB["ball"] = Ball

export function getVisualCoordinates(actor: Actor): [number, number] {
	if (!actor.cooldown || !actor.currentMoveSpeed || !actor.oldTile)
		return actor.tile.position
	const progress = 1 - actor.cooldown / actor.currentMoveSpeed
	return [
		actor.oldTile.x * (1 - progress) + actor.tile.x * progress,
		actor.oldTile.y * (1 - progress) + actor.tile.y * progress,
	]
}

function getPursuitCoords(
	actor: Actor,
	target: Actor,
	reverse = false
): Direction[] {
	// This uses the visual position of the target
	const targetPos = getVisualCoordinates(target)
	const dx = actor.tile.x - targetPos[0],
		dy = actor.tile.y - targetPos[1]
	const directions: Direction[] = []
	const addAmount = reverse ? 2 : 0
	if (dx) directions.push((Math.sign(dx) + 2 + addAmount) % 4)
	if (dy) directions.push((Math.sign(dy) + 3 - addAmount) % 4)
	if (Math.abs(dy) >= Math.abs(dx)) directions.reverse()
	return directions
}

export class TeethRed extends Monster {
	id = "teethRed"
	transmogrifierTarget = "teethBlue"
	decideMovement(): Direction[] {
		if (!this.level.selectedPlayable || (this.level.currentTick + 5) % 8 >= 4)
			return []
		return getPursuitCoords(
			this,
			this.level.selectedPlayable,
			this.level.selectedPlayable
				.getCompleteTags("tags")
				.includes("scares-teeth-red")
		)
	}
}

actorDB["teethRed"] = TeethRed

export class TeethBlue extends Monster {
	id = "teethBlue"
	transmogrifierTarget = "teethRed"
	decideMovement(): Direction[] {
		if (!this.level.selectedPlayable || (this.level.currentTick + 5) % 8 >= 4)
			return []
		return getPursuitCoords(
			this,
			this.level.selectedPlayable,
			this.level.selectedPlayable
				.getCompleteTags("tags")
				.includes("scares-teeth-blue")
		)
	}
}

actorDB["teethBlue"] = TeethBlue

export class FloorMimic extends Monster {
	id = "floorMimic"
	decideMovement(): Direction[] {
		if (!this.level.selectedPlayable || (this.level.currentTick + 5) % 16 >= 4)
			return []
		return getPursuitCoords(this, this.level.selectedPlayable)
	}
}

actorDB["floorMimic"] = FloorMimic

export class TankBlue extends Monster {
	id = "tankBlue"
	transmogrifierTarget = "tankYellow"
	turnPending = this.customData === "rotating"
	decideMovement(): Direction[] {
		if (this.turnPending) {
			this.turnPending = false
			this.customData = ""
			return [(this.direction + 2) % 4]
		}
		return [this.direction]
	}
	rotateTank(): void {
		this.turnPending = !this.turnPending
		this.customData = this.turnPending ? "rotating" : ""
	}
}

actorDB["tankBlue"] = TankBlue

onLevelAfterTick.push(level => {
	if (crossLevelData.blueButtonPressed) {
		for (const tank of level.decidingActors) {
			if (
				hasOwnProperty(tank, "rotateTank") &&
				typeof tank.rotateTank === "function"
			)
				tank.rotateTank()
		}
		crossLevelData.blueButtonPressed = false
	}
})

export class BlobMonster extends Monster {
	id = "blob"
	immuneTags = ["slime"]
	moveSpeed = 8
	transmogrifierTarget(): string {
		return [
			"glider",
			"centipede",
			"fireball",
			"ant",
			"walker",
			"ball",
			"teethRed",
			"tankBlue",
			"teethBlue",
		][this.level.random() % 9]
	}
	newTileJoined(): void {
		const spreadedSlime =
			this.oldTile &&
			iterableFind(this.oldTile.allActors, (val: Actor) =>
				val.getCompleteTags("tags").includes("slime")
			)
		if (spreadedSlime && !this.tile.hasLayer(spreadedSlime.layer))
			new actorDB[spreadedSlime.id](
				this.level,
				this.tile.position,
				spreadedSlime.customData
			)
	}
	decideMovement(): [] {
		// Weird quirk: blobs don't check collision at decision time
		this.moveDecision = ((this.level.random() + this.level.blobMod()) % 4) + 1
		return []
	}
	blockedBy(other: Actor) {
		return (
			other.getCompleteTags("tags").includes("canopy") &&
			iterableSome(this.tile[Layer.SPECIAL], val =>
				val.getCompleteTags("tags").includes("canopy")
			)
		)
	}
}

actorDB["blob"] = BlobMonster

export class Walker extends Monster {
	id = "walker"
	transmogrifierTarget = "ball"
	decideMovement(): [Direction] {
		if (!this.checkCollision(this.direction))
			return [(this.level.random() + this.direction) % 4]
		return [this.direction]
	}
}

actorDB["walker"] = Walker

export class LitTNT extends Monster {
	lifeLeft = 253
	tags = ["movable", "cc1block", "tnt"]
	immuneTags: string[] = []
	explosionStage: 0 | 1 | 2 | 3 = 0
	id = "tntLit"
	nukeTile(tile: Tile): void {
		let protectedLayer: Layer = Layer.STATIONARY
		const tileHadMovable = tile.hasLayer(Layer.MOVABLE)
		let movableDied = false
		// TODO Canopies
		if (tileHadMovable) protectedLayer = Layer.STATIONARY + 1 // Protect stationary only
		const protector = iterableFind(tile.allActors, val =>
			val.getCompleteTags("tags").includes("blocks-tnt")
		)
		if (protector) protectedLayer = protector.layer
		//a
		for (const actor of Array.from(tile.allActorsReverse))
			if (actor.layer >= protectedLayer) {
				actor.bumped?.(
					this,
					Math.abs(tile.x - this.tile.x) > Math.abs(tile.y - this.tile.y)
						? 2 + Math.sign(tile.x - this.tile.x)
						: 1 + Math.sign(tile.y - this.tile.y)
				)
				if (
					(!actor.exists ||
						actor.destroy(
							this,
							actor.layer === Layer.STATIONARY || actor.layer === Layer.MOVABLE
								? "explosion"
								: null,
							false,
							true
						)) &&
					actor.layer === Layer.MOVABLE
				)
					movableDied = true
			}
		// Create a memorial fire if a movable got blown up (if we can)
		if (tileHadMovable && movableDied && !tile.hasLayer(Layer.STATIONARY))
			new Fire(this.level, tile.position)
	}
	onEachDecision(): void {
		if (this.lifeLeft > 0) this.lifeLeft--
		else this.explosionStage++
		if (!this.explosionStage) return
		this.tags.push("melting") // For ice blocks
		this.immuneTags.push("bowling-ball")
		for (const tile of this.tile.getDiamondSearch(this.explosionStage))
			if (
				Math.abs(tile.x - this.tile.x) < 3 &&
				Math.abs(tile.y - this.tile.y) < 3
			)
				this.nukeTile(tile)
		if (this.explosionStage >= 3) this.nukeTile(this.tile)
		this.tags.pop()
		this.immuneTags.pop()
	}
}
actorDB["tntLit"] = LitTNT

export class TankYellow extends Monster {
	id = "tankYellow"
	tags = ["normal-monster", "movable"]
	pushTags = ["block"]
	transmogrifierTarget = "tankBlue"
	movePending: Decision = this.customData === "rotating" ? -1 : Decision.NONE
	decideMovement(): [] {
		if (this.movePending) {
			//@ts-expect-error You literally didn't check if -1 is Decision 3 lines ago, shut up
			if (this.movePending === -1) {
				this.movePending = this.direction + 1
			}
			this.customData = ""
			if (this.checkCollision(this.movePending - 1))
				this.moveDecision = this.level.resolvedCollisionCheckDirection + 1
			this.direction = this.level.resolvedCollisionCheckDirection
			this.movePending = Decision.NONE
		}
		return []
	}
	rotateYellowTank(data: Decision): void {
		this.customData = "rotating"
		this.movePending = data
	}
}

actorDB["tankYellow"] = TankYellow

onLevelAfterTick.push(level => {
	if (crossLevelData.currentYellowButtonPress) {
		for (const tank of level.decidingActors) {
			if (
				hasOwnProperty(tank, "rotateYellowTank") &&
				typeof tank.rotateYellowTank === "function"
			)
				tank.rotateYellowTank(crossLevelData.currentYellowButtonPress)
		}
		crossLevelData.currentYellowButtonPress = Decision.NONE
	}
})

export class RollingBowlingBall extends Monster {
	id = "bowlingBallRolling"
	tags = [
		"can-pickup-items",
		"movable",
		"interacts-with-closed-clone-machine",
		"bowling-ball",
	]
	decideMovement(): [Direction] {
		return [this.direction]
	}
	bumped(other: Actor, direction: Direction): void {
		this.bumpedActor(other, direction, false)
	}
	bumpedActor(other: Actor, direction: Direction, exiting: boolean): void {
		if (!this.exists) return
		if (
			(!exiting && other._internalBlocks(this, direction)) ||
			(exiting && other._internalExitBlocks(this, direction))
		) {
			if (other.layer === Layer.MOVABLE) {
				other.destroy(this)
				this.destroy(this)
			} else if (!this.slidingState) this.destroy(this)
		}
	}
	bumpedEdge(): void {
		if (!this.slidingState) this.destroy(this)
	}
}

actorDB["bowlingBallRolling"] = RollingBowlingBall

export const roverMimicOrder: string[] = [
	"teethRed",
	"glider",
	"ant",
	"ball",
	"teethBlue",
	"fireball",
	"centipede",
	"walker",
]

export class Rover extends Monster {
	id = "rover"
	tags = ["autonomous-monster", "can-pickup-items", "movable"]
	pushTags = ["block"]
	blockedByTags = ["canopy"]
	moveSpeed = 8
	emulatedMonster: typeof roverMimicOrder[number] = roverMimicOrder[0]
	decisionsUntilNext = 32
	decideMovement(): Direction[] {
		this.decisionsUntilNext--
		if (!this.decisionsUntilNext) {
			this.emulatedMonster =
				roverMimicOrder[
					(roverMimicOrder.indexOf(this.emulatedMonster) + 1) %
						roverMimicOrder.length
				]
			this.decisionsUntilNext = 32
		}
		return (
			actorDB[this.emulatedMonster].prototype.decideMovement?.apply(this) || []
		)
	}
}

actorDB["rover"] = Rover

export class MirrorChip extends Monster {
	tags = [
		"can-pickup-items",
		"playable",
		"chip",
		"movable",
		"can-reuse-key-green",
	]
	pushTags = ["block"]
	id = "mirrorChip"
	fakes = "chip"
	transmogrifierTarget = "mirrorMelinda"
	decideMovement(): Direction[] {
		if (
			!this.level.selectedPlayable ||
			this.level.selectedPlayable.id !== this.fakes ||
			this.level.selectedPlayable.lastDecision === Decision.NONE
		)
			return []
		this.moveDecision = this.level.selectedPlayable.lastDecision
		return []
	}
}

actorDB["mirrorChip"] = MirrorChip

export class MirrorMelinda extends Monster {
	tags = [
		"can-pickup-items",
		"playable",
		"melinda",
		"movable",
		"can-reuse-key-yellow",
	]
	pushTags = ["block"]
	ignoreTags = ["ice"]
	id = "mirrorMelinda"
	fakes = "melinda"
	transmogrifierTarget = "mirrorChip"
	decideMovement(): Direction[] {
		if (
			!this.level.selectedPlayable ||
			this.level.selectedPlayable.id !== this.fakes ||
			this.level.selectedPlayable.lastDecision === Decision.NONE
		)
			return []
		this.moveDecision = this.level.selectedPlayable.lastDecision
		return []
	}
}

actorDB["mirrorMelinda"] = MirrorMelinda

export class Ghost extends Monster {
	id = "ghost"
	tags = [
		"can-pickup-items",
		"movable",
		"ghost",
		"weirdly-ignores-ice",
		"ignores-exit-block",
	]
	ghostBlockedByTags = ["blocks-ghost", "water-ish"]
	nonIgnoredTags = [
		"machinery",
		"button",
		"door",
		"echip-gate",
		"jet",
		"no-sign",
		"ice",
		"water-ish",
	]
	ignoreTags = ["bonusFlag", "bomb"]
	ghostCollisionIgnoreTags = ["door", "echip-gate", "ice"]
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.LEFT, dir.RIGHT, dir.BACKWARD]
	}
	blockedBy(other: Actor): boolean {
		if (other.tile.hasLayer(Layer.ITEM_SUFFIX)) return false
		return matchTags(other.getCompleteTags("tags"), this.ghostBlockedByTags)
	}
	collisionIgnores(other: Actor): boolean {
		if (other.tile.hasLayer(Layer.ITEM_SUFFIX)) return false
		const otherTags = other.getCompleteTags("tags")
		return (
			otherTags.some(val => this.ghostCollisionIgnoreTags.includes(val)) ||
			(!otherTags.some(
				val =>
					this.ghostBlockedByTags.includes(val) ||
					this.nonIgnoredTags.includes(val)
			) &&
				other.layer !== Layer.MOVABLE)
		)
	}
	ignores(other: Actor): boolean {
		return (
			!other
				.getCompleteTags("tags")
				.some(val => this.nonIgnoredTags.includes(val)) &&
			other.layer !== Layer.ITEM &&
			other.layer !== Layer.MOVABLE
		)
	}
	newTileJoined(): void {
		if (this.tile.hasLayer(Layer.ITEM_SUFFIX)) {
			this.blockedByTags = []
			this.collisionIgnoreTags = []
		} else {
			this.blockedByTags = ["blocks-ghost", "water-ish"]
			this.collisionIgnoreTags = ["door", "echip-gate", "ice"]
		}
	}
}

actorDB["ghost"] = Ghost
