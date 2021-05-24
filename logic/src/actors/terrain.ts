import { Actor, SlidingState } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Wall } from "./walls"
import { matchTags } from "../actor"
import { Playable } from "./playables"
import {
	GameState,
	LevelState,
	crossLevelData,
	onLevelDecisionTick,
} from "../level"
import { Direction } from "../helpers"
import { onLevelAfterTick, onLevelStart } from "../level"

export class LetterTile extends Actor {
	id = "letterTile"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["letterTile"] = LetterTile

export class CustomFloor extends Actor {
	id = "customFloor"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["customFloor"] = CustomFloor

export class Ice extends Actor {
	id = "ice"
	tags = ["ice"]
	getLayer(): Layer {
		return Layer.STATIONARY
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
	getLayer(): Layer {
		return Layer.STATIONARY
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
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		other.slidingState = SlidingState.WEAK
		other.direction = this.direction
	}
	newActorOnTile = this.actorCompletelyJoined
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
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		other.slidingState = SlidingState.WEAK
		crossLevelData.RFFDirection ??= 0
		other.direction = crossLevelData.RFFDirection++
		crossLevelData.RFFDirection %= 4
	}
	newActorOnTile = this.actorCompletelyJoined
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
	getLayer(): Layer {
		return Layer.STATIONARY
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
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, null)
	}
}

actorDB["void"] = Void

export class Water extends Actor {
	id = "water"
	tags = ["water"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, "splash")
	}
}

actorDB["water"] = Water

export class Dirt extends Actor {
	id = "dirt"
	tags = ["filth"]
	getLayer(): Layer {
		return Layer.STATIONARY
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
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "melinda"]
}

actorDB["gravel"] = Gravel

export class Exit extends Actor {
	id = "exit"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (other instanceof Playable) {
			other.destroy(this, null)
			this.level.gameState = GameState.PLAYING
			this.level.playablesLeft--
			this.level.playablesToSwap = true
			if (this.level.playablesLeft <= 0) this.level.gameState = GameState.WON
		}
	}
}

actorDB["exit"] = Exit

export class EChipGate extends Actor {
	id = "echipGate"
	immuneTags = ["tnt"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "block"]
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
	hint?: string
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		this.level.hintsLeftInLevel++
	}
	levelStarted(): void {
		this.level.hintsLeftInLevel--
		if (this.level.hintsLeftInLevel > this.level.hintsLeft.length)
			this.hint = this.level.defaultHint
		else this.hint = this.level.hintsLeft[this.level.hintsLeftInLevel]
	}
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		// Sorry
		if (other instanceof Playable && this.hint)
			(alert ?? console.log)(this.hint)
	}
	blockTags = ["normal-monster", "cc1block"]
}

actorDB["hint"] = Hint

export class Fire extends Actor {
	id = "fire"
	tags = ["fire", "melting"]
	blockTags = ["autonomous-monster"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this)
	}
}

actorDB["fire"] = Fire

