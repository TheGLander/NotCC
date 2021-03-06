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
		melinda: {
			up: [
				[0, 27],
				[7, 27],
			],
			right: [
				[8, 27],
				[15, 27],
			],
			down: [
				[0, 28],
				[7, 28],
			],
			left: [
				[8, 28],
				[15, 28],
			],
			waterUp: [
				[0, 29],
				[1, 29],
			],
			waterRight: [
				[2, 29],
				[3, 29],
			],
			waterDown: [
				[4, 29],
				[5, 29],
			],
			waterLeft: [
				[6, 29],
				[7, 29],
			],
			bumpUp: [8, 29],
			bumpRight: [9, 29],
			bumpDown: [10, 29],
			bumpLeft: [11, 29],
		},
		fire: [
			[12, 29],
			[16, 29],
		],
		key: {
			red: [4, 1],
			blue: [5, 1],
			yellow: [6, 1],
			green: [7, 1],
		},

		blueWall: { default: [0, 10], revealed: [10, 31] },
		invisibleWall: [9, 31],
		appearingWall: [11, 31],
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
		bomb: [5, 4],
		bombGreen: [6, 4],
		bombFuse: { 0: [7, 4], 1: [7.5, 4], 2: [7, 4.5], 3: [7.5, 4.5] },
		exit: [
			[6, 2],
			[9, 2],
		],
		iceBlock: { default: [10, 2], seeThrough: [11, 2] },
		bonusFlag: { 1000: [12, 2], 100: [13, 2], 10: [14, 2], "*2": [15, 2] },
		echipGreen: [9, 3],
		customFloor: {
			green: [8, 4],
			pink: [9, 4],
			yellow: [10, 4],
			blue: [11, 4],
		},
		customWall: {
			green: [12, 4],
			pink: [13, 4],
			yellow: [14, 4],
			blue: [15, 4],
		},
		echip: [11, 3],
		// TODO Add all art left
		tnt: [
			[0, 4],
			[4, 4],
		],
		boom: [
			[0, 5],
			[3, 5],
		],
		splash: [
			[4, 5],
			[7, 5],
		],
		flameJet: [
			[8, 5],
			[11, 5],
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
		turtle: [
			[13, 12],
			[15, 12],
		],
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
		steelWall: [15, 10],
		teethBlue: {
			vertical: [
				[0, 17],
				[1, 17],
			],
			right: [
				[2, 17],
				[3, 17],
			],
			left: [
				[4, 17],
				[5, 17],
			],
		},
		bowlingBall: [
			[6, 17],
			[7, 17],
		],
		forceFloor: {
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
			random: [
				[0, 21],
				[7, 21],
			],
		},
		dirt: [4, 31],
		popupWall: [8, 10],
		gravel: [9, 10],
		ball: [
			[10, 10],
			[14, 10],
		],
		transmogrifier: [
			[12, 19],
			[15, 19],
		],
		water: [
			[12, 24],
			[15, 24],
		],
		thinWall: {
			up: [1, 10],
			down: [1, 10.5],
			left: [2, 10],
			right: [2.5, 10],
		},
		teleportBlue: [
			[4, 10],
			[7, 10],
		],
		teleportGreen: [
			[4, 19],
			[7, 19],
		],
		teleportYellow: [
			[8, 19],
			[11, 19],
		],
		tankYellow: {
			up: [
				[8, 17],
				[9, 17],
			],
			right: [
				[10, 17],
				[11, 17],
			],
			down: [
				[12, 17],
				[13, 17],
			],
			left: [
				[14, 17],
				[15, 17],
			],
		},
		secretEye: [11, 18],
		teleportRed: [
			[4, 20],
			[7, 20],
		],
		slime: [
			[8, 20],
			[15, 20],
		],
		boot: {
			water: [0, 6],
			fire: [1, 6],
			ice: [2, 6],
			forceFloor: [3, 6],
			dirt: [4, 6],
		},
		outline: {
			green: [
				[0, 9],
				[3, 9],
			],
			purple: [
				[4, 9],
				[7, 9],
			],
		},
		outlineWall: [8, 9],
		trap: { closed: [9, 9], open: [10, 9] },
		playerAura: [6, 6],
		button: {
			blue: [8, 6],
			green: [9, 6],
			red: [10, 6],
			brown: [11, 6],
			pink: [12, 6],
			black: [13, 6],
			orange: [14, 6],
			yellow: [15, 6],
		},
		teethRed: {
			vertical: [
				[0, 11],
				[2, 11],
			],
			right: [
				[3, 11],
				[5, 11],
			],
			left: [
				[6, 11],
				[8, 11],
			],
		},
		swivel: {
			dl: [9, 11],
			ul: [10, 11],
			ur: [11, 11],
			dr: [12, 11],
			floor: [13, 11],
		},
		tankBlue: {
			up: [
				[0, 8],
				[1, 8],
			],
			right: [
				[2, 8],
				[3, 8],
			],
			down: [
				[4, 8],
				[5, 8],
			],
			left: [
				[6, 8],
				[7, 8],
			],
		},
		walker: {
			idle: [0, 13],
			vertical: [
				[1, 13],
				[7, 13],
			],
			horizontal: [
				[8, 13],
				[10, 13],
				[12, 13],
				[14, 13],
				[8, 14],
				[10, 14],
				[12, 14],
			],
		},
		helmet: [0, 14],
		blob: {
			idle: [0, 15],
			vertical: [
				[1, 15],
				[7, 15],
			],
			horizontal: [
				[8, 15],
				[10, 15],
				[12, 15],
				[14, 15],
				[8, 16],
				[10, 16],
				[12, 16],
			],
		},
		floorMimic: [14, 16],
		greenWall: { real: [12, 5], fake: [13, 5] },
		noSign: [14, 5],
		directionalBlock: {
			default: [15, 5],
			arrowUp: [3, 10],
			arrowRight: [3.75, 10],
			arrowDown: [3, 10.75],
			arrowLeft: [3, 10],
		},
		letter: {
			"0": [8, 0],
			"1": [8.5, 0],
			"2": [9, 0],
			"3": [9.5, 0],
			"4": [10, 0],
			"5": [10.5, 0],
			"6": [11, 0],
			"7": [11.5, 0],
			"8": [12, 0],
			"9": [12.5, 0],
			"!": [0.5, 0],
			'"': [1, 0],
			"#": [1.5, 0],
			$: [2, 0],
			"%": [2.5, 0],
			"&": [3, 0],
			"'": [3.5, 0],
			"(": [4, 0],
			")": [4.5, 0],
			"*": [5, 0],
			"+": [5.5, 0],
			",": [6, 0],
			"-": [6.5, 0],
			".": [7, 0],
			"/": [7.5, 0],
			":": [13, 0],
			";": [13.5, 0],
			"<": [14, 0],
			"=": [14.5, 0],
			">": [15, 0],
			"?": [15.5, 0],
			"@": [0, 0.5],
			A: [0.5, 0.5],
			B: [1, 0.5],
			C: [1.5, 0.5],
			D: [2, 0.5],
			E: [2.5, 0.5],
			F: [3, 0.5],
			G: [3.5, 0.5],
			H: [4, 0.5],
			I: [4.5, 0.5],
			J: [5, 0.5],
			K: [5.5, 0.5],
			L: [6, 0.5],
			M: [6.5, 0.5],
			N: [7, 0.5],
			O: [7.5, 0.5],
			P: [8, 0.5],
			Q: [8.5, 0.5],
			R: [9, 0.5],
			S: [9.5, 0.5],
			T: [10, 0.5],
			U: [10.5, 0.5],
			V: [11, 0.5],
			W: [11.5, 0.5],
			X: [12, 0.5],
			Y: [12.5, 0.5],
			Z: [13, 0.5],
			"[": [13.5, 0.5],
			"]": [14, 0.5],
			"^": [14.5, 0.5],
			_: [15, 0.5],
		},
		voodooTileStart: [0, 21],
		noMelindaSign: [5, 31],
		noChipSign: [6, 31],
		railroad: {
			woodUR: [0, 30],
			woodDR: [1, 30],
			woodDL: [2, 30],
			woodUL: [3, 30],
			woodLR: [4, 30],
			woodUD: [5, 30],
			toggleMark: [6, 30],
			toggleRailUR: [7, 30],
			toggleRailDR: [8, 30],
			toggleRailDL: [9, 30],
			toggleRailUL: [10, 30],
			toggleRailLR: [11, 30],
			toggleRailUD: [12, 30],
			railUR: [13, 30],
			railDR: [14, 30],
			railDL: [15, 30],
			railUL: [0, 31],
			railLR: [1, 31],
			railUD: [2, 31],
		},
		railroadSign: [3, 31],
		rover: {
			teethRed: [
				[0, 18],
				[8, 18],
				[0, 18],
				[8, 18],
				[0, 18],
				[8, 18],
				[0, 18],
				[8, 18],
			],
			glider: [
				[0, 18],
				[7, 18],
			],
			// TODO Have proper animation length
			centipede: [
				[1, 18],
				[1, 18],
				[3, 18],
				[3, 18],
				[5, 18],
				[5, 18],
				[7, 18],
				[7, 18],
			],
			fireball: [
				[7, 18],
				[0, 18],
			],
			ant: [
				[7, 18],
				[7, 18],
				[4, 18],
				[4, 18],
				[3, 18],
				[3, 18],
				[1, 18],
				[1, 18],
			],
			ball: [
				[0, 18],
				[4, 18],
				[0, 18],
				[4, 18],
				[0, 18],
				[4, 18],
				[0, 18],
				[4, 18],
			],
			teethBlue: [
				[0, 18],
				[9, 18],
				[0, 18],
				[9, 18],
				[0, 18],
				[9, 18],
				[0, 18],
				[9, 18],
			],
			walker: [
				[8, 18],
				[9, 18],
				[8, 18],
				[9, 18],
				[8, 18],
				[9, 18],
				[8, 18],
				[9, 18],
			],
			antennaUp: [
				[10, 18],
				[10.5, 18.5],
			],
			antennaRight: [
				[10.5, 18],
				[11, 18.5],
			],
			antennaDown: [
				[10.5, 18.5],
				[11.5, 19],
			],
			antennaLeft: [
				[10, 18.5],
				[10.5, 19],
			],
		},
	},
}

export default cc2ImageFormat
