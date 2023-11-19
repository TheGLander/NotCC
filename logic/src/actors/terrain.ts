import { Actor, SlidingState } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB } from "../const.js"
import { Wall } from "./walls.js"
import { matchTags } from "../actor.js"
import { Playable } from "./playables.js"
import {
	GameState,
	LevelState,
	onLevelDecisionTick,
	onLevelWireTick,
} from "../level.js"
import { Direction, Field, hasOwnProperty } from "../helpers.js"
import {
	CircuitCity,
	dirToWire,
	WireOverlapMode,
	Wires,
	wireToDir,
} from "../wires.js"
import { BlueTeleportTarget, doBlueTeleport } from "./teleport.js"
import { iterableIncludes } from "../iterableHelpers.js"
import { GlitchInfo } from "../parsers/nccs.pb.js"

export class LetterTile extends Actor {
	id = "letterTile"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["letterTile"] = LetterTile

export class CustomFloor extends Actor {
	id = "customFloor"
	tags = ["blocks-ghost"]
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
	actorCompletelyJoinedIgnored(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playOnce("slide step")
		}
	}
	actorLeft(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playContinuous("ice slide")
		}
	}
	actorCompletelyLeft(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.stopContinuous("ice slide")
		}
	}
	actorOnTile(other: Actor): void {
		if (other._internalIgnores(this)) return
		if (!other.bonked) return
		other.slidingState = SlidingState.STRONG
		const tags = other.getCompleteTags("tags")
		if (tags.includes("super-weirdly-ignores-ice")) return

		// Turn the other way
		other.direction += 2
		other.direction %= 4
		if (other._internalStep(other.direction)) other.cooldown--
	}
	speedMod(other: Actor): 1 | 2 {
		if (other.getCompleteTags("tags").includes("weirdly-ignores-ice")) return 1
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
	actorCompletelyJoinedIgnored(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playOnce("slide step")
		}
	}
	actorLeft(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playContinuous("ice slide")
		}
	}
	actorCompletelyLeft(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.stopContinuous("ice slide")
		}
	}
	actorOnTile(other: Actor): void {
		if (other._internalIgnores(this)) return
		const tags = other.getCompleteTags("tags")
		if (tags.includes("super-weirdly-ignores-ice")) return
		if (other.bonked) other.direction += 2
		if (!tags.includes("weirdly-ignores-ice")) {
			other.direction += (this.direction - other.direction) * 2 - 1 + 8
		}
		other.direction %= 4
		if (other.bonked && other._internalStep(other.direction)) other.cooldown--
	}
	speedMod(other: Actor): 1 | 2 {
		if (other.getCompleteTags("tags").includes("weirdly-ignores-ice")) return 1
		return 2
	}
	blocks(_other: Actor, otherMoveDirection: Direction): boolean {
		return !(
			otherMoveDirection === this.direction ||
			otherMoveDirection === (this.direction + 1) % 4
		)
	}
	exitBlocks(other: Actor, otherMoveDirection: Direction): boolean {
		if (other.getCompleteTags("tags").includes("weirdly-ignores-ice"))
			return false
		return (
			otherMoveDirection === this.direction ||
			otherMoveDirection === (this.direction + 1) % 4
		)
	}
}

actorDB["iceCorner"] = IceCorner

export class ForceFloor extends Actor {
	id = "forceFloor"
	tags = ["force-floor"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorJoined(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playContinuous("force floor")
		}
		if (other.getCompleteTags("tags").includes("block"))
			other.slidingState = SlidingState.WEAK
	}
	actorCompletelyJoinedIgnored(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playOnce("slide step")
		}
	}
	actorLeft(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.stopContinuous("force floor")
		}
	}
	actorOnTile(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		if (other.bonked) other.enterTile(true)
		if (!other._internalIgnores(this)) {
			other.slidingState = SlidingState.WEAK
			other.direction = this.direction
			if (other instanceof Playable) other.playerBonked = true
			if (other.bonked) {
				if (other._internalStep(other.direction)) other.cooldown--
			}
		}
	}
	speedMod(): 2 {
		return 2
	}
	pulse(): void {
		this.direction += 2
		this.direction %= 4
	}
}

