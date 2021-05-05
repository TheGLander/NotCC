import {
	Actor,
	SlidingState,
	ActorArt,
	genericDirectionableArt,
} from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Wall } from "./walls"
import { genericAnimatedArt } from "../actor"
import { Playable } from "./playables"
import {
	GameState,
	LevelState,
	CrossLevelDataInterface,
	crossLevelData,
} from "../level"
import { Direction } from "../helpers"

export class Ice extends Actor {
	id = "ice"
	tags = ["ice"]
	art: ActorArt = { actorName: "ice" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
	onMemberSlideBonked(other: Actor): void {
		// Turn the other way
		other.direction += 2
		other.direction %= 4
	}
	speedMod(): 2 {
		return 2
	}
}
actorDB["ice"] = Ice

export class IceCorner extends Actor {
	id = "iceCorner"
	tags = ["ice"]
	art = (): ActorArt => ({
		actorName: "ice",
		animation: ["ur", "dr", "dl", "ul"][this.direction],
	})
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
	actorCompletelyJoined(other: Actor): void {
		other.direction += (this.direction - other.direction) * 2 + 3
		other.direction %= 4
	}
	onMemberSlideBonked(other: Actor): void {
		other.direction -= (this.direction - other.direction) * 2 - 5
		other.direction %= 4
	}
	speedMod(): 2 {
		return 2
	}
	blocks(_other: Actor, otherMoveDirection: Direction): boolean {
		return !(
			otherMoveDirection === this.direction ||
			otherMoveDirection === (this.direction + 1) % 4
		)
	}
	// TODO Block exit from ice corners with cleats
}
actorDB["iceCorner"] = IceCorner

export class ForceFloor extends Actor {
	id = "forceFloor"
	tags = ["force-floor"]
	art = (): ActorArt => ({
		actorName: "forceFloor",
		animation: ["up", "right", "down", "left"][this.direction],
		sourceOffset:
			this.direction % 2 === 0
				? [0, ((1 - this.direction) * (this.level.currentTick / 16)) % 1]
				: [((this.direction - 2) * (this.level.currentTick / 16)) % 1, 0],
		frame: 1.5 - Math.abs(this.direction - 1.5),
	})
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		other.direction = this.direction
	}
	levelStarted(): void {
		// Pretend like everyone stepped on this on level start
		for (const actor of this.tile[Layers.MOVABLE])
			this.actorCompletelyJoined(actor)
	}
	onMemberSlideBonked(other: Actor): void {
		// Give them a single subtick of cooldown
		// FIXME First bump doesn't yield a cooldown in CC2
		other.cooldown++
	}
	speedMod(): 2 {
		return 2
	}
}

actorDB["forceFloor"] = ForceFloor

export class ForceFloorRandom extends Actor {
	id = "forceFloorRandom"
	tags = ["force-floor"]
	art = genericAnimatedArt("forceFloor", 8, "random")
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		crossLevelData.RFFDirection ??= 0
		other.direction = crossLevelData.RFFDirection++
		crossLevelData.RFFDirection %= 4
	}
	levelStarted(): void {
		// Pretend like everyone stepped on this on level start
		for (const actor of this.tile[Layers.MOVABLE])
			this.actorCompletelyJoined(actor)
	}
	onMemberSlideBonked(other: Actor): void {
		// Give them a single subtick of cooldown
		// FIXME First bump doesn't yield a cooldown in CC2
		other.cooldown++
	}
	speedMod(): 2 {
		return 2
	}
}
declare module "../level" {
	export interface CrossLevelDataInterface {
		RFFDirection?: Direction
	}
}

crossLevelData.RFFDirection = Direction.UP

actorDB["forceFloorRandom"] = ForceFloorRandom

// random

export class RecessedWall extends Actor {
	id = "popupWall"
	art = { actorName: "popupWall" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	// Funny how recessed walls have the exact same collision as monsters
	blockTags = ["!playable"]
	actorLeft(): void {
		this.destroy(this, null)
		new Wall(this.level, this.tile.position)
	}
}

actorDB["popupWall"] = RecessedWall

export class Void extends Actor {
	id = "void"
	art = { actorName: "exit" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, null)
	}
}

actorDB["void"] = Void

export class Water extends Actor {
	id = "water"
	tags = ["water"]
	art = genericAnimatedArt("water", 4)
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, "splash")
	}
}

actorDB["water"] = Water

export class Dirt extends Actor {
	id = "dirt"
	tags = ["filth"]
	art = { actorName: "dirt" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["cc1block", "normal-monster", "melinda"]
	actorCompletelyJoined(): void {
		this.destroy(this, null)
	}
}

actorDB["dirt"] = Dirt

export class Gravel extends Actor {
	id = "gravel"
	tags = ["filth"]
	art: ActorArt = { actorName: "gravel" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["normal-monster", "melinda"]
}

actorDB["gravel"] = Gravel

export class Exit extends Actor {
	id = "exit"
	art = genericAnimatedArt("exit", 4)
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (other instanceof Playable) {
			other.destroy(this, null)
			this.level.gameState = GameState.PLAYING
			if (this.level.playables.length === 0)
				this.level.gameState = GameState.WON
		}
	}
}

actorDB["exit"] = Exit

export class EChipGate extends Actor {
	id = "echipGate"
	art = { actorName: "echipGate" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["normal-monster", "block"] // TODO Directional blocks
	actorCompletelyJoined(other: Actor): void {
		if (this.level.chipsLeft === 0) this.destroy(other, null)
	}
	blocks(): boolean {
		return this.level.chipsLeft !== 0
	}
}

actorDB["echipGate"] = EChipGate

export class Hint extends Actor {
	id = "hint"
	art = { actorName: "hint" }
	hint: string | null = null
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		const hint =
			level.hintsLeft.length === 1 ? level.hintsLeft[0] : level.hintsLeft.pop()
		if (hint) this.hint = hint
	}
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		// Sorry
		if (other instanceof Playable && this.hint) alert(this.hint)
	}
	blockTags = ["normal-monster", "cc1block"]
}

