import { LevelState } from "@notcc/logic"

export function makeLevelHash(level: LevelState): number {
	// TODO
	return (
		level.selectedPlayable!.tile.y +
		level.selectedPlayable!.tile.x * 100 +
		level.selectedPlayable!.direction * 10000 +
		level.selectedPlayable!.cooldown * 40000 +
		1000000
	)
}
