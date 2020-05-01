import { lcm } from "mathjs"
interface Config {
	ticksPerSecond: number
	framesPerSecond: number
	pulsesPerSecond?: number
	tickPulseModulo?: number
	framePulseModulo?: number
	debugMode: boolean
}
let config: Config = {
	ticksPerSecond: 20,
	framesPerSecond: 60,
	debugMode: location.href.includes("localhost"),
}
export function calculatePulses() {
	config.pulsesPerSecond = lcm(config.ticksPerSecond, config.framesPerSecond)
	config.tickPulseModulo = config.pulsesPerSecond / config.ticksPerSecond
	config.framePulseModulo = config.pulsesPerSecond / config.framesPerSecond
}

calculatePulses()
export default config
