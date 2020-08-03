import * as PIXI from "pixi.js"
import { clone } from "./helpers"

//Create a Pixi Application
const app = new PIXI.Application({ width: 256, height: 256 }),
	loader = PIXI.Loader.shared

//Add the canvas that Pixi automatically created for you to the HTML document
document.body.appendChild(app.view)

function createTiles(
	matrix: (string | null)[][],
	tileSize: [number, number],
	image: string
): void {
	const source = loader.resources[image]
	if (!source) throw new Error("Invalid image!")
	for (let y = 0; y < matrix.length; y++)
		for (let x = 0; x < matrix[y].length; x++) {
			if (matrix[y][x] === null) continue
			loader.resources[matrix[y][x]] = clone(source)
			loader.resources[matrix[y][x]].texture.frame = new PIXI.Rectangle(
				x * tileSize[0],
				y * tileSize[1],
				tileSize[0],
				tileSize[1]
			)
		}
}

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
				"block",
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
			[null, "lockGreen", "buttonBlue", null, "ball", "walkerVert", "bootBlue"],
			[null, "lockYellow", "portalBlue", null, null, "walkerHoriz", "bootRed"],
			[null, "iceCorner", "bomb", null, null, null, "bootLightBlue"],
			["dirt", null, "trap", null, null, null, "bootGreen"],
			["ice", null, null, "chipWaterUp", "blueTankUp", "slime", "chipUp"],
			[null, null, "gravel", "chipWaterLeft", "blueTankLeft", null, "chipLeft"],
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
	//Create the cat sprite
	for (const i in loader.resources) {
		if (i === "./img/tiles.png") continue
		const sprite = new PIXI.Sprite(PIXI.Loader.shared.resources[i].texture)
		sprite.x = Math.random() * 128

		sprite.y = Math.random() * 128
		//Add the cat to the stage
		app.stage.addChild(sprite)
	}
})