actorDB["hint"] = Hint

export class Fire extends Actor {
	id = "fire"
	art = genericAnimatedArt("fire", 4)
	tags = ["fire", "melting"]
	blockTags = ["monster"]
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this)
	}
}

actorDB["fire"] = Fire

export class ThiefTool extends Actor {
	id = "thiefTool"
	art: ActorArt = { actorName: "thief", animation: "tool" }
	blockTags = ["normal-monster", "cc1block"]
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		if (!(other instanceof Playable)) return
		// TODO Bribes
		other.inventory.items = []
		this.level.bonusPoints = Math.floor(this.level.bonusPoints / 2)
	}
}

actorDB["thiefTool"] = ThiefTool

export class ThiefKey extends Actor {
	id = "thiefKey"
	art: ActorArt = { actorName: "thief", animation: "key" }
	blockTags = ["normal-monster", "cc1block"]
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		if (!(other instanceof Playable)) return
		// TODO Bribes
		other.inventory.keys = {}
		this.level.bonusPoints = Math.floor(this.level.bonusPoints / 2)
	}
}

actorDB["thiefKey"] = ThiefKey

export class Trap extends Actor {
	id = "trap"
	// The amount of buttons current pressed and linked to this trap
	openRequests = 0
	art: () => ActorArt = () => ({
		actorName: "trap",
		animation: this.openRequests > 0 ? "open" : "closed",
	})
	get layer(): Layers {
		return Layers.STATIONARY
	}
	exitBlocks(): boolean {
		return this.openRequests === 0
	}
	canTileMemberDecide(): boolean {
		return this.openRequests > 0
	}
	buttonPressed(color: string): boolean {
		if (color !== "brown") return false
		this.openRequests++
		// If we just opened the trap, force the actor outta the tile
		if (this.openRequests === 1)
			for (const trapped of this.tile[Layers.MOVABLE])
				trapped._internalStep(trapped.direction)

		return true
	}
	buttonUnpressed(color: string): boolean {
		if (color !== "brown") return false
		this.openRequests--
		return true
	}
}

actorDB["trap"] = Trap

// TODO CC1 clone machines, direction arrows on clone machine
export class CloneMachine extends Actor {
	id = "cloneMachine"
	art = {
		actorName: "cloneMachine",
	}
	isCloning = false
	// Always block boomer actors
	blockTags = ["cc1block", "normal-monster"]
	// Block actors when this already has a source
	blocks(): boolean {
		return this.tile[Layers.MOVABLE].length > 0
	}
	get layer(): Layers {
		return Layers.STATIONARY
	}
	// Allow actors to exit while cloning, so they can properly move out of the tile
	exitBlocks(): boolean {
		return !this.isCloning
	}
	canTileMemberDecide(): boolean {
		return this.isCloning
	}
	buttonPressed(color: string): boolean {
		if (color !== "red") return false
		this.isCloning = true
		for (const clonee of [...this.tile[Layers.MOVABLE]]) {
			const direction = clonee.direction

			if (!this.level.checkCollision(clonee, direction, true)) continue
			clonee._internalStep(direction)
			new actorDB[clonee.id](
				this.level,
				this.tile.position,
				clonee.customData
			).direction = direction
		}
		this.isCloning = false
		return true
	}
}

actorDB["cloneMachine"] = CloneMachine

export class Bomb extends Actor {
	id = "bomb"
	tags = ["bomb"]
	art: () => ActorArt = (() => {
		let frame = 0
		return (): ActorArt => ({
			actorName: "bomb",
			compositePieces: [
				{
					actorName: "bombFuse",
					cropSize: [0.5, 0.5],
					animation: (frame++ % 4).toString(),
					imageOffset: [0.5, 0],
				},
			],
		})
	})()
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, null)
		this.destroy(other)
	}
	levelStarted(): void {
		if (this.tile[Layers.MOVABLE].length > 0)
			this.actorCompletelyJoined(this.tile[Layers.MOVABLE][0])
	}
}

actorDB["bomb"] = Bomb

export class Turtle extends Actor {
	id = "turtle"
	tags = ["blocks-ghost"]
	get layer(): Layers {
		return Layers.STATIONARY
	}
	art = (): ActorArt => ({
		actorName: "water",
		frame: this.level.currentTick % 4,
		compositePieces: [
			{
				actorName: "turtle",
				frame: Math.floor(this.level.currentTick / 3) % 3,
			},
		],
	})
	blockTags = ["melting"]
	actorLeft(): void {
		this.destroy(null, "splash")
		new Water(this.level, this.tile.position)
	}
}

actorDB["turtle"] = Turtle