export class ThiefTool extends Actor {
	id = "thiefTool"
	blockTags = ["normal-monster", "cc1block"]
	getLayer(): Layer {
		return Layer.STATIONARY
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
	blockTags = ["normal-monster", "cc1block"]
	getLayer(): Layer {
		return Layer.STATIONARY
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
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	exitBlocks(): boolean {
		return this.openRequests === 0
	}
	newActorOnTile(actor: Actor): void {
		if (this.openRequests === 0) actor.slidingState = SlidingState.WEAK
	}
	actorCompletelyJoined = this.newActorOnTile
	caresButtonColors = ["brown"]
	buttonPressed(): void {
		this.openRequests++
	}
	buttonUnpressed(): void {
		this.openRequests = Math.max(0, this.openRequests - 1)
		if (this.openRequests === 0)
			for (const movable of this.tile[Layer.MOVABLE])
				this.newActorOnTile(movable)
	}
}

actorDB["trap"] = Trap

// TODO CC1 clone machines, direction arrows on clone machine
export class CloneMachine extends Actor {
	id = "cloneMachine"
	isCloning = false
	// Always block boomer actors
	blockTags = ["cc1block", "normal-monster", "playable"]
	// Block actors when this already has a source
	blocks(): boolean {
		return this.tile[Layer.MOVABLE].length > 0
	}
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	// Allow actors to exit while cloning, so they can properly move out of the tile
	exitBlocks(): boolean {
		return !this.isCloning
	}
	newActorOnTile(actor: Actor): void {
		actor.slidingState = SlidingState.STRONG
	}
	actorCompletelyJoined = this.newActorOnTile
	caresButtonColors = ["red"]
	buttonPressed(): boolean {
		this.isCloning = true
		for (const clonee of [...this.tile[Layer.MOVABLE]]) {
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
	getLayer(): Layer {
		return Layer.ITEM // Yes
	}
	actorCompletelyJoined(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		other.destroy(this, null)
		this.destroy(other)
	}
	newActorOnTile = this.actorCompletelyJoined
}

actorDB["bomb"] = Bomb

export class Turtle extends Actor {
	id = "turtle"
	tags = ["blocks-ghost"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["melting"]
	actorLeft(): void {
		this.destroy(null, "splash")
		new Water(this.level, this.tile.position)
	}
}

actorDB["turtle"] = Turtle

export class GreenBomb extends Actor {
	id = "greenBomb"
	tags = ["bomb"]
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string
	) {
		super(level, position, customData)
		level.chipsTotal++
		level.chipsLeft++
		level.chipsRequired++
	}
	getLayer(): Layer {
		return Layer.ITEM // Yes
	}
	actorCompletelyJoined(other: Actor): void {
		if (this.customData === "bomb") {
			other.destroy(this, null)
			this.destroy(other)
		} else if (other instanceof Playable) {
			this.destroy(null, null)
			this.level.chipsLeft = Math.max(0, this.level.chipsLeft - 1)
		}
	}
	caresButtonColors = ["green"]
	buttonPressed(): void {
		this.customData = this.customData === "bomb" ? "echip" : "bomb"
	}
}

actorDB["greenBomb"] = GreenBomb

export class Slime extends Actor {
	id = "slime"
	tags = ["slime"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		const otherTags = other.getCompleteTags("tags")
		if (
			otherTags.includes("dies-in-slime") ||
			!matchTags(otherTags, ["block", "clears-slime"])
		)
			other.destroy(this, "splash")
		else this.destroy(null, null)
	}
}

actorDB["slime"] = Slime

export class FlameJet extends Actor {
	id = "flameJet"
	tags = this.customData === "on" ? ["fire"] : []
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	updateTags(): void {
		if (this.customData === "on" && !this.tags.includes("fire"))
			this.tags.push("fire")
		else if (this.customData === "off" && this.tags.includes("fire"))
			this.tags.splice(this.tags.indexOf("fire"))
	}
	continuousActorCompletelyJoined(other: Actor): void {
		if (this.customData === "on" && other.layer === Layer.MOVABLE)
			other.destroy(this)
	}
	caresButtonColors = ["orange"]
	buttonPressed(): void {
		this.customData = this.customData === "on" ? "off" : "on"
		this.updateTags()
	}
	buttonUnpressed = this.buttonPressed
}

actorDB["flameJet"] = FlameJet

export const updateJetlife = (level: LevelState): void => {
	if (!level.levelData?.customData?.jetlife) return
	if (
		(level.currentTick * 3 + level.subtick) %
			parseInt(level.levelData.customData.jetlife) !==
		0
	)
		return
	const queuedUpdates: [FlameJet, string][] = []
	for (const actor of level.actors)
		if (actor instanceof FlameJet) {
			let neighbors = 0
			for (let xOff = -1; xOff <= 1; xOff++)
				for (let yOff = -1; yOff <= 1; yOff++) {
					const tile = level.field[actor.tile.x + xOff]?.[actor.tile.y + yOff]
					if (tile && !(xOff === 0 && yOff === 0))
						for (const actor of tile.allActors)
							if (actor.getCompleteTags("tags").includes("fire")) neighbors++
				}
			if (neighbors === 3) queuedUpdates.push([actor, "on"])
			else if (neighbors !== 2) queuedUpdates.push([actor, "off"])
		}
	for (const update of queuedUpdates) {
		update[0].customData = update[1]
		update[0].updateTags()
	}
}

onLevelDecisionTick.push(updateJetlife)
