import {
	Actor,
	Animation,
	CounterGate,
	LatchGate,
	LatchGateMirror,
	Layer,
	LevelState,
	LitTNT,
	Playable,
	Railroad,
	Rover,
	Tile,
} from "@notcc/logic"

class CRC32 {
	static table = Uint32Array.from(Array(256).fill(0), (_, i) => {
		for (let n = 0; n < 8; n += 1) {
			i = i & 1 ? (i >>> 1) ^ 0xedb88320 : i >>> 1
		}
		return i
	})
	value = ~0
	constructor() {}
	feed8(num: number | boolean) {
		this.value = (this.value >> 8) ^ CRC32.table[(this.value ^ +num) & 0xff]
	}
	feed32(num: number) {
		this.feed8(num & 0xff)
		this.feed8((num >>> 8) & 0xff)
		this.feed8((num >>> 16) & 0xff)
		this.feed8((num >>> 24) & 0xff)
	}
	feedStr(str: string) {
		for (let i = 0; i < str.length; i += 1) {
			this.feed32(str.codePointAt(i)!)
		}
	}
	finalize() {
		return ~this.value
	}
}

function hashActor(crc: CRC32, actor: Actor, settings: HashSettings) {
	crc.feedStr(actor.id)
	if (actor.layer === Layer.STATIONARY) {
		crc.feed8(actor.poweredWires)
		crc.feed8(actor.direction)
		if (actor instanceof Railroad) {
			crc.feedStr(actor.activeTrack)
			crc.feed8(actor.lastEnteredDirection * 4)
		} else if (
			actor instanceof LatchGate ||
			actor instanceof LatchGateMirror ||
			actor instanceof CounterGate
		) {
			crc.feed8(actor.memory)
		}
	}
	if (actor instanceof Animation) {
		crc.feed8(actor.animationCooldown)
	}
	if (actor.isDeciding) {
		crc.feed8(actor.cooldown)
		if (
			actor.slidingState ||
			(!(settings.ignoreBlockOrder && actor.tags?.includes("block")) &&
				!(actor instanceof Playable && settings.ignorePlayerDir))
		) {
			crc.feed8(actor.direction)
		}
		if (!(settings.ignoreBlockOrder && actor.tags?.includes("block"))) {
			crc.feed8(actor.createdN)
		}
		crc.feed8(actor.pendingDecision)
		if (actor instanceof Playable) {
			if (!settings.ignorePlayerBump) {
				crc.feed8(actor.lastDecision)
			}
			crc.feed8(actor.hasOverride)
		} else if (actor instanceof LitTNT) {
			crc.feed8(actor.lifeLeft)
		} else if (actor instanceof Rover) {
			crc.feedStr(actor.emulatedMonster)
			crc.feed8(actor.decisionsUntilNext)
		}
		for (const item of actor.inventory.items) {
			crc.feedStr(item.id)
		}
		for (const [k, { amount }] of Object.entries(actor.inventory.keys)) {
			if (amount > 0) {
				crc.feedStr(k)
				crc.feed8(amount)
			}
		}
	}
	crc.feedStr(actor.customData)
}

function hashTile(crc: CRC32, tile: Tile, settings: HashSettings) {
	crc.feed8(tile.poweredWires)
	for (let layer = Layer.STATIONARY; layer <= Layer.SPECIAL; layer += 1) {
		for (const actor of tile[layer]) {
			hashActor(crc, actor, settings)
		}
	}
}

export interface HashSettings {
	ignoreBlockOrder?: boolean
	ignorePlayerDir?: boolean
	ignorePlayerBump?: boolean
	ignoreFloorMimicParity?: boolean
	ignoreTeethParity?: boolean
}

export function makeLevelHash(
	level: LevelState,
	settings: HashSettings
): number {
	const crc = new CRC32()
	crc.feed32(level.chipsLeft)
	crc.feed32(level.bonusPoints)
	crc.feed8(level.prngValue1)
	crc.feed8(level.prngValue2)
	crc.feed8(level.blobPrngValue)
	crc.feed8(level.timeFrozen)
	crc.feed8(level.randomForceFloorDirection)
	if (!settings.ignoreFloorMimicParity) {
		crc.feed8(level.currentTick % 16)
	} else if (!settings.ignoreTeethParity) {
		crc.feed8(level.currentTick % 8)
	}
	for (const tile of level.tiles()) {
		hashTile(crc, tile, settings)
	}
	return crc.finalize()
}
