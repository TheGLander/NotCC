# NotCC logic

This package contains all the game logic for NotCC, a Chip's Challenge 2® emulator.

## Legal notice

Chip's Challenge is a registered trademark of Bridgestone Media Group LLC, used here for identification purposes only. Not affiliated with, sponsored, or endorsed by Bridgestone Media Group LLC.

## Example

```ts
// Verify a level's built-in solution

import { parseC2M, createLevelFromData, GameState } from "@notcc/logic"
import { readFileSync } from "fs"

const levelData = parseC2M(readFileSync("./funLevel.c2m").buffer)

const level = createLevelFromData(levelData)

level.playbackSolution(levelData.associatedSolution)

let bonusTicks = 60 * 60

while (level.gameState === GameState.PLAYING && bonusTicks > 0) {
	level.tick()
	if (level.solutionSubticksLeft === Infinity) {
		bonusTicks -= 1
	}
}

console.log(`Level built-in solution result: ${GameState[level.gameState]}`)
```
