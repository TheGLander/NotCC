import { LevelState } from "./level"
import { Direction, clone } from "./helpers"
import { actorDB } from "./const"
export default class Actor {
	//Constants
	moveSpeed: number = 2
	playable: boolean = false
	/**
		Flag to do everything based on relative directions, otherwise absolute directions are used
	 */
	relativeMovement: boolean = true

	// Semi constant
	fullname: string
	//Changes while in level
	moving: boolean | null = null
	x: number | null = null
	y: number | null = null
	inventory: string[] | null = null
	level: LevelState | null = null
	created: boolean = false
	direction: number | null = null
	moveProgress: number | null = null
	constructor(
		public name: string = "unknown",
		public extName: string = "unknown"
	) {
		this.fullname = `${extName}.${name}`
		actorDB[this.fullname] = this
	}
	/**
	 * Check if the actor is solid to a second actor
	 * @param second The second actor
	 */
	solidTo(second: Actor): boolean {
		for (const i in this.solidChecks)
			if (this.solidChecks[i].call(this, second)) return true
		return false
	}
	/**
	The checks to do to define if the actor is solid to a second actor
 */
	solidChecks: ((second: Actor) => boolean)[] = []
	/**
	 * Execute tick related functions
	 */
	tick(): void {
		for (const i in this.onTick) this.onTick[i].call(this)
		if (this.moveProgress < this.moveSpeed && this.moving) this.moveProgress++
		if (this.moveProgress === this.moveSpeed) {
			this.moving = false
			this.moveProgress = 0
		}
	}
	onTick: (() => void)[] = []

	create(
		pos: [number, number],
		direction: Direction,
		level: LevelState
	): Actor {
		const newActor: Actor = clone(this)
		newActor.x = pos[0]
		newActor.y = pos[1]
		newActor.inventory = []
		newActor.level = level
		newActor.created = true
		newActor.moving = false
		newActor.direction = direction
		newActor.onTick = this.onTick.map(func => func.bind(newActor))
		level.field[newActor.x][newActor.y].push(newActor)
		level.activeActors.push(newActor)
		return newActor
	}

	move(direction: Direction): boolean {
		//Sanity checks
		if (!this.created)
			throw new Error(
				"Can't access created-only method while not being created"
			)
		if (this.moving) return false
		//Find the destination tile
		const destination = this.directionToCoords(direction)
		const destinationTile = this.getNeighbor(direction)
		if (!this.canMoveTo(direction)) return false
		//Remove from the old tile
		const thisStack = this.level.field[this.x][this.y]
		thisStack.splice(thisStack.indexOf(this), 1)

		//Add to the new tile
		destinationTile.push(this)
		//Update coordinates
		this.x = destination[0]
		this.y = destination[1]
		//Create a move timeout
		this.moving = true
		return true
	}
	canMoveTo(direction: Direction) {
		//Find the destination tile
		const destinationTile = this.getNeighbor(direction)
		//Exit if out of bounds
		if (!destinationTile) return false
		//Check if anything on it is solid
		for (const i in destinationTile)
			if (destinationTile[i].solidTo(this)) return false
		return true
	}
	getNeighbor(direction: Direction) {
		let destination = this.directionToCoords(direction)
		return this.level.field[destination[0]]?.[destination[1]]
	}
	/**
	 * Gets coordinates of tiles relative to the actor and returns them
	 * @param direction The direction of the tile to get
	 * @param considerContext To consider the actors current direction
	 */
	directionToCoords(
		direction: Direction,
		considerContext: boolean = this.relativeMovement
	): [number, number] {
		let newDirection = direction + 0
		if (considerContext) newDirection += this.direction
		newDirection %= 4
		switch (newDirection) {
			case Direction.UP:
				return [this.x, this.y - 1]
			case Direction.DOWN:
				return [this.x, this.y + 1]
			case Direction.LEFT:
				return [this.x - 1, this.y]
			case Direction.RIGHT:
				return [this.x + 1, this.y]
		}
	}
	rotate(direction: Direction) {
		if (this.relativeMovement) this.direction = (this.direction + direction) % 4
		else this.direction = direction
	}
}
