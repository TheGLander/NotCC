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
import { Direction, hasOwnProperty } from "../helpers"
import { isWired, WireOverlapMode, Wires } from "../wires"

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
	actorOnTile(other: Actor): void {
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
	actorOnTile(other: Actor): void {
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
	exitBlocks(_other: Actor, otherMoveDirection: Direction): boolean {
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
		if (other.getCompleteTags("tags").includes("block"))
			other.slidingState = SlidingState.WEAK
	}
	actorOnTile(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		other.slidingState = SlidingState.WEAK
		other.direction = this.direction
		if (other.bonked) {
			if (other._internalStep(other.direction)) other.cooldown--
			else {
				other.enterTile(true)
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
		// Kinda a bad hack, but makes pushing sliding blocks work
		if (other.getCompleteTags("tags").includes("block"))
			other.slidingState = SlidingState.WEAK
	}
	actorOnTile(other: Actor): void {
		if (other.layer !== Layer.MOVABLE) return
		other.slidingState = SlidingState.WEAK
		other.direction = crossLevelData.RFFDirection++
		crossLevelData.RFFDirection %= 4
		if (other.bonked) {
			if (other._internalStep(other.direction)) other.cooldown--
			else {
				other.enterTile(true)
			}
		}
	}
	speedMod(): 2 {
		return 2
	}
}
declare module "../level" {
	export interface CrossLevelDataInterface {
		RFFDirection: Direction
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
	blockTags = ["cc1block", "normal-monster"]
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
	tags = ["water", "water-ish"]
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
	tags = ["filth", "boot-removable"]
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
			this.level.selectedPlayable =
				this.level.playables[
					(this.level.playables.indexOf(other) + 1) %
						this.level.playables.length
				]
			other.destroy(this, null)
			this.level.gameState = GameState.PLAYING
			this.level.playablesLeft--

			if (this.level.playablesLeft <= 0) this.level.gameState = GameState.WON
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
	actorCompletelyJoined(other: Actor): void {
		// Sorry
		if (other === this.level.selectedPlayable && this.hint)
			(globalThis.alert ?? console.log)(this.hint)
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
		other.inventory.keys = {}
		this.level.bonusPoints = Math.floor(this.level.bonusPoints / 2)
	}
}

actorDB["thiefKey"] = ThiefKey

export class Trap extends Actor {
	id = "trap"
	// The amount of buttons current pressed and linked to this trap
	openRequests = this.customData === "open" ? 1 : 0
	isOpen = this.customData === "open"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	exitBlocks(): boolean {
		return !this.isOpen
	}
	caresButtonColors = ["brown"]
	buttonPressed(_type: string, data?: string): void {
		if (this.customData === "open") this.customData = ""
		else this.openRequests++
		this.isOpen = true
		if (this.openRequests === 1 && data !== "init") {
			for (const movable of this.tile[Layer.MOVABLE]) {
				movable.slidingState = SlidingState.NONE
				if (movable._internalStep(movable.direction)) movable.cooldown--
			}
		}
	}
	buttonUnpressed(): void {
		this.openRequests = Math.max(0, this.openRequests - 1)
		if (this.openRequests === 0) {
			this.isOpen = false
			for (const movable of this.tile[Layer.MOVABLE])
				movable.slidingState = SlidingState.WEAK
		}
	}

	listensWires = true
	persistOnExitOnlyCollision = true
}

actorDB["trap"] = Trap

onLevelDecisionTick.push(level => {
	for (const tile of level.tiles())
		for (const trap of tile[Layer.STATIONARY]) {
			if (!(trap instanceof Trap)) continue
			if (trap.circuits) trap.isOpen = !!trap.poweredWires
			for (const movable of trap.tile[Layer.MOVABLE])
				movable.slidingState = trap.isOpen
					? SlidingState.NONE
					: SlidingState.WEAK
		}
})

// TODO CC1 clone machines, direction arrows on clone machine
export class CloneMachine extends Actor {
	id = "cloneMachine"
	isCloning = false
	tags = ["machinery"]
	// Always block boomer actors
	blockTags = ["cc1block", "normal-monster", "real-playable"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	// Allow actors to exit while cloning, so they can properly move out of the tile
	exitBlocks(): boolean {
		return !this.isCloning
	}
	actorOnTile(actor: Actor): void {
		actor.slidingState = SlidingState.STRONG
	}
	blocks(): boolean {
		return this.tile.hasLayer(Layer.MOVABLE)
	}

	caresButtonColors = ["red"]
	// Cloning with rotation happens at the start of the tick (pre-wire tick), so the extra cooldown is not needed
	clone(attemptToRotate: boolean): void {
		this.isCloning = true
		for (const clonee of [...this.tile[Layer.MOVABLE]]) {
			if (clonee._internalStep(clonee.direction)) {
				clonee.cooldown--
			} else {
				const ogDir = clonee.direction
				if (attemptToRotate) {
					for (let i = 1; i <= 3; i++)
						if (clonee._internalStep((ogDir + i) % 4)) {
							clonee.cooldown--
							//a
							break
						}
				}
				if (clonee.cooldown === 0) {
					clonee.direction = ogDir
					continue
				}
			}
			const newClone = new actorDB[clonee.id](
				this.level,
				this.tile.position,
				clonee.customData
			)
			newClone.direction = clonee.direction
			newClone.slidingState = SlidingState.STRONG
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
		if (other.layer !== Layer.MOVABLE) return
		other.destroy(this, null)
		this.destroy(other)
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
		this.destroy(null, "splash", true)
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
		if (transmogValue) other.replaceWith(actorDB[transmogValue])
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

export abstract class LogicGate extends Actor {
	immuneTags = ["tnt"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	abstract getDefaultWires(): Wires
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)

		this.wires = this.getDefaultWires()
		// Shift bits with wrap
		this.wires =
			((this.wires << this.direction) & 0b1111) |
			(this.wires >> (4 - this.direction))
	}
	abstract processWires(wires: Wires): Wires
	updateWires() {
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
}

export class NotGate extends LogicGate {
	id = "notGate"
	getDefaultWires(): Wires {
		return Wires.UP | Wires.DOWN
	}
	processWires(wires: Wires): Wires {
		if (!(wires & Wires.DOWN)) return Wires.UP
		return 0
	}
}

actorDB["notGate"] = NotGate

export class AndGate extends LogicGate {
	id = "andGate"
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT
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
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT
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
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT
	}
	processWires(wires: Wires): Wires {
		if ((wires & (Wires.RIGHT | Wires.LEFT)) !== 0) return Wires.UP
		return 0
	}
}

actorDB["orGate"] = OrGate

export class XorGate extends LogicGate {
	id = "xorGate"
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT
	}
	processWires(wires: Wires): Wires {
		if (!!(wires & Wires.RIGHT) !== !!(wires & Wires.LEFT)) return Wires.UP
		return 0
	}
}

actorDB["xorGate"] = XorGate

export class LatchGate extends LogicGate {
	id = "latchGate"
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT
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
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT
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
	getDefaultWires(): Wires {
		return Wires.UP | Wires.RIGHT | Wires.LEFT | Wires.DOWN
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
}

actorDB["counterGate"] = CounterGate