actorDB["forceFloor"] = ForceFloor

export class ForceFloorRandom extends Actor {
	id = "forceFloorRandom"
	tags = ["force-floor"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorJoined(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playContinuous("force floor")
		}
		if (other.getCompleteTags("tags").includes("block"))
			other.slidingState = SlidingState.WEAK
	}
	actorCompletelyJoinedIgnored(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.playOnce("slide step")
		}
	}
	actorLeft(other: Actor): void {
		if (other.getCompleteTags("tags").includes("real-playable")) {
			this.level.sfxManager?.stopContinuous("force floor")
		}
	}
	actorOnTile(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		if (other.bonked) other.enterTile(true)
		if (!other._internalIgnores(this)) {
			other.slidingState = SlidingState.WEAK
			other.direction = this.level.randomForceFloorDirection++
			this.level.randomForceFloorDirection %= 4
			if (other instanceof Playable) other.playerBonked = true
			if (other.bonked) {
				if (other._internalStep(other.direction)) other.cooldown--
			}
		}
	}
	speedMod(): 2 {
		return 2
	}
}

actorDB["forceFloorRandom"] = ForceFloorRandom

// random

export class RecessedWall extends Actor {
	id = "popupWall"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["cc1block", "normal-monster"]
	actorLeft(): void {
		if (this.tile.hasLayer(Layer.MOVABLE)) return
		this.destroy(this, null)
		new Wall(this.level, this.tile.position)
		this.level.sfxManager?.playOnce("recessed wall")
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
	tags = ["water", "water-ish"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoinedIgnored(other: Actor): void {
		if (other.getCompleteTags("tags").includes("playable")) {
			this.level.sfxManager?.playOnce("water step")
		}
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, "splash")
	}
}

actorDB["water"] = Water

export class Dirt extends Actor {
	id = "dirt"
	tags = ["filth", "boot-removable"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["cc1block", "normal-monster", "melinda"]
	actorCompletelyJoined(): void {
		this.level.sfxManager?.playOnce("dirt clear")
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
	tags = ["exit"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (other instanceof Playable) {
			if (other === this.level.selectedPlayable)
				this.level.selectedPlayable =
					this.level.playables[
						(this.level.playables.indexOf(other) + 1) %
							this.level.playables.length
					]
			other.destroy(this, null)
			this.level.gameState = GameState.PLAYING
			this.level.playablesLeft--
			this.level.sfxManager?.playOnce(`win ${other.id}`)
			this.level.releasedKeys = { ...this.level.gameInput }
		}
	}
}

actorDB["exit"] = Exit

export class EChipGate extends Actor {
	id = "echipGate"
	tags = ["echip-gate"]
	immuneTags = ["tnt"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (this.level.chipsLeft === 0) {
			this.destroy(other, null)
			this.level.sfxManager?.playOnce("socket unlock")
		}
	}
	blocks(): boolean {
		return this.level.chipsLeft !== 0
	}
}

actorDB["echipGate"] = EChipGate

export class Hint extends Actor {
	id = "hint"
	hint?: string
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)
		if (this.level.hintsLeft.length > 0)
			this.hint = this.level.hintsLeft.shift()
		else this.hint = this.level.defaultHint
	}
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["normal-monster", "cc1block"]
}

actorDB["hint"] = Hint

export class Fire extends Actor {
	id = "fire"
	tags = ["fire", "melting", "boot-removable"]
	blockTags = ["autonomous-monster"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoinedIgnored(other: Actor): void {
		if (other.getCompleteTags("tags").includes("playable")) {
			this.level.sfxManager?.playOnce("fire step")
		}
	}
	actorCompletelyJoined(other: Actor): void {
		if (!other.getCompleteTags("tags").includes("meltable-block"))
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
		if (!other.getCompleteTags("tags").includes("real-playable")) return
		for (const [key, item] of other.inventory.items.entries()) {
			if (item.getCompleteTags("tags").includes("bribe")) {
				other.inventory.items.splice(key, 1)
				return
			}
		}
		this.level.sfxManager?.playOnce("robbed")
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
		if (!other.getCompleteTags("tags").includes("real-playable")) return
		for (const [key, item] of other.inventory.items.entries()) {
			if (item.getCompleteTags("tags").includes("bribe")) {
				other.inventory.items.splice(key, 1)
				return
			}
		}
		this.level.sfxManager?.playOnce("robbed")
		other.inventory.keys = {}
		this.level.bonusPoints = Math.floor(this.level.bonusPoints / 2)
	}
}

actorDB["thiefKey"] = ThiefKey

export class Trap extends Actor {
	id = "trap"
	openRequests = this.customData === "open" ? 1 : 0
	openRequestAt: number | null = null
	get isOpen(): boolean {
		if (this.openRequestAt === this.level.currentTick * 3 + this.level.subtick)
			return true
		if (this.wired) return !!this.poweredWires
		return this.openRequests > 0
	}
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	exitBlocks(): boolean {
		return !this.isOpen
	}
	caresButtonColors = ["brown"]
	setFrozen(actor: Actor): void {
		const frozen = !this.isOpen
		if (!frozen) {
			actor.frozen = false
			return
		}
		if (actor.getCompleteTags("tags").includes("overpowers-trap-sliding"))
			return

		actor.frozen = true
	}
	setFrozenAll(): void {
		for (const actor of this.tile[Layer.MOVABLE]) {
			this.setFrozen(actor)
		}
	}
	buttonPressed(_type: string, data?: string): void {
		const wasOpen = this.isOpen
		if (this.customData === "open") this.customData = ""
		else this.openRequests++
		this.openRequestAt = this.level.currentTick * 3 + this.level.subtick
		if (data !== "init" && !wasOpen && this.isOpen) {
			for (const movable of this.tile[Layer.MOVABLE]) {
				this.setFrozen(movable)
				if (movable._internalStep(movable.direction)) movable.cooldown--
			}
		}
	}
	buttonUnpressed(): void {
		this.openRequests = Math.max(0, this.openRequests - 1)
		this.setFrozenAll()
	}
	actorJoined(other: Actor): void {
		this.setFrozen(other)
	}
	levelStarted(): void {
		this.setFrozenAll()
	}
	pulse(actual: boolean): void {
		if (!actual) return
		this.setFrozenAll()
	}
	unpulse(): void {
		this.setFrozenAll()
	}
	listensWires = true
}

actorDB["trap"] = Trap

// onLevelDecisionTick.push(level => {
// 	for (const trap of level.actors) {
// 		if (trap.id !== "trap" || !trap.circuits || !(trap instanceof Trap))
// 			continue
// 		trap.isOpen = !!trap.poweredWires
// 		for (const movable of trap.tile[Layer.MOVABLE]) {
// 			trap.setFrozen(movable, !trap.isOpen)
// 		}
// 	}
// })

// TODO CC1 clone machines
export class CloneMachine extends Actor {
	id = "cloneMachine"
	isCloning = false
	tags = ["machinery"]
	cloneArrows =
		this.customData === "cc1"
			? []
			: Array.from(this.customData).map(val => "URLD".indexOf(val))
	// Always block boomer actors
	blockTags = ["cc1block", "normal-monster", "real-playable"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	// Allow actors to exit while cloning, so they can properly move out of the tile
	exitBlocks(): boolean {
		return !this.isCloning
	}
	levelStarted(): void {
		for (const movable of this.tile[Layer.MOVABLE]) {
			movable.frozen = true
		}
	}
	actorJoined(other: Actor): void {
		other.frozen = true
	}
	blocks(other: Actor): boolean {
		return (
			!other
				.getCompleteTags("tags")
				.includes("interacts-with-closed-clone-machine") &&
			this.tile.hasLayer(Layer.MOVABLE)
		)
	}

	caresButtonColors = ["red"]
	tryMovingInto(clonee: Actor, direction: Direction): boolean {
		return clonee.checkCollision(direction) && clonee._internalStep(direction)
	}
	// Cloning with rotation happens at the start of the tick (pre-wire tick), so the extra cooldown is not needed
	clone(attemptToRotate: boolean): void {
		this.isCloning = true
		for (let clonee of [...this.tile[Layer.MOVABLE]]) {
			if (clonee.cooldown) continue
			clonee.frozen = false
			clonee.slidingState = SlidingState.STRONG
			if (this.tryMovingInto(clonee, clonee.direction)) {
				clonee.cooldown--
			} else {
				if (clonee.newActor) clonee = clonee.newActor
				const ogDir = clonee.direction
				if (attemptToRotate) {
					for (let i = 1; i <= 3; i++) {
						if (this.tryMovingInto(clonee, (ogDir + i) % 4)) {
							clonee.cooldown--

							break
						}
						if (clonee.newActor) clonee = clonee.newActor
					}
				}
				if (clonee.cooldown === 0) {
					clonee.direction = ogDir
					clonee.frozen = true
					clonee.slidingState = SlidingState.NONE
					continue
				}
			}
			const newClone = new actorDB[clonee.id](
				this.level,
				this.tile.position,
				clonee.customData
			)
			newClone.direction = clonee.direction
			newClone.frozen = true
		}
		this.isCloning = false
	}
	buttonPressed(): boolean {
		this.clone(false)
		return true
	}
	pulse(actual: boolean): void {
		this.clone(actual)
	}
}

actorDB["cloneMachine"] = CloneMachine

export class Bomb extends Actor {
	id = "bomb"
	tags = ["bomb"]
	getLayer(): Layer {
		return Layer.ITEM // Yes
	}
	actorOnTile(other: Actor): void {
		if (other.layer !== Layer.MOVABLE || other._internalIgnores(this)) return
		other.destroy(this)
		this.destroy(other, null)
	}
}

actorDB["bomb"] = Bomb

export class Turtle extends Actor {
	id = "turtle"
	tags = ["water-ish"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["melting"]
	actorLeft(): void {
		if (this.tile.hasLayer(Layer.MOVABLE)) return
		this.destroy(null, "splash", true)
		new Water(this.level, this.tile.position)
	}
}

actorDB["turtle"] = Turtle

export class GreenBomb extends Actor {
	id = "greenBomb"
	tags = ["bomb"].concat(this.customData === "echip" ? ["item"] : [])
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)
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
		} else if (other.getCompleteTags("tags").includes("real-playable")) {
			this.destroy(null, null)
			this.level.chipsLeft = Math.max(0, this.level.chipsLeft - 1)
			this.level.sfxManager?.playOnce("item get")
		}
	}
	greenToggle(): void {
		this.customData = this.customData === "bomb" ? "echip" : "bomb"
		if (this.customData === "echip") this.tags.push("item")
		else this.tags.splice(this.tags.indexOf("item"), 1)
	}
	blocks(other: Actor): boolean {
		return (
			this.customData === "echip" &&
			!matchTags(other.getCompleteTags("tags"), [
				"can-pickup-items",
				"can-stand-on-items",
				"playable",
			])
		)
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
	tags: string[]
	immuneTags = ["meltable-block"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	updateTags(): void {
		if (this.customData === "on" && !this.tags.includes("fire"))
			this.tags.push("fire")
		else if (this.customData === "off" && this.tags.includes("fire"))
			this.tags.splice(this.tags.indexOf("fire"), 1)
	}
	actorOnTile(other: Actor): void {
		if (this.customData === "on" && other.layer === Layer.MOVABLE)
			other.destroy(this)
	}
	caresButtonColors = ["orange"]
	buttonPressed(): void {
		this.customData = this.customData === "on" ? "off" : "on"
		this.updateTags()
	}
	buttonUnpressed = this.buttonPressed
	pulse = this.buttonPressed
	constructor(level: LevelState, pos: [number, number], customData?: string) {
		super(level, pos, customData)
		this.tags = this.customData === "on" ? ["fire", "jet"] : ["jet"]
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
	for (const update of queuedUpdates) {
		update[0].customData = update[1]
		update[0].updateTags()
	}
}

onLevelDecisionTick.push(updateJetlife)

export class Transmogrifier extends Actor {
	id = "transmogrifier"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	wired = false
	isActive(): boolean {
		return !this.wired || !!this.poweredWires
	}
	actorCompletelyJoined(other: Actor): void {
		if (!this.isActive()) return
		let transmogValue: string | undefined
		if (hasOwnProperty(other, "transmogrifierTarget"))
			if (typeof other.transmogrifierTarget === "string")
				transmogValue = other.transmogrifierTarget
			else if (typeof other.transmogrifierTarget === "function")
				transmogValue = other.transmogrifierTarget()
		if (transmogValue) {
			other.replaceWith(actorDB[transmogValue])
			this.level.sfxManager?.playOnce("teleport")
		}
	}
}

actorDB["transmogrifier"] = Transmogrifier

export const directionStrings = "URDL"

export class Railroad extends Actor {
	id = "railroad"
	tags = ["railroad"]
	isSwitch = this.customData.includes("s")
	allRRRedirects = ["UR", "DR", "DL", "UL", "LR", "UD"]
	activeTrack: string = this.allRRRedirects[parseInt(this.customData[0] || "0")]
	lastEnteredDirection: Direction = parseInt(this.customData[1] || "0")
	baseRedirects: string[] = Array.from(this.customData.substr(2))
		.filter(val => !isNaN(parseInt(val)))
		.map(val => this.allRRRedirects[parseInt(val)])
	get legalRedirects(): string[] {
		return this.isSwitch
			? this.baseRedirects.includes(this.activeTrack)
				? [this.activeTrack]
				: []
			: this.baseRedirects
	}
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(_other: Actor, enterDirection: Direction): boolean {
		const directionString = directionStrings[(enterDirection + 2) % 4]
		// If there is no legal redirect regarding this direction, this direction cannot be entered
		return !this.legalRedirects.find(val => val.includes(directionString))
	}
	actorCompletelyJoined(other: Actor): void {
		this.lastEnteredDirection = other.direction
	}
	redirectTileMemberDirection(
		other: Actor,
		direction: Direction
	): Direction | null {
		const otherTags = other.getCompleteTags("tags")
		if (otherTags.includes("ignores-railroad-redirect")) return direction

		const directionString =
			directionStrings[(this.lastEnteredDirection + 2) % 4]
		const legalRedirects = this.legalRedirects
			.filter(val => val.includes(directionString))
			.map(val =>
				directionStrings.indexOf(val[1 - val.indexOf(directionString)])
			)
		if (otherTags.includes("reverse-on-railroad"))
			legalRedirects.push((this.lastEnteredDirection + 2) % 4)
		// Search for a valid (relative) direction in this order: Forward, right, left, backward
		for (const offset of [0, 1, -1, 2])
			if (legalRedirects.includes((direction + offset + 4) % 4))
				return (direction + offset + 4) % 4
		// This...shouldn't happen outside of illegal railroads or RR signs, so don't redirect
		return null
	}
	actorLeft(other: Actor): void {
		if (!this.isSwitch || this.wired) return
		const enterDirection =
				directionStrings[(this.lastEnteredDirection + 2) % 4],
			// Note that it doesn't have to make a move which makes sense, you just have to enter and exit in directions which are valid in a vacuum
			isLegalISH = !!this.legalRedirects.find(
				val =>
					val.includes(enterDirection) &&
					val.includes(directionStrings[other.direction])
			)
		if (isLegalISH) {
			const exActiveTrack = this.allRRRedirects.indexOf(this.activeTrack)
			for (
				let redirectID = (exActiveTrack + 1) % 6;
				redirectID !== exActiveTrack;
				redirectID = (redirectID + 1) % 6
			)
				if (this.baseRedirects.includes(this.allRRRedirects[redirectID])) {
					this.activeTrack = this.allRRRedirects[redirectID]
					break
				}
		}
	}
	pulse(): void {
		const exActiveTrack = this.allRRRedirects.indexOf(this.activeTrack)
		for (
			let redirectID = (exActiveTrack + 1) % 6;
			redirectID !== exActiveTrack;
			redirectID = (redirectID + 1) % 6
		)
			if (this.baseRedirects.includes(this.allRRRedirects[redirectID])) {
				this.activeTrack = this.allRRRedirects[redirectID]
				break
			}
	}
}

actorDB["railroad"] = Railroad

onLevelWireTick.push(level => {
	for (const logicGate of level.circuitInputs) {
		if (logicGate instanceof LogicGate) {
			logicGate.doTeleport()
		}
	}
})

export abstract class LogicGate extends Actor implements BlueTeleportTarget {
	immuneTags = ["tnt"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	abstract getInputWires(): Wires
	abstract getOutputWires(): Wires
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)

		this.wires = this.getInputWires() | this.getOutputWires()
		// Shift bits with wrap
		this.wires =
			((this.wires << this.direction) & 0b1111) |
			(this.wires >> (4 - this.direction))
	}
	abstract processWires(wires: Wires): Wires
	updateWires(): void {
		const poweredWires =
			((this.poweredWires << (4 - this.direction)) & 0b1111) |
			(this.poweredWires >> this.direction)
		this.poweringWires = this.processWires(poweredWires)
		this.poweringWires =
			((this.poweringWires << this.direction) & 0b1111) |
			(this.poweringWires >> (4 - this.direction))
	}
	providesPower = true
	wireOverlapMode = WireOverlapMode.NONE
	heldActor: Actor | null = null
	isBlueTeleportTarget(): boolean {
		return true
	}
	takeTeleport(other: Actor): void {
		other.exists = false
		other.oldTile = other.tile
		other.tile = this.tile
		this.heldActor = other
	}
	giveUpTeleport(other: Actor): void {
		other.exists = true
		this.heldActor = null
	}
	doTeleport(): void {
		if (this.heldActor) {
			doBlueTeleport(this, this.heldActor)
		}
	}
	isBusy(): boolean {
		return (
			!!this.heldActor ||
			(dirToWire((wireToDir(this.getOutputWires()) + this.direction) % 4) &
				(this.poweredWires | this.poweringWires)) ===
				0
		)
	}
	getTeleportInputCircuit(): CircuitCity[] {
		const circuits: CircuitCity[] = []
		for (let dir = Direction.UP; dir <= Direction.LEFT; dir++) {
			const wire = 1 << dir
			if (this.getInputWires() & wire) {
				circuits.push(this.circuits![(dir + this.direction) % 4] as CircuitCity)
			}
		}
		return circuits
	}
	getTeleportOutputCircuit(): CircuitCity | undefined {
		for (let dir = Direction.UP; dir <= Direction.LEFT; dir++) {
			const wire = 1 << dir
			if (this.getOutputWires() & wire) {
				return this.circuits![(dir + this.direction) % 4]
			}
		}
	}
}

export class NotGate extends LogicGate {
	id = "notGate"
	getInputWires(): Wires {
		return Wires.DOWN
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	processWires(wires: Wires): Wires {
		if (!(wires & Wires.DOWN)) return Wires.UP
		return 0
	}
}

actorDB["notGate"] = NotGate

export class AndGate extends LogicGate {
	id = "andGate"
	getInputWires(): Wires {
		return Wires.LEFT | Wires.RIGHT
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	processWires(wires: Wires): Wires {
		if ((wires & (Wires.RIGHT | Wires.LEFT)) === (Wires.RIGHT | Wires.LEFT))
			return Wires.UP
		return 0
	}
}

actorDB["andGate"] = AndGate

export class NandGate extends LogicGate {
	id = "nandGate"
	getInputWires(): Wires {
		return Wires.LEFT | Wires.RIGHT
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	processWires(wires: Wires): Wires {
		if ((wires & (Wires.RIGHT | Wires.LEFT)) !== (Wires.RIGHT | Wires.LEFT))
			return Wires.UP
		return 0
	}
}

actorDB["nandGate"] = NandGate

export class OrGate extends LogicGate {
	id = "orGate"
	getInputWires(): Wires {
		return Wires.LEFT | Wires.RIGHT
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	processWires(wires: Wires): Wires {
		if ((wires & (Wires.RIGHT | Wires.LEFT)) !== 0) return Wires.UP
		return 0
	}
}

actorDB["orGate"] = OrGate

export class XorGate extends LogicGate {
	id = "xorGate"
	getInputWires(): Wires {
		return Wires.LEFT | Wires.RIGHT
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	processWires(wires: Wires): Wires {
		if (!!(wires & Wires.RIGHT) !== !!(wires & Wires.LEFT)) return Wires.UP
		return 0
	}
}

actorDB["xorGate"] = XorGate

export class LatchGate extends LogicGate {
	id = "latchGate"
	getInputWires(): Wires {
		return Wires.LEFT | Wires.RIGHT
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	memory = false
	processWires(wires: Wires): Wires {
		if (wires & Wires.RIGHT) this.memory = !!(wires & Wires.LEFT)
		return this.memory ? Wires.UP : 0
	}
}

actorDB["latchGate"] = LatchGate

export class LatchGateMirror extends LogicGate {
	id = "latchGateMirror"
	getInputWires(): Wires {
		return Wires.LEFT | Wires.RIGHT
	}
	getOutputWires(): Wires {
		return Wires.UP
	}
	memory = false
	processWires(wires: Wires): Wires {
		if (wires & Wires.LEFT) this.memory = !!(wires & Wires.RIGHT)
		return this.memory ? Wires.UP : 0
	}
}

actorDB["latchGateMirror"] = LatchGateMirror

export class CounterGate extends LogicGate {
	id = "counterGate"
	getInputWires(): Wires {
		return Wires.DOWN | Wires.LEFT
	}
	getOutputWires(): Wires {
		return Wires.UP | Wires.RIGHT
	}
	memory = parseInt(this.customData || "0")
	underflowing = false
	lastPowered: Wires = 0
	// This is kinda forgettable, but
	// Up - Underflow, Right - Increment, Down - Decrement, Left - Overflow
	processWires(wires: Wires): Wires {
		const nextPowered = wires
		wires &= ~this.lastPowered
		this.lastPowered = nextPowered
		if (wires & (Wires.RIGHT | Wires.DOWN)) {
			this.underflowing = false
		}
		if ((wires & (Wires.RIGHT | Wires.DOWN)) === (Wires.RIGHT | Wires.DOWN))
			return 0
		if (wires & Wires.RIGHT) {
			this.memory++
			if (this.memory === 10) {
				this.memory = 0
				return Wires.LEFT
			}
		}
		if (wires & Wires.DOWN) {
			this.memory--
			if (this.memory === -1) {
				this.memory = 9
				this.underflowing = true
			}
		}
		return this.underflowing ? Wires.UP : 0
	}
	isBlueTeleportTarget(): boolean {
		return false
	}
}

actorDB["counterGate"] = CounterGate
