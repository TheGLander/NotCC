import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"

export class DirtBlock extends Actor {
	art = { art: "dirtBlock" }
	pushable = true
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	moveSpeed = 4
	newTile(): void {
		const playable = this.tile[Layers.MOVABLE].find(
			val => val instanceof Playable
		) as Playable | undefined
		playable?.invokeDeath(this)
	}
}

actorDB["dirtBlock"] = DirtBlock
