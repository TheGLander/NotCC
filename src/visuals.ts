import * as PIXI from "pixi.js"
import { Direction } from "./helpers"
import { LevelState } from "./level"
import clone from "deepclone"
import { Actor } from "./actor"

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

// TODO Custom tilsets
const fetchTiles = new Promise<void>(resolve =>
	loader.add("./data/img/tiles.png").load(() => {
		createTiles(
			[
				[
					"empty",
					null,
					null,
					"panelCorner",
					"antUp",
					"gliderUp",
					"centipedeUp",
				],
				[
					"wall",
					"dirtBlock",
					"itemThief",
					"cloneMachine",
					"antLeft",
					"gliderLeft",
					"centipedeLeft",
				],
				[
					"echip",
					"forceFloor",
					"echipGate",
					"forceFloorRandom",
					"antDown",
					"gliderDown",
					"centipedeDown",
				],
				[
					"water",
					null,
					"buttonGreen",
					"splash",
					"antRight",
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
			"./data/img/tiles.png"
		)
		resolve()
	})
)

export default class Renderer {
	ready: Promise<void>
	spriteMap = new WeakMap<Actor, PIXI.Sprite>()
	app: PIXI.Application
	/**
	 * Initializes the renderer, optional `this.ready` promise
	 * @param level
	 */
	constructor(
		public level: LevelState,
		public renderSpace?: HTMLElement | null,
		public itemSpace?: HTMLElement | null
	) {
		//Create a Pixi Application
		const app = new PIXI.Application({
			width: level.cameraType.width * 48,
			height: level.cameraType.height * 48,
		})
		app.stage.sortableChildren = true
		this.app = app
		this.ready = (async () => {
			await fetchTiles
			const bg = new PIXI.TilingSprite(
				loader.resources.empty.texture,
				level.width * 48,
				level.height * 48
			)
			app.stage.addChild(bg)
			// Add the canvas that Pixi automatically created for you to the HTML document
			renderSpace?.appendChild(app.view)
		})()
	}
	/**
	 * Updates the positions of the rendred sprites
	 */
	frame(): void {
		for (const actor of this.level.destroyedThisTick) {
			const sprite = this.spriteMap.get(actor)
			if (!sprite) continue
			sprite.destroy()
			this.spriteMap.delete(actor)
		}
		for (const actor of this.level.activeActors) {
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
			let sprite = this.spriteMap.get(actor)
			// Create actor sprite if it's new
			if (!sprite) {
				sprite = new PIXI.Sprite(loader.resources.unknown.texture)
				sprite.anchor.set(0.5, 0.5)
				sprite.zIndex = actor.layer * 100
				this.app.stage.addChild(sprite)
				this.spriteMap.set(actor, sprite)
			}
			sprite.texture =
				loader.resources[art.art]?.texture ?? loader.resources.unknown.texture
			sprite.angle = art.rotation ?? 0
			sprite.position.set(movedPos[0] * 48 + 24, movedPos[1] * 48 + 24)
			if (actor === this.level.selectedPlayable)
				this.app.stage.pivot.set(
					Math.max(
						0,
						Math.min(
							movedPos[0] + 0.5,
							this.level.width - this.level.cameraType.width / 2
						) *
							48 -
							this.level.cameraType.width * 24
					),
					Math.max(
						0,
						Math.min(
							movedPos[1] + 0.5,
							this.level.height - this.level.cameraType.height / 2
						) *
							48 -
							this.level.cameraType.height * 24
					)
				)
		}

		this.app.render()
	}
	destroy(): void {
		this.app.destroy(true)
	}
}
