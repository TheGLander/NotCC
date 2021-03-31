import * as PIXI from "pixi.js"
import { Direction } from "./helpers"
import { LevelState } from "./level"
import clone from "deepclone"

const loader = PIXI.Loader.shared

function createTiles(
	matrix: (string | null)[][],
	tileSize: [number, number],
	image: string
): void {
	const source = loader.resources[image]
	if (!source) throw new Error("Invalid image!")
	for (let y = 0; y < matrix.length; y++)
		for (let x = 0; x < matrix[y].length; x++) {
			const matrixEntry = matrix[y][x]
			if (matrixEntry === null) continue
			loader.resources[matrixEntry] = clone(source)
			loader.resources[matrixEntry].texture.frame = new PIXI.Rectangle(
				x * tileSize[0],
				y * tileSize[1],
				tileSize[0],
				tileSize[1]
			)
		}
}

/**
 * Converts a direction to x and y multipliers
 * @param direction
 */
function convertDirection(direction: Direction): [number, number] {
	switch (direction) {
		case Direction.UP:
			return [0, -1]
		case Direction.RIGHT:
			return [1, 0]
		case Direction.DOWN:
			return [0, 1]
		case Direction.LEFT:
			return [-1, 0]
	}
}

const fetchTiles = new Promise<void>(resolve =>
	loader.add("./img/tiles.png").load(() => {
		createTiles(
			[
				[
					"empty",
					null,
					null,
					"panelCorner",
					"spiderUp",
					"gliderUp",
					"centipedeUp",
				],
				[
					"wall",
					"dirtBlock",
					"itemThief",
					"cloneMachine",
					"spiderLeft",
					"gliderLeft",
					"centipedeLeft",
				],
				[
					"echip",
					"forceFloor",
					"echipGate",
					"forceFloorRandom",
					"spiderDown",
					"gliderDown",
					"centipedeDown",
				],
				[
					"water",
					null,
					"buttonGreen",
					null,
					"spiderRight",
					"gliderRight",
					"centipedeRight",
				],
				["fire", null, "buttonRed", null, "fireballUp", "teethUp", "keyBlue"],
				[
					null,
					"exit",
					"greenOutlineOn",
					"unknown",
					"fireballLeft",
					"teethLeft",
					"keyRed",
				],
				[
					"panel",
					"lockBlue",
					"greenOutlineOff",
					"boom",
					"fireballDown",
					"teethDown",
					"keyGreen",
				],
				[
					null,
					"lockRed",
					"buttonBrown",
					"boom2",
					"fireballRight",
					"teethRight",
					"keyBlue",
				],
				[
					null,
					"lockGreen",
					"buttonBlue",
					null,
					"ball",
					"walkerVert",
					"bootBlue",
				],
				[
					null,
					"lockYellow",
					"portalBlue",
					null,
					null,
					"walkerHoriz",
					"bootRed",
				],
				[null, "iceCorner", "bomb", null, null, null, "bootLightBlue"],
				["dirt", null, "trap", null, null, null, "bootGreen"],
				["ice", null, null, "chipWaterUp", "blueTankUp", "slime", "chipUp"],
				[
					null,
					null,
					"gravel",
					"chipWaterLeft",
					"blueTankLeft",
					null,
					"chipLeft",
				],
				[
					null,
					"blueWall",
					"popupWall",
					"chipWaterDown",
					"blueTankDown",
					null,
					"chipDown",
				],
				[
					null,
					null,
					"hint",
					"chipWaterRight",
					"blueTankRight",
					null,
					"chipRight",
				],
			],
			[48, 48],
			"./img/tiles.png"
		)
		resolve()
	})
)

export default class Renderer {
	ready: Promise<void>
	lastId = 0
	sprites: PIXI.Sprite[] = []
	app: PIXI.Application
	moveProgress: number[] = []
	moveProgressDirection: number[] = []
	/**
	 * Initializes the renderer, optional `this.ready` promise
	 * @param level
	 */
	constructor(public level: LevelState) {
		//Create a Pixi Application
		const app = new PIXI.Application({
			width: level.width * 48,
			height: level.height * 48,
		})
		this.app = app

		this.ready = (async () => {
			await fetchTiles
			const bg = new PIXI.TilingSprite(
				loader.resources.empty.texture,
				level.width * 48,
				level.height * 48
			)
			app.stage.addChild(bg)
			//Add the canvas that Pixi automatically created for you to the HTML document
			document.getElementById("renderSpace")?.appendChild(app.view)
		})()
	}
	/**
	 * Updates the positions of the rendred sprites
	 */
	frame(): void {
		//Catch up on new actors
		for (; this.lastId < this.level.activeActors.length; this.lastId++) {
			const sprite = new PIXI.Sprite(loader.resources.unknown.texture)
			const actor = this.level.activeActors[this.lastId]
			this.sprites.push(sprite)
			this.app.stage.addChild(sprite)
			this.moveProgress[this.lastId] = 0
			//debugger
			sprite.position.set(actor.tile.x * 48, actor.tile.y * 48)
			sprite.anchor.set(0.5, 0.5)
		}
		for (let i = 0; i < this.level.activeActors.length; i++) {
			const actor = this.level.activeActors[i]

			const movedPos = [actor.tile.x, actor.tile.y]
			if (actor.cooldown && actor.currentMoveSpeed) {
				const mults = convertDirection(actor.direction)
				const offsetMult =
					1 -
					(actor.currentMoveSpeed - actor.cooldown + 1) / actor.currentMoveSpeed
				movedPos[0] -= offsetMult * mults[0]
				movedPos[1] -= offsetMult * mults[1]
			}
			const art =
				typeof actor.art === "function"
					? actor.art()
					: actor.art ?? { art: "unknown" }
			this.sprites[i].texture =
				loader.resources[art.art]?.texture ?? loader.resources.unknown.texture
			this.sprites[i].angle = art.rotation ?? 0
			this.sprites[i].position.set(movedPos[0] * 48 + 24, movedPos[1] * 48 + 24)
		}
	}
	destroy() {
		this.app.destroy(true)
	}
}
