import { PulseManager } from "./pulse"
import { LevelSetData, LevelData } from "./encoder"
import { createLevelFromData } from "./level"
// TODO C2G Scripting

export class SetPlayer {
	ready: Promise<void>
	currentLevelIndex = 0
	sortedLevels: [number, LevelData][] = []

	constructor(
		public pulseManager: PulseManager,
		public levelSet: LevelSetData
	) {
		this.ready = pulseManager.ready
		pulseManager.eventsRegistered.lose.push(() => this.restartLevel())
		pulseManager.eventsRegistered.win.push(() => this.advanceLevel())
		this.setNewLevelSet(levelSet)
	}
	restartLevel(): Promise<void> {
		if (this.sortedLevels[this.currentLevelIndex])
			return this.pulseManager.setNewLevel(
				createLevelFromData(this.sortedLevels[this.currentLevelIndex][1])
			)
		else return Promise.resolve()
	}
	setNewLevelSet(levelSet: LevelSetData): Promise<void> {
		this.levelSet = levelSet
		this.currentLevelIndex = 0
		this.sortedLevels = Object.entries(this.levelSet.levels)
			.sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
			.map(val => [parseInt(val[0]), val[1]])
		return this.restartLevel()
	}
	advanceLevel(): Promise<void> {
		this.currentLevelIndex++
		if (!this.sortedLevels[this.currentLevelIndex]) {
			alert("You completed the set, yay!")
			this.currentLevelIndex = 0
		}
		return this.restartLevel()
	}
}
