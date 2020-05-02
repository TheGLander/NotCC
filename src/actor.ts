import { LevelState } from "./level"
import { Direction, clone } from "./helpers"
import { actorDB } from "./const"
export type actorType =
	| "playable"
	| "monster"
	| "terrain"
	| "static"
	| "pushable"
export namespace defaults {
	export const onTick = [
		function (this: Actor) {
			if (this.moveProgress < this.moveSpeed && this.moving) this.moveProgress++
			if (this.moveProgress === this.moveSpeed) {
				this.moving = false
				this.moveProgress = 0
				const thisStack = this.getCurrentStack()
				for (const i in thisStack) {
					thisStack[i].collision(this)
					this.collision(thisStack[i])
				}
			}
		},
	]
	export const solidChecks: ((this: Actor, second: Actor) => boolean)[] = []
	export const onCollision = []
	export const onWeakCollision = []
}
export default class Actor {
	//Constants
	moveSpeed: number = 4
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
		public name: string,
		public actorType: actorType,
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
		for (const i in defaults.solidChecks)
			if (defaults.solidChecks[i].call(this, second)) return true
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
		for (const i in defaults.onTick) defaults.onTick[i].call(this)
		for (const i in this.onTick) this.onTick[i].call(this)
	}
	onTick: (() => void)[] = []

	create(pos: [number, number], direction: Direction, level: LevelState): this {
		const newActor = clone(this)
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
		for (const i in destinationTile) {
			destinationTile[i].weakCollision(this)
			this.weakCollision(destinationTile[i])
		}
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
	getCurrentStack() {
		return this?.level.field[this.x]?.[this.y]
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
	/**
	 * Called when two actors are in strong collision, AKA they are on the same tile and aren't moving
	 * @param second The actor this actor is in collision with
	 */
	collision(second: Actor) {
		for (const i in defaults.onCollision)
			defaults.onCollision[i].call(this, second)
		for (const i in this.onCollision) this.onCollision[i].call(this, second)
	}
	onCollision: ((this: this, second: Actor) => void)[] = []

	/**
	 * Called when two actors are in weak collision, AKA they are on the same tile
	 * @param second The actor this actor is in collision with
	 */
	weakCollision(second: Actor) {
		for (const i in defaults.onWeakCollision)
			defaults.onWeakCollision[i].call(this, second)
		for (const i in this.onWeakCollision)
			this.onWeakCollision[i].call(this, second)
	}
	onWeakCollision: ((this: this, second: Actor) => void)[] = []
}
