import { ArtSet, frange } from "./renderer"

export const cc2ArtSet: ArtSet = {
	floor: {
		type: "special",
		specialType: "freeform wires",
		base: [0, 2],
		overlap: [8, 26],
		overlapCross: [10, 26],
	},
	currentPlayerMarker: [6, 6],
	wireBase: [0, 2],
	wire: [
		[13, 26],
		[15, 26],
	],
	wireTunnel: {
		type: "directic",
		UP: [14, 11],
		RIGHT: [14.75, 11],
		DOWN: [14, 11.75],
		LEFT: [14, 11],
	},
	letters: {
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
		UP: [14, 31],
		RIGHT: [14.5, 31],
		DOWN: [15, 31],
		LEFT: [15.5, 31],
	},
	artMap: {
		chip: {
			type: "state",

			normal: {
				type: "directional",
				duration: "steps",
				UP: frange([0, 22], [7, 22]),
				RIGHT: frange([8, 22], [15, 22]),
				DOWN: frange([0, 23], [7, 23]),
				LEFT: frange([8, 23], [15, 23]),
			},
			water: {
				type: "directional",
				duration: "steps",
				UP: [
					[0, 24],
					[1, 24],
				],
				RIGHT: [
					[2, 24],
					[3, 24],
				],
				DOWN: [
					[4, 24],
					[5, 24],
				],
				LEFT: [
					[6, 24],
					[7, 24],
				],
			},
			bump: {
				type: "directic",
				UP: [8, 24],
				RIGHT: [9, 24],
				DOWN: [10, 24],
				LEFT: [11, 24],
			},
		},
		melinda: {
			type: "state",
			normal: {
				type: "directional",
				duration: "steps",
				UP: frange([0, 27], [7, 27]),
				RIGHT: frange([8, 27], [15, 27]),
				DOWN: frange([0, 28], [7, 28]),
				LEFT: frange([8, 28], [15, 28]),
			},
			water: {
				type: "directional",
				duration: "steps",
				UP: [
					[0, 29],
					[1, 29],
				],
				RIGHT: [
					[2, 29],
					[3, 29],
				],
				DOWN: [
					[4, 29],
					[5, 29],
				],
				LEFT: [
					[6, 29],
					[7, 29],
				],
			},
			bump: {
				type: "directic",
				UP: [8, 29],
				RIGHT: [9, 29],
				DOWN: [10, 29],
				LEFT: [11, 29],
			},
		},
		fire: {
			type: "animated",
			duration: 20,
			frames: frange([12, 29], [15, 29]),
		},
		keyRed: [4, 1],
		keyBlue: [5, 1],
		keyYellow: [6, 1],
		keyGreen: [7, 1],

		blueWall: {
			type: "state",
			real: [0, 10],
			fake: {
				type: "special",
				specialType: "perspective",
				default: [0, 10],
				revealed: [10, 31],
			},
		},
		invisibleWall: {
			type: "special",
			specialType: "perspective",
			default: { type: "state", default: [0, 2], touched: [1, 2] },
			revealed: [9, 31],
		},
		appearingWall: {
			type: "special",
			specialType: "perspective",
			default: [0, 2],
			revealed: [11, 31],
		},
		doorRed: [0, 1],
		doorBlue: [1, 1],
		doorYellow: [2, 1],
		doorGreen: [3, 1],

		dirtBlock: {
			type: "special",
			specialType: "perspective",
			somethingUnderneathOnly: true,
			default: [8, 1],
			revealed: [9, 1],
		},
		ice: [10, 1],
		iceCorner: {
			type: "directic",
			UP: [13, 1],
			RIGHT: [11, 1],
			DOWN: [12, 1],
			LEFT: [14, 1],
		},
		cloneMachine: {
			type: "overlay",
			bottom: [15, 1],
			top: {
				type: "special",
				specialType: "arrows",
				UP: [8, 31],
				RIGHT: [8.75, 31],
				DOWN: [8, 31.75],
				LEFT: [8, 31],
				CENTER: [8.25, 31.25],
			},
		},
		letterTile: {
			type: "overlay",
			bottom: [2, 2],
			top: { type: "special", specialType: "letters" },
		},
		wall: [1, 2],
		thiefTool: [3, 2],
		thiefKey: [15, 21],
		echipGate: [4, 2],
		hint: [5, 2],
		bomb: {
			type: "overlay",
			bottom: [5, 4],
			top: {
				type: "special",
				specialType: "fuse",
				duration: 16,
				frames: [
					[7, 4],
					[7.5, 4],
					[7, 4.5],
					[7.5, 4.5],
				],
			},
		},
		greenBomb: {
			type: "state",
			bomb: {
				type: "overlay",
				bottom: [6, 4],
				top: {
					type: "special",
					specialType: "fuse",
					duration: 16,
					frames: [
						[7, 4],
						[7.5, 4],
						[7, 4.5],
						[7.5, 4.5],
					],
				},
			},
			echip: [9, 3],
		},
		exit: { type: "animated", duration: 16, frames: frange([6, 2], [9, 2]) },
		iceBlock: {
			type: "special",
			specialType: "perspective",
			somethingUnderneathOnly: true,
			default: [10, 2],
			revealed: [11, 2],
		},
		bonusFlag: {
			type: "state",
			1000: [12, 2],
			100: [13, 2],
			10: [14, 2],
			"*2": [15, 2],
		},
		customFloor: {
			type: "state",
			green: [8, 4],
			pink: [9, 4],
			yellow: [10, 4],
			blue: [11, 4],
		},
		customWall: {
			type: "state",
			green: [12, 4],
			pink: [13, 4],
			yellow: [14, 4],
			blue: [15, 4],
		},
		echip: [11, 3],
		echipPlus: [11, 3],
		tnt: [0, 4],
		tntLit: {
			type: "state",
			0: [0, 4],
			1: [1, 4],
			2: [2, 4],
			3: [3, 4],
			4: [4, 4],
		},
		explosionAnim: {
			type: "animated",
			duration: 16,
			frames: frange([0, 5], [3, 5]),
		},
		splashAnim: {
			type: "animated",
			duration: 16,
			frames: frange([4, 5], [7, 5]),
		},
		flameJet: {
			type: "state",
			off: [8, 5],
			on: { type: "animated", duration: 12, frames: frange([9, 5], [11, 5]) },
		},
		ant: {
			type: "directional",
			duration: "steps",
			UP: frange([0, 7], [3, 7]),
			RIGHT: frange([4, 7], [7, 7]),
			DOWN: frange([8, 7], [11, 7]),
			LEFT: frange([12, 7], [15, 7]),
		},
		centipede: {
			type: "directional",
			duration: "steps",
			UP: frange([0, 12], [2, 12]),
			RIGHT: frange([3, 12], [5, 12]),
			DOWN: frange([6, 12], [8, 12]),
			LEFT: frange([9, 12], [11, 12]),
		},
		foil: [12, 12],
		turtle: {
			type: "overlay",
			bottom: {
				type: "animated",
				duration: 20,
				frames: frange([12, 24], [15, 24]),
			},
			top: {
				type: "animated",
				duration: 256,
				randomizedFrame: true,
				frames: frange([13, 12], [15, 12]),
			},
		},
		glider: {
			type: "directional",
			duration: 8,
			UP: [
				[8, 8],
				[9, 8],
			],
			RIGHT: [
				[10, 8],
				[11, 8],
			],
			DOWN: [
				[12, 8],
				[13, 8],
			],
			LEFT: [
				[14, 8],
				[15, 8],
			],
		},
		fireball: {
			type: "animated",
			duration: 4,
			frames: frange([12, 9], [15, 9]),
		},
		steelWall: {
			type: "special",
			specialType: "freeform wires",
			base: [15, 10],
			overlap: [9, 26],
			overlapCross: [11, 26],
		},
		teethBlue: {
			type: "directional",
			duration: "steps",
			baseFrame: 1,
			UP: [
				[1, 17],
				[0, 17],
			],
			RIGHT: [
				[3, 17],
				[2, 17],
			],
			DOWN: [
				[1, 17],
				[0, 17],
			],
			LEFT: [
				[5, 17],
				[4, 17],
			],
		},
		bowlingBall: [6, 17],
		bowlingBallRolling: {
			type: "animated",
			duration: "steps",
			frames: [
				[6, 17],
				[6, 17],
				[7, 17],
				[7, 17],
			],
		},
		forceFloor: {
			type: "special",
			specialType: "scrolling",
			duration: 24,
			UP: [
				[0, 19],
				[0, 20],
			],
			DOWN: [
				[1, 20],
				[1, 19],
			],
			RIGHT: [
				[3, 19],
				[2, 19],
			],
			LEFT: [
				[2, 20],
				[3, 20],
			],
		},
		forceFloorRandom: {
			type: "animated",
			// Unaligned with CC2, but come on
			duration: 24,
			frames: frange([0, 21], [7, 21]),
		},
		dirt: [4, 31],
		popupWall: [8, 10],
		gravel: [9, 10],
		ball: {
			type: "animated",
			duration: "steps",
			baseFrame: 2,
			frames: [
				[10, 10],
				[11, 10],
				[12, 10],
				[13, 10],
				[14, 10],
				[13, 10],
				[12, 10],
				[11, 10],
			],
		},
		transmogrifier: {
			type: "state",
			on: {
				type: "animated",
				duration: 16,
				frames: frange([12, 19], [15, 19]),
			},
			off: [12, 19],
		},
		water: {
			type: "animated",
			duration: 20,
			frames: frange([12, 24], [15, 24]),
		},
		thinWall: {
			type: "overlay",
			bottom: {
				type: "special",
				specialType: "thin walls",
				UP: [1, 10],
				DOWN: [1, 10.5],
				LEFT: [2, 10],
				RIGHT: [2.5, 10],
			},
			top: {
				type: "state",
				canopy: {
					type: "special",
					specialType: "perspective",
					default: [14, 3],
					revealed: [15, 3],
				},
				nothing: null,
			},
		},
		teleportBlue: {
			type: "wires",
			top: {
				type: "animated",
				duration: 16,
				frames: frange([4, 10], [7, 10]),
			},
		},
		teleportRed: {
			type: "wires",
			top: {
				type: "state",
				on: {
					type: "animated",
					duration: 16,
					frames: frange([4, 20], [7, 20]),
				},
				off: [4, 20],
			},
		},
		teleportGreen: {
			type: "animated",
			duration: 16,
			frames: frange([4, 19], [7, 19]),
		},
		teleportYellow: {
			type: "animated",
			duration: 16,
			frames: frange([8, 19], [11, 19]),
		},
		tankYellow: {
			type: "directional",
			duration: 32,
			UP: [
				[8, 17],
				[9, 17],
			],
			RIGHT: [
				[10, 17],
				[11, 17],
			],
			DOWN: [
				[12, 17],
				[13, 17],
			],
			LEFT: [
				[14, 17],
				[15, 17],
			],
		},
		secretEye: [11, 18],
		slime: {
			type: "animated",
			duration: 60,
			frames: frange([8, 20], [15, 20]),
		},

		bootWater: [0, 6],
		bootFire: [1, 6],
		bootIce: [2, 6],
		bootForceFloor: [3, 6],
		bootDirt: [4, 6],
		bootSpeed: [13, 3],

		bribe: [12, 3],
		lightningBolt: [5, 6],
		toggleWall: {
			type: "overlay",
			bottom: {
				type: "animated",
				duration: 16,
				frames: frange([0, 9], [3, 9]),
			},
			top: { type: "state", off: null, on: [8, 9] },
		},
		holdWall: {
			type: "overlay",
			bottom: {
				type: "animated",
				duration: 16,
				frames: frange([4, 9], [7, 9]),
			},
			top: { type: "state", off: null, on: [8, 9] },
		},
		trap: { type: "state", closed: [9, 9], open: [10, 9] },
		mirrorChip: {
			type: "overlay",
			bottom: [7, 6],
			top: {
				type: "directional",
				duration: "steps",
				UP: frange([0, 22], [7, 22]),
				RIGHT: frange([8, 22], [15, 22]),
				DOWN: frange([0, 23], [7, 23]),
				LEFT: frange([8, 23], [15, 23]),
			},
		},
		mirrorMelinda: {
			type: "overlay",
			bottom: [7, 6],
			top: {
				type: "directional",
				duration: "steps",
				UP: frange([0, 27], [7, 27]),
				RIGHT: frange([8, 27], [15, 27]),
				DOWN: frange([0, 28], [7, 28]),
				LEFT: frange([8, 28], [15, 28]),
			},
		},
		buttonBlue: [8, 6],
		buttonGreen: [9, 6],
		buttonRed: [10, 6],
		buttonBrown: [11, 6],
		buttonPurple: { type: "wires", top: [12, 6] },
		buttonBlack: { type: "wires", top: [13, 6] },
		buttonOrange: [14, 6],
		complexButtonYellow: [15, 6],
		buttonGray: [11, 9],

		teethRed: {
			type: "directional",
			duration: "steps",
			baseFrame: 1,
			UP: [
				[0, 11],
				[1, 11],
				[2, 11],
				[1, 11],
			],
			RIGHT: [
				[3, 11],
				[4, 11],
				[5, 11],
				[4, 11],
			],
			DOWN: [
				[0, 11],
				[1, 11],
				[2, 11],
				[1, 11],
			],
			LEFT: [
				[6, 11],
				[7, 11],
				[8, 11],
				[7, 11],
			],
		},
		swivel: {
			type: "overlay",
			bottom: [13, 11],
			top: {
				type: "directic",
				UP: [11, 11],
				RIGHT: [12, 11],
				DOWN: [9, 11],
				LEFT: [10, 11],
			},
		},
		tankBlue: {
			type: "directional",
			duration: 32,
			UP: [
				[0, 8],
				[1, 8],
			],
			RIGHT: [
				[2, 8],
				[3, 8],
			],
			DOWN: [
				[4, 8],
				[5, 8],
			],
			LEFT: [
				[6, 8],
				[7, 8],
			],
		},
		walker: {
			type: "special",
			specialType: "stretch",
			idle: [0, 13],
			vertical: frange([1, 13], [7, 13]),
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
			type: "special",
			specialType: "stretch",
			idle: [0, 15],
			vertical: frange([1, 15], [7, 15]),
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
		floorMimic: {
			type: "special",
			specialType: "perspective",
			default: [0, 2],
			revealed: [14, 16],
		},
		greenWall: {
			type: "state",
			real: [12, 5],
			stepped: [13, 5],
			fake: {
				type: "special",
				specialType: "perspective",
				default: [12, 5],
				revealed: [13, 5],
			},
		},
		noSign: [14, 5],
		directionalBlock: {
			type: "overlay",
			bottom: [15, 5],
			top: {
				type: "special",
				specialType: "arrows",
				UP: [3, 10],
				RIGHT: [3.75, 10],
				DOWN: [3, 10.75],
				LEFT: [3, 10],
				CENTER: [3.25, 10.25],
			},
		},

		voodooTile: { type: "special", specialType: "voodoo" },
		noMelindaSign: [5, 31],
		noChipSign: [6, 31],
		hook: [7, 31],
		railroad: {
			type: "overlay",
			bottom: [9, 10],
			top: {
				type: "special",
				specialType: "railroad",
				wood: {
					UR: [0, 30],
					DR: [1, 30],
					DL: [2, 30],
					UL: [3, 30],
					LR: [4, 30],
					UD: [5, 30],
				},
				rail: {
					UR: [13, 30],
					DR: [14, 30],
					DL: [15, 30],
					UL: [0, 31],
					LR: [1, 31],
					UD: [2, 31],
				},
				toggleRail: {
					UR: [7, 30],
					DR: [8, 30],
					DL: [9, 30],
					UL: [10, 30],
					LR: [11, 30],
					UD: [12, 30],
				},
				toggleMark: [6, 30],
			},
		},
		railroadSign: [3, 31],
		rover: {
			type: "overlay",
			bottom: {
				type: "state",
				teethRed: {
					type: "animated",
					duration: 16,
					frames: [
						[0, 18],
						[8, 18],
					],
				},
				teethBlue: {
					type: "animated",
					duration: 15,
					frames: [
						[0, 18],
						[9, 18],
					],
				},
				ball: {
					type: "animated",
					duration: 16,
					frames: [
						[0, 18],
						[4, 18],
					],
				},
				walker: {
					type: "animated",
					duration: 16,
					frames: [
						[8, 18],
						[9, 18],
					],
				},
				glider: {
					type: "animated",
					duration: 32,
					frames: frange([0, 18], [7, 18]),
				},
				centipede: {
					type: "animated",
					duration: 16,
					frames: frange([0, 18], [7, 18]),
				},
				fireball: {
					type: "animated",
					duration: 32,
					frames: frange([7, 18], [0, 18]),
				},
				ant: {
					type: "animated",
					duration: 16,
					frames: frange([7, 18], [0, 18]),
				},
			},
			top: {
				type: "special",
				specialType: "rover antenna",
				UP: [10, 18],
				RIGHT: [10.5, 18],
				LEFT: [10, 18.5],
				DOWN: [10.5, 18.5],
			},
		},
		ghost: {
			type: "directic",
			UP: [12, 18],
			RIGHT: [13, 18],
			DOWN: [14, 18],
			LEFT: [15, 18],
		},
		toggleSwitch: {
			type: "wires",
			base: [14, 21],
			top: { type: "state", off: [12, 21], on: [13, 21] },
		},
		timePenalty: [15, 11],
		timeBonus: [15, 14],
		timeToggle: [14, 14],
		counterGate: {
			type: "overlay",
			bottom: { type: "wires", top: [14, 26] },
			top: {
				type: "special",
				specialType: "counter",
				0: [0, 3],
				1: [0.75, 3],
				2: [1.5, 3],
				3: [2.25, 3],
				4: [3, 3],
				5: [3.75, 3],
				6: [4.5, 3],
				7: [5.25, 3],
				8: [6, 3],
				9: [6.75, 3],
				"-": [7.5, 3],
				"": [8.25, 3],
			},
		},
		notGate: {
			type: "special",
			specialType: "logic gate",
			UP: [0, 25],
			RIGHT: [1, 25],
			DOWN: [2, 25],
			LEFT: [3, 25],
		},
		andGate: {
			type: "special",
			specialType: "logic gate",
			UP: [4, 25],
			RIGHT: [5, 25],
			DOWN: [6, 25],
			LEFT: [7, 25],
		},
		orGate: {
			type: "special",
			specialType: "logic gate",
			UP: [8, 25],
			RIGHT: [9, 25],
			DOWN: [10, 25],
			LEFT: [11, 25],
		},
		xorGate: {
			type: "special",
			specialType: "logic gate",
			UP: [12, 25],
			RIGHT: [13, 25],
			DOWN: [14, 25],
			LEFT: [15, 25],
		},
		latchGate: {
			type: "special",
			specialType: "logic gate",
			UP: [0, 26],
			RIGHT: [1, 26],
			DOWN: [2, 26],
			LEFT: [3, 26],
		},
		latchGateMirror: {
			type: "special",
			specialType: "logic gate",
			UP: [8, 21],
			RIGHT: [9, 21],
			DOWN: [10, 21],
			LEFT: [11, 21],
		},
		nandGate: {
			type: "special",
			specialType: "logic gate",
			UP: [4, 26],
			RIGHT: [5, 26],
			DOWN: [6, 26],
			LEFT: [7, 26],
		},
	},
}
