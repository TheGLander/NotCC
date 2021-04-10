import { Layers } from "../tile"
import { Actor, ActorArt, matchTags } from "../actor"
import { actorDB } from "../const"
import { LevelState } from "../level"

export const enum ItemDestination {
	NONE,
	KEY,
	ITEM,
}

export abstract class Item extends Actor {
	tags = ["item"]
	destination = ItemDestination.ITEM
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
					other.inventory.keys[this.id] = { amount: 0, type: this }
				other.inventory.keys[this.id].amount++
				break
			case ItemDestination.ITEM:
				if (other.inventory.items.length === other.inventory.itemMax)
					other.dropItem()
				other.inventory.items.unshift(this)
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

export class EChip extends Item {
	id = "echip"
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		level.chipsLeft++
		level.chipsRequired++
	}
}

actorDB["echip"] = EChip

export class KeyBlue extends Item {
	id = "keyBlue"
	art: ActorArt = { actorName: "key", animation: "blue" }
	destination = ItemDestination.KEY
	blocks = undefined
}

actorDB["keyBlue"] = KeyBlue

export class BootWater extends Item {
	id = "bootWater"
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "water" }
}

actorDB["bootWater"] = BootWater

export class BootFire extends Item {
	id = "bootFire"
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "fire" }
}

actorDB["bootFire"] = BootFire

export class BootIce extends Item {
	id = "bootIce"
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "ice" }
}

actorDB["bootIce"] = BootIce

export class BootForceFloor extends Item {
	id = "bootForceFloor"
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "forceFloor" }
}

actorDB["bootForceFloor"] = BootForceFloor

export class BootDirt extends Item {
	id = "bootDirt"
	destination = ItemDestination.ITEM
	art: ActorArt = { actorName: "boot", animation: "dirt" }
}

actorDB["bootDirt"] = BootDirt
