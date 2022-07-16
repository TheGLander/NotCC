import { Layer } from "../tile"
import { Actor, matchTags, SlidingState } from "../actor"
import { actorDB, keyNameList } from "../const"
import { LevelState } from "../level"
import { Playable } from "./playables"
import { LitTNT, RollingBowlingBall } from "./monsters"
import { Explosion } from "./animation"
import { Direction } from "../helpers"

export const enum ItemDestination {
	NONE,
	KEY,
	ITEM,
}

export abstract class Item extends Actor {
	tags = ["item"]
	destination = ItemDestination.ITEM
	/**
	 * Tags to add to the carrier of the item
	 */
	carrierTags?: Record<string, string[]> = {}
	carrierSpeedMod?(actor: Actor, mult: number): number
	hasItemMod(): boolean {
		for (const mod of this.tile[Layer.ITEM_SUFFIX])
			if (mod.tags?.includes("ignoreItem")) return true
		return false
	}
	blocks?(other: Actor): boolean {
		return (
			!this.hasItemMod() &&
			!matchTags(other.getCompleteTags("tags"), [
				"can-pickup-items",
				"can-stand-on-items",
				"playable",
			])
		)
	}
	ignores(): boolean {
		return this.hasItemMod()
	}
	getLayer(): Layer {
		return Layer.ITEM
	}
	pickup(other: Actor): boolean {
		if (
			other.getCompleteTags("tags").includes("can-stand-on-items") ||
			(this.shouldBePickedUp && !this.shouldBePickedUp(other)) ||
			this.hasItemMod()
		)
			return false
		this.destroy(other, null)
		switch (this.destination) {
			case ItemDestination.KEY:
				if (!other.inventory.keys[this.id])
					other.inventory.keys[this.id] = { amount: 0, type: this as Key }
				other.inventory.keys[this.id].amount++
				other.inventory.keys[this.id].amount %= 256
				break
			case ItemDestination.ITEM:
				other.inventory.items.unshift(this)
				if (other.inventory.items.length > other.inventory.itemMax)
					other.dropItem()
				break
		}
		this.onPickup?.(other)
		return true
	}
	actorCompletelyJoined(other: Actor): void {
		this.pickup(other)
	}
	onPickup?(other: Actor): void
	onDrop?(other: Actor): void
	shouldBePickedUp?(other: Actor): boolean
	onCarrierCompleteJoin?(carrier: Actor): void
	onCarrierJoin?(carrier: Actor): void
	canBeDropped?(carrier: Actor): boolean
}

export class EChipPlus extends Item {
	id = "echipPlus"
	destination = ItemDestination.NONE
	hasItemMod(): boolean {
		return false
	}
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)
		level.chipsTotal++
	}
	shouldBePickedUp(other: Actor): boolean {
		return other instanceof Playable
	}
	onPickup(): void {
		this.level.chipsLeft = Math.max(0, this.level.chipsLeft - 1)
	}
}

actorDB["echipPlus"] = EChipPlus

export class EChip extends EChipPlus {
	id = "echip"

	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)
		level.chipsLeft++
		level.chipsRequired++
	}
}

actorDB["echip"] = EChip

export abstract class Key extends Item {
	destination = ItemDestination.KEY as const
	/**
	 * Determines if the specific actor can re-use this key
	 */
	keyUsed?(other: Actor): void
}

// TODO Turn this into a factory too

