import { CC2ImageFormat } from "./visuals"

const cc2ImageFormat: CC2ImageFormat = {
	actorMapping: {
		placeholder: [0, 0],
		chip: {
			up: [
				[0, 22],
				[7, 22],
			],
			right: [
				[8, 22],
				[15, 22],
			],
			down: [
				[0, 23],
				[7, 23],
			],
			left: [
				[8, 23],
				[15, 23],
			],
			waterUp: [
				[0, 24],
				[1, 24],
			],
			waterRight: [
				[2, 24],
				[3, 24],
			],
			waterDown: [
				[4, 24],
				[5, 24],
			],
			waterLeft: [
				[6, 24],
				[7, 24],
			],
			bumpUp: [8, 24],
			bumpRight: [9, 24],
			bumpDown: [10, 24],
			bumpLeft: [11, 24],
		},
		key: {
			red: [4, 1],
			blue: [5, 1],
			yellow: [6, 1],
			green: [7, 1],
		},
		door: {
			red: [0, 1],
			blue: [1, 1],
			yellow: [2, 1],
			green: [3, 1],
		},
		dirtBlock: { default: [8, 1], seeThrough: [9, 1] },
		ice: {
			default: [10, 1],
			dr: [11, 1],
			dl: [12, 1],
			ur: [13, 1],
			ul: [14, 1],
		},
		cloneMachine: [15, 1],
		floor: { default: [0, 2], framed: [2, 2] },
		wall: [1, 2],
		thief: { tool: [3, 2], key: [15, 21] },
		echipGate: [4, 2],
		hint: [5, 2],
		exit: [
			[6, 2],
			[9, 2],
		],
		iceBlock: { default: [10, 2], seeThrough: [11, 2] },
		echip: [11, 3],
		// TODO Everything else
		boom: [
			[0, 5],
			[3, 5],
		],
		splash: [
			[4, 5],
			[7, 5],
		],
		ant: {
			up: [
				[0, 7],
				[3, 7],
			],
			right: [
				[4, 7],
				[7, 7],
			],
			down: [
				[8, 7],
				[11, 7],
			],
			left: [
				[12, 7],
				[15, 7],
			],
		},
		centipede: {
			up: [
				[0, 12],
				[2, 12],
			],
			right: [
				[3, 12],
				[5, 12],
			],
			down: [
				[6, 12],
				[8, 12],
			],
			left: [
				[9, 12],
				[11, 12],
			],
		},
		glider: {
			up: [
				[8, 8],
				[9, 8],
			],
			right: [
				[10, 8],
				[11, 8],
			],
			down: [
				[12, 8],
				[13, 8],
			],
			left: [
				[14, 8],
				[15, 8],
			],
		},
		fireball: [
			[12, 9],
			[15, 9],
		],
		forceFloor: {
			// TODO Force-floor animation
			up: [
				[0, 19],
				[0, 20],
			],
			down: [
				[1, 19],
				[1, 20],
			],
			right: [
				[2, 19],
				[3, 19],
			],
			left: [
				[2, 20],
				[3, 20],
			],
		},
		dirt: [4, 31],
		gravel: [9, 10],
		water: [
			[12, 24],
			[15, 24],
		],
		teleportBlue: [
			[4, 10],
			[7, 10],
		],
		teleportRed: [
			[4, 20],
			[7, 20],
		],
		boot: {
			water: [0, 6],
			fire: [1, 6],
			ice: [2, 6],
			forceFloor: [3, 6],
			dirt: [4, 6],
		},
	},
}

export default cc2ImageFormat
