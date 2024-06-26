import { Layer } from "../tile.js"
import { Actor, matchTags, SlidingState } from "../actor.js"
import { actorDB, cc1BootNameList, getTagFlag, keyNameList } from "../const.js"
import { LevelState } from "../level.js"
import { LitTNT, RollingBowlingBall } from "./monsters.js"
import { Explosion } from "./animation.js"
import { Direction } from "../helpers.js"
import { SteelWall } from "./walls.js"

export const enum ItemDestination {
	NONE,
	KEY,
	ITEM,
}

export abstract class Item extends Actor {
	static tags = ["item"]
	constructor(
		level: LevelState,
		pos: [number, number],
		customData?: string,
		wires?: number
	) {
		super(level, pos, customData, wires)
		if ((new.target as any).carrierTags) {
			this.carrierTags = (new.target as any).carrierTags
		}
	}
	destination = ItemDestination.ITEM
	/**
	 * Tags to add to the carrier of the item
	 */
	carrierTags?: Record<string, bigint>
	carrierSpeedMod?(actor: Actor, mult: number): number
	hasItemMod(): boolean {
		if (this.tile[Layer.ITEM_SUFFIX]?.hasTag("ignoreItem")) return true
		return false
	}
	blocks?(other: Actor): boolean {
		return (
			!this.hasItemMod() &&
			!other.hasTag("can-pickup-items") &&
			!other.hasTag("can-stand-on-items") &&
			!other.hasTag("playable")
		)
	}
	ignores(_other: Actor): boolean {
		return this.hasItemMod()
	}
	getLayer(): Layer {
		return Layer.ITEM
	}
	pickup(other: Actor): boolean {
		if (
			other.hasTag("can-stand-on-items") ||
			(this.shouldBePickedUp && !this.shouldBePickedUp(other)) ||
			this.hasItemMod()
		)
			return false
		this.destroy(other, null)
		if (other.hasTag("playable")) {
			this.level.sfxManager?.playOnce("item get")
		}
		switch (this.destination) {
			case ItemDestination.KEY:
				if (!other.inventory.keys[this.id])
					other.inventory.keys[this.id] = { amount: 0, type: this as Key }
				other.inventory.keys[this.id].amount++
				other.inventory.keys[this.id].amount %= 256
				break
			case ItemDestination.ITEM:
				if (this.level.cc1Boots) {
					if (
						!cc1BootNameList.includes(this.id) ||
						other.inventory.items.some(item => item.id === this.id)
					)
						break
				}
				other.inventory.items.unshift(this)
				if (other.inventory.items.length > other.inventory.itemMax) {
					if (!other.dropItem()) other.dropItemN(0, true)
				}
				break
		}
		this.onPickup?.(other)
		if (this.carrierTags) {
			for (const prop in this.carrierTags) {
				other[prop as "tags"] |= this.carrierTags[prop]
			}
		}
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
	onCarrierBump?(carrier: Actor, bumpee: Actor, direction: Direction): void
	onCarrierDestroyed?(carrier: Actor): void
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
		return other.hasTag("real-playable")
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
	ignores(other: Actor) {
		return !other.hasTag("playable")
	}
	blocks = undefined
	keyUsed(other: Actor): void {
		if (other.hasTag("can-reuse-key-red"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyRed"] = KeyRed

keyNameList.push("keyRed")

export class KeyBlue extends Key {
	id = "keyBlue"
	blocks = undefined
	keyUsed(other: Actor): void {
		if (other.hasTag("can-reuse-key-blue"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyBlue"] = KeyBlue

keyNameList.push("keyBlue")

export class KeyYellow extends Key {
	id = "keyYellow"
	keyUsed(other: Actor): void {
		if (other.hasTag("can-reuse-key-yellow"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyYellow"] = KeyYellow

keyNameList.push("keyYellow")

export class KeyGreen extends Key {
	id = "keyGreen"
	keyUsed(other: Actor): void {
		if (other.hasTag("can-reuse-key-green"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyGreen"] = KeyGreen

keyNameList.push("keyGreen")

export class BootIce extends Item {
	id = "bootIce"
	static carrierTags: Record<string, string[]> = { ignoreTags: ["ice"] }
	static extraTagProperties = ["extraTags"]
	static extraTags = ["super-weirdly-ignores-ice"]
	destination = ItemDestination.ITEM
	onPickup(other: Actor): void {
		if (other.hasTag("weirdly-ignores-ice")) {
			this.carrierTags = { tags: getTagFlag("super-weirdly-ignores-ice") }
		} else {
			this.carrierTags = { ignoreTags: getTagFlag("ice") }
			// Indeed, a hack, but I really don't want to ever calculate the sliding state automatically
			if (other.slidingState === SlidingState.STRONG)
				other.slidingState = SlidingState.NONE
		}
		/* if (
			other.getCompleteTags("ignoreTags").includes("ice") &&
			!other.getCompleteTags("ignoreTags", this).includes("ice")
		)
			other.slidingState = SlidingState.NONE */
	}
}

actorDB["bootIce"] = BootIce
cc1BootNameList.push("bootIce")

export class BootForceFloor extends Item {
	id = "bootForceFloor"
	static carrierTags = { ignoreTags: ["force-floor"] }
	destination = ItemDestination.ITEM
	onPickup(other: Actor): void {
		// Indeed, a hack, but I really don't want to ever calculate the sliding state automatically
		if (other.slidingState === SlidingState.WEAK) {
			other.slidingState = SlidingState.NONE
		}
	}
}

actorDB["bootForceFloor"] = BootForceFloor
cc1BootNameList.push("bootForceFloor")

export class BootFire extends Item {
	id = "bootFire"
	static carrierTags = { ignoreTags: ["fire"] }
	destination = ItemDestination.ITEM
	// Double-ignore thing for the ghost
	onCarrierCompleteJoin(carrier: Actor): void {
		if (!carrier.hasTag("double-item-remove")) return
		for (const actor of carrier.tile.allActors) {
			if (actor.hasTag("fire") && actor.hasTag("boot-removable")) {
				actor.destroy(null, null)
			}
		}
	}
}

actorDB["bootFire"] = BootFire
cc1BootNameList.push("bootFire")

export class BootWater extends Item {
	id = "bootWater"
	static carrierTags = { ignoreTags: ["water"], collisionIgnoreTags: ["water"] }
	destination = ItemDestination.ITEM
}

actorDB["bootWater"] = BootWater
cc1BootNameList.push("bootWater")

export class BootDirt extends Item {
	id = "bootDirt"
	static carrierTags = { collisionIgnoreTags: ["filth"] }
	destination = ItemDestination.ITEM
	onPickup(other: Actor): void {
		if (other.hasTag("playable")) {
			this.carrierTags = { collisionIgnoreTags: getTagFlag("filth") }
		} else {
			this.carrierTags = { collisionIgnoreTags: BigInt(0) }
		}
	}
	// Double-ignore thing for the ghost
	onCarrierCompleteJoin(carrier: Actor): void {
		if (!carrier.hasTag("double-item-remove")) return
		for (const actor of carrier.tile.allActors) {
			if (actor.hasTag("filth") && actor.hasTag("boot-removable")) {
				actor.destroy(null, null)
			}
		}
	}
}

actorDB["bootDirt"] = BootDirt

export class GoronBraslet extends Item {
	id = "goronBraslet"
	static carrierTags = { pushTags: ["wall"] }
	destination = ItemDestination.ITEM
}

actorDB["goronBraslet"] = GoronBraslet

export class Helmet extends Item {
	id = "helmet"
	destination = ItemDestination.ITEM
	static carrierTags = { tags: ["ignore-default-monster-kill"] }
}

actorDB["helmet"] = Helmet

export class BonusFlag extends Item {
	hasItemMod(): boolean {
		return false
	}
	id = "bonusFlag"
	static tags = ["bonusFlag"]
	destination = ItemDestination.NONE
	onPickup(carrier: Actor): void {
		if (carrier.hasTag("real-playable"))
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
		if (!other.hasTag("real-playable")) return
		this.destroy(null, null)
		const lit = new LitTNT(this.level, this.tile.position)
		lit.inventory.itemMax = other.inventory.itemMax
		lit.inventory.items = other.inventory.items.map(item => {
			const rootTile = this.level.field[0][0]
			const rootActor = rootTile[item.layer]
			delete rootTile[item.layer]
			const nItem = new actorDB[item.id](
				this.level,
				[0, 0],
				item.customData
			) as Item
			nItem.pickup(lit)
			if (rootActor !== undefined) {
				rootTile[item.layer] = rootActor
			}
			return nItem
		})
		for (const keyType in other.inventory.keys)
			lit.inventory.keys[keyType] = { ...other.inventory.keys[keyType] }
		lit.recomputeTags()
	}
}

actorDB["tnt"] = TNT

export class SecretEye extends Item {
	id = "secretEye"
	static carrierTags = { tags: ["can-see-secrets"] }
	destination = ItemDestination.ITEM
}

actorDB["secretEye"] = SecretEye

export class RailroadSign extends Item {
	id = "railroadSign"
	static carrierTags = {
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
		const movable = dropper.tile[Layer.MOVABLE]
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
		return other.hasTag("real-playable")
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
		return other.hasTag("real-playable")
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
	actorCompletelyJoined(other: Actor): void {
		if (!other.hasTag("playable")) return
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
	onCarrierDestroyed(carrier: Actor): void {
		if (!carrier.tile.hasLayer(Layer.STATIONARY)) carrier.tile.poweringWires = 0
	}
}

actorDB["lightningBolt"] = LightningBolt

export class Hook extends Item {
	id = "hook"
	static carrierTags = { tags: ["pulling"] }
	destination = ItemDestination.ITEM
}

actorDB["hook"] = Hook

export class Foil extends Item {
	id = "foil"
	onCarrierBump(carrier: Actor, bumpee: Actor): void {
		if (!bumpee.hasTag("tinnable")) return
		bumpee.replaceWith(SteelWall)
	}
}

actorDB["foil"] = Foil

export class Bribe extends Item {
	id = "bribe"
	static tags = ["item", "bribe"]
}

actorDB["bribe"] = Bribe
