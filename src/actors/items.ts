import { Layers } from "../tile"
import { Actor, ActorArt, matchTags } from "../actor"
import { actorDB, keyNameList } from "../const"
import { LevelState } from "../level"

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
	carrierTags: Record<string, string[]> = {}
	blocks?(other: Actor): boolean {
		return !matchTags(other.tags, [
			"can-pickup-items",
			"can-stand-on-items",
			"playable",
		])
	}
	get layer(): Layers {
		return Layers.ITEM
	}
	actorCompletelyJoined(other: Actor): void {
		if (other.tags.includes("can-stand-on-items")) return
		this.destroy(other, null)
		switch (this.destination) {
			case ItemDestination.KEY:
				if (!other.inventory.keys[this.id])
					other.inventory.keys[this.id] = { amount: 0, type: this as Key }
				other.inventory.keys[this.id].amount++
				break
			case ItemDestination.ITEM:
				other.inventory.items.unshift(this)
				if (other.inventory.items.length > other.inventory.itemMax)
					other.dropItem()
				break
		}
		this.onPickup?.(other)
	}
	onPickup?(other: Actor): void
	onDrop?(other: Actor): void
}

export class EChipPlus extends Item {
	id = "echipPlus"
	destination = ItemDestination.NONE
	art: ActorArt = { actorName: "echip" }
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		level.chipsTotal++
	}
	onPickup(): void {
		this.level.chipsLeft = Math.max(0, this.level.chipsLeft - 1)
	}
}

actorDB["echipPlus"] = EChipPlus

export class EChip extends EChipPlus {
	id = "echip"
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
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
	art: ActorArt = { actorName: "key", animation: "red" }
	keyUsed(other: Actor): void {
		if (other.getCompleteTags("tags").includes("can-reuse-key-red"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyRed"] = KeyRed

keyNameList.push("keyRed")

export class KeyBlue extends Key {
	id = "keyBlue"
	art: ActorArt = { actorName: "key", animation: "blue" }
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
	art: ActorArt = { actorName: "key", animation: "yellow" }
	keyUsed(other: Actor): boolean {
		return other.getCompleteTags("tags").includes("can-reuse-key-yellow")
	}
}

actorDB["keyYellow"] = KeyYellow

keyNameList.push("keyYellow")

export class KeyGreen extends Key {
	id = "keyGreen"
	art: ActorArt = { actorName: "key", animation: "green" }
	keyUsed(other: Actor): void {
		if (other.getCompleteTags("tags").includes("can-reuse-key-green"))
			other.inventory.keys[this.id].amount++
	}
}

actorDB["keyGreen"] = KeyGreen

keyNameList.push("keyGreen")

export class BootWater extends Item {
	id = "bootWater"
	carrierTags = { ignoreTags: ["water"] }
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "water" }
}

actorDB["bootWater"] = BootWater

export class BootFire extends Item {
	id = "bootFire"
	carrierTags = { ignoreTags: ["fire"] }
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "fire" }
}

actorDB["bootFire"] = BootFire

export class BootIce extends Item {
	id = "bootIce"
	carrierTags = { ignoreTags: ["ice"] }
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "ice" }
}

actorDB["bootIce"] = BootIce

export class BootForceFloor extends Item {
	id = "bootForceFloor"
	carrierTags = { ignoreTags: ["force-floor"] }
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "forceFloor" }
}

actorDB["bootForceFloor"] = BootForceFloor

export class BootDirt extends Item {
	id = "bootDirt"
	carrierTags = { collisionIgnoreTags: ["filth"] }
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "dirt" }
}

actorDB["bootDirt"] = BootDirt

export class GoronBraslet extends Item {
	id = "goronBraslet"
	carrierTags = { pushTags: ["wall"] }
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "chip", animation: "bumpRight" }
}

actorDB["goronBraslet"] = GoronBraslet

export class Helmet extends Item {
	id = "helmet"
	destination = ItemDestination.ITEM
	carrierTags = { blockTags: ["movable"], blockedByTags: ["movable"] }
	art: ActorArt = { actorName: "placeholder" }
}

actorDB["helmet"] = Helmet
