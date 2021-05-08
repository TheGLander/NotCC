import {
	Actor,
	SlidingState,
	ActorArt,
	genericDirectionableArt,
} from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Wall } from "./walls"
import { genericAnimatedArt, matchTags } from "../actor"
import { Playable } from "./playables"
import {
	GameState,
	LevelState,
	CrossLevelDataInterface,
	crossLevelData,
	onLevelDecisionTick,
} from "../level"
import { Direction } from "../helpers"
import { onLevelAfterTick, onLevelStart } from "../level"

export class LetterTile extends Actor {
	id = "letterTile"
	art: ActorArt[] = [
		{
			actorName: "floor",
			animation: "framed",
		},
		{
			actorName: "letter",
			animation: this.customData,
			cropSize: [0.5, 0.5],
			imageOffset: [0.25, 0.25],
		},
	]
	get layer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["letterTile"] = LetterTile

export class CustomFloor extends Actor {
	id = "customFloor"
	art: ActorArt = { actorName: "customFloor", animation: this.customData }
	get layer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["customFloor"] = CustomFloor

export class Ice extends Actor {
	id = "ice"
	tags = ["ice"]
	art: ActorArt = { actorName: "ice" }
	get layer(): Layer {
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
	art = (): ActorArt => ({
		actorName: "ice",
		animation: ["ur", "dr", "dl", "ul"][this.direction],
	})
	get layer(): Layer {
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
	art = (): ActorArt => ({
		actorName: "forceFloor",
		animation: ["up", "right", "down", "left"][this.direction],
		sourceOffset:
			this.direction % 2 === 0
				? [0, ((1 - this.direction) * (this.level.currentTick / 16)) % 1]
				: [((this.direction - 2) * (this.level.currentTick / 16)) % 1, 0],
		frame: 1.5 - Math.abs(this.direction - 1.5),
	})
	get layer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
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
	art = genericAnimatedArt("forceFloor", 8, "random")
	get layer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
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
	art = { actorName: "popupWall" }
	get layer(): Layer {
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
	art = { actorName: "exit" }
	get layer(): Layer {
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
	art = genericAnimatedArt("water", 4)
	get layer(): Layer {
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
	art = { actorName: "dirt" }
	get layer(): Layer {
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
	art: ActorArt = { actorName: "gravel" }
	get layer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "melinda"]
}

actorDB["gravel"] = Gravel

export class Exit extends Actor {
	id = "exit"
	art = genericAnimatedArt("exit", 4)
	get layer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (other instanceof Playable) {
			other.destroy(this, null)
			this.level.gameState = GameState.PLAYING
			this.level.playablesLeft--
			if (this.level.playablesLeft === 0) this.level.gameState = GameState.WON
		}
	}
}

actorDB["exit"] = Exit

export class EChipGate extends Actor {
	id = "echipGate"
	immuneTags = ["tnt"]
	art = { actorName: "echipGate" }
	get layer(): Layer {
		return Layer.STATIONARY
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
	hint?: string
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		this.level.hintsLeftInLevel++
	}
	levelStarted() {
		this.level.hintsLeftInLevel--
		if (this.level.hintsLeftInLevel > this.level.hintsLeft.length)
			this.hint = this.level.defaultHint
		else this.hint = this.level.hintsLeft[this.level.hintsLeftInLevel]
	}
	get layer(): Layer {
		return Layer.STATIONARY
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
	blockTags = ["autonomous-monster"]
	get layer(): Layer {
		return Layer.STATIONARY
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
	get layer(): Layer {
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
	art: ActorArt = { actorName: "thief", animation: "key" }
	blockTags = ["normal-monster", "cc1block"]
	get layer(): Layer {
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
	art: () => ActorArt = () => ({
		actorName: "trap",
		animation: this.openRequests > 0 ? "open" : "closed",
	})
	get layer(): Layer {
		return Layer.STATIONARY
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
			for (const trapped of this.tile[Layer.MOVABLE])
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
	blockTags = ["cc1block", "normal-monster", "playable"]
	// Block actors when this already has a source
	blocks(): boolean {
		return this.tile[Layer.MOVABLE].length > 0
	}
	get layer(): Layer {
		return Layer.STATIONARY
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
	art = (): ActorArt[] => [
		{
			actorName: "bomb",
		},
		{
			actorName: "bombFuse",
			cropSize: [0.5, 0.5],
			animation: (this.level.currentTick % 4).toString(),
			imageOffset: [0.5, 0],
		},
	]
	get layer(): Layer {
		return Layer.ITEM // Yes
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, null)
		this.destroy(other)
	}
	newActorOnTile = this.actorCompletelyJoined
}

actorDB["bomb"] = Bomb

export class Turtle extends Actor {
	id = "turtle"
	tags = ["blocks-ghost"]
	get layer(): Layer {
		return Layer.STATIONARY
	}
	art = (): ActorArt[] => [
		{
			actorName: "water",
			frame: this.level.currentTick % 4,
		},
		{
			actorName: "turtle",
			frame: Math.floor(this.level.currentTick / 3) % 3,
		},
	]
	blockTags = ["melting"]
	actorLeft(): void {
		this.destroy(null, "splash")
		new Water(this.level, this.tile.position)
	}
}

actorDB["turtle"] = Turtle

export class GreenBomb extends Actor {
	id = "bomb"
	tags = ["bomb"]
	art = (): ActorArt | ActorArt[] =>
		this.customData === "bomb"
			? [
					{
						actorName: "bombGreen",
					},
					{
						actorName: "bombFuse",
						cropSize: [0.5, 0.5],
						animation: (this.level.currentTick % 4).toString(),
						imageOffset: [0.5, 0],
					},
			  ]
			: { actorName: "echipGreen" }
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
	get layer(): Layer {
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
	buttonPressed(color: string): void {
		if (color !== "green") return
		this.customData = this.customData === "bomb" ? "echip" : "bomb"
	}
}

actorDB["greenBomb"] = GreenBomb

// TODO Directional blocks

export class Slime extends Actor {
	id = "slime"
	tags = ["slime"]
	art = genericAnimatedArt("slime", 8)
	get layer(): Layer {
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
	art = (): ActorArt => ({
		actorName: "flameJet",
		frame: this.customData === "on" ? (this.level.currentTick % 3) + 1 : 0,
	})
	tags = this.customData === "on" ? ["fire"] : []
	get layer(): Layer {
		return Layer.STATIONARY
	}
	onEachDecision(): void {
		if (this.customData === "on" && !this.tags.includes("fire"))
			this.tags.push("fire")
		else if (this.customData === "off" && this.tags.includes("fire"))
			this.tags.splice(this.tags.indexOf("fire"))
		for (const movable of this.tile[Layer.MOVABLE])
			if (movable.cooldown === 0 && this.customData === "on")
				movable.destroy(this)
	}
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
	for (const update of queuedUpdates) update[0].customData = update[1]
}

onLevelDecisionTick.push(updateJetlife)