export class KeyRed extends Key {
	id = "keyRed"
	ignoreTags = ["!playable"]
	blocks = undefined
	keyUsed(other: Actor): void {
		if (other.getCompleteTags("tags").includes("can-reuse-key-red"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyRed"] = KeyRed

keyNameList.push("keyRed")

export class KeyBlue extends Key {
	id = "keyBlue"
	blocks = undefined
	keyUsed(other: Actor): void {
		if (other.getCompleteTags("tags").includes("can-reuse-key-blue"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyBlue"] = KeyBlue

keyNameList.push("keyBlue")

export class KeyYellow extends Key {
	id = "keyYellow"
	keyUsed(other: Actor): void {
		if (other.getCompleteTags("tags").includes("can-reuse-key-yellow"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyYellow"] = KeyYellow

keyNameList.push("keyYellow")

export class KeyGreen extends Key {
	id = "keyGreen"
	keyUsed(other: Actor): void {
		if (other.getCompleteTags("tags").includes("can-reuse-key-green"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyGreen"] = KeyGreen

keyNameList.push("keyGreen")

export class BootWater extends Item {
	id = "bootWater"
	carrierTags = { ignoreTags: ["water"], collisionIgnoreTags: ["water"] }
	destination = ItemDestination.ITEM
}

actorDB["bootWater"] = BootWater

export class BootFire extends Item {
	id = "bootFire"
	carrierTags = { ignoreTags: ["fire"] }
	destination = ItemDestination.ITEM
	// Double-ignore thing for the ghost
	onCarrierCompleteJoin(carrier: Actor): void {
		for (const actor of carrier.tile.allActors) {
			if (
				carrier._internalIgnores(actor, true) &&
				actor.getCompleteTags("tags").includes("fire")
			) {
				actor.destroy(null, null)
			}
		}
	}
}

actorDB["bootFire"] = BootFire

export class BootIce extends Item {
	id = "bootIce"
	carrierTags = { ignoreTags: ["ice"] }
	destination = ItemDestination.ITEM
	onPickup(other: Actor): void {
		// Indeed, a hack, but I really don't want to ever calculate the sliding state automatically
		if (other.slidingState === SlidingState.STRONG)
			other.slidingState = SlidingState.NONE
		/* if (
			other.getCompleteTags("ignoreTags").includes("ice") &&
			!other.getCompleteTags("ignoreTags", this).includes("ice")
		)
			other.slidingState = SlidingState.NONE */
	}
}

actorDB["bootIce"] = BootIce

export class BootForceFloor extends Item {
	id = "bootForceFloor"
	carrierTags = { ignoreTags: ["force-floor"] }
	destination = ItemDestination.ITEM
}

actorDB["bootForceFloor"] = BootForceFloor

export class BootDirt extends Item {
	id = "bootDirt"
	carrierTags = { collisionIgnoreTags: ["filth"] }
	destination = ItemDestination.ITEM
	// Double-ignore thing for the ghost
	onCarrierCompleteJoin(carrier: Actor): void {
		for (const actor of carrier.tile.allActors) {
			if (
				carrier._internalIgnores(actor, true) &&
				actor.getCompleteTags("tags").includes("filth")
			) {
				actor.destroy(null, null)
			}
		}
	}
}

actorDB["bootDirt"] = BootDirt

export class GoronBraslet extends Item {
	id = "goronBraslet"
	carrierTags = { pushTags: ["wall"] }
	destination = ItemDestination.ITEM
}

actorDB["goronBraslet"] = GoronBraslet

export class Helmet extends Item {
	id = "helmet"
	destination = ItemDestination.ITEM
	carrierTags = { tags: ["ignore-default-monster-kill"] }
}

actorDB["helmet"] = Helmet

export class BonusFlag extends Item {
	hasItemMod(): boolean {
		return false
	}
	id = "bonusFlag"
	tags = ["bonusFlag"]
	destination = ItemDestination.NONE
	onPickup(carrier: Actor): void {
		if (carrier instanceof Playable)
			if (this.customData.startsWith("*"))
				this.level.bonusPoints *= parseInt(this.customData.substr(1))
			else this.level.bonusPoints += parseInt(this.customData)
	}
}

actorDB["bonusFlag"] = BonusFlag

export class TNT extends Item {
	id = "tnt"
	destination = ItemDestination.ITEM
	actorLeft(other: Actor): void {
		if (!(other instanceof Playable)) return
		this.destroy(null, null)
		const lit = new LitTNT(this.level, this.tile.position)
		lit.inventory.itemMax = other.inventory.itemMax
		lit.inventory.items = [...other.inventory.items]
		for (const keyType in other.inventory.keys)
			lit.inventory.keys[keyType] = { ...other.inventory.keys[keyType] }
	}
}

actorDB["tnt"] = TNT

export class SecretEye extends Item {
	id = "secretEye"
	carrierTags = { tags: ["can-see-secrets"] }
	destination = ItemDestination.ITEM
}

actorDB["secretEye"] = SecretEye

export class RailroadSign extends Item {
	id = "railroadSign"
	carrierTags = {
		tags: ["ignores-railroad-redirect"],
		collisionIgnoreTags: ["railroad"],
	}
	destination = ItemDestination.ITEM
}

actorDB["railroadSign"] = RailroadSign

export class BowlingBall extends Item {
	id = "bowlingBall"
	destination = ItemDestination.ITEM
	onDrop(dropper: Actor): void {
		dropper.tile.removeActors(dropper)
		const rollingGuy = this.replaceWith(RollingBowlingBall)
		if (rollingGuy._internalStep(dropper.direction)) rollingGuy.cooldown--
		// Hello animation from rolling bowling ball movement failure, please die so my dropper can go back
		for (const movable of dropper.tile[Layer.MOVABLE])
			if (movable instanceof Explosion) movable.destroy(null, null)
		dropper.tile.addActors(dropper)
	}
}

actorDB["bowlingBall"] = BowlingBall

export class TimeBonus extends Item {
	id = "timeBonus"
	hasItemMod(): boolean {
		return false
	}
	destination = ItemDestination.NONE
	shouldBePickedUp(other: Actor): boolean {
		return other instanceof Playable
	}
	onPickup(): void {
		this.level.timeLeft += 60 * 10
	}
}

actorDB["timeBonus"] = TimeBonus

export class TimePenalty extends Item {
	id = "timePenalty"
	hasItemMod(): boolean {
		return false
	}
	destination = ItemDestination.NONE
	shouldBePickedUp(other: Actor): boolean {
		return other instanceof Playable
	}
	onPickup(): void {
		this.level.timeLeft -= 60 * 10
		if (this.level.timeLeft < 1) this.level.timeLeft = 1
	}
}

actorDB["timePenalty"] = TimePenalty

export class TimeToggle extends Item {
	id = "timeToggle"
	hasItemMod(): boolean {
		return false
	}
	destination = ItemDestination.NONE
	shouldBePickedUp(): boolean {
		return false
	}
	actorCompletelyJoined(): void {
		this.level.timeFrozen = !this.level.timeFrozen
	}
}

actorDB["timeToggle"] = TimeToggle

export class SpeedBoots extends Item {
	id = "bootSpeed"
	carrierSpeedMod(_actor: Actor, mult: number): number {
		return mult === 1 ? 2 : 1
	}
}

actorDB["bootSpeed"] = SpeedBoots

export class LightningBolt extends Item {
	id = "lightningBolt"
	onCarrierJoin(carrier: Actor): void {
		if (carrier.oldTile && !carrier.oldTile.hasLayer(Layer.STATIONARY))
			carrier.oldTile.poweringWires = 0
	}
	onCarrierCompleteJoin(carrier: Actor): void {
		if (!carrier.tile.hasLayer(Layer.STATIONARY))
			carrier.tile.poweringWires = carrier.tile.wires
	}
	onDrop(carrier: Actor): void {
		if (!carrier.tile.hasLayer(Layer.STATIONARY)) carrier.tile.poweringWires = 0
	}
}

actorDB["lightningBolt"] = LightningBolt

export class Hook extends Item {
	id = "hook"
	carrierTags = { tags: ["pulling"] }
	destination = ItemDestination.ITEM
}

actorDB["hook"] = Hook
