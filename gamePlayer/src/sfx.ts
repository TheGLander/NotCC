import {
	LevelSetLoaderFunction,
	SFX_BITS_CONTINUOUS,
	SfxBit,
} from "@notcc/logic"
export const SFX_FILENAME_MAP = {
	[SfxBit.RECESSED_WALL]: "newwall",
	[SfxBit.EXPLOSION]: "burn",
	[SfxBit.SPLASH]: "splash",
	[SfxBit.TELEPORT]: "teleport",
	[SfxBit.THIEF]: "thief",
	[SfxBit.DIRT_CLEAR]: "dirt",
	[SfxBit.BUTTON_PRESS]: "button",
	[SfxBit.BLOCK_PUSH]: "push",
	[SfxBit.FORCE_FLOOR_SLIDE]: "force",
	[SfxBit.PLAYER_BONK]: "wall",
	[SfxBit.WATER_STEP]: "water",
	[SfxBit.SLIDE_STEP]: "ice",
	[SfxBit.ICE_SLIDE]: "slide",
	[SfxBit.FIRE_STEP]: "fire",
	[SfxBit.ITEM_PICKUP]: "get",
	[SfxBit.SOCKET_UNLOCK]: "socket",
	[SfxBit.DOOR_UNLOCK]: "door",
	[SfxBit.CHIP_WIN]: "teleport-male",
	[SfxBit.MELINDA_WIN]: "teleport-female",
	[SfxBit.CHIP_DEATH]: "BummerM",
	[SfxBit.MELINDA_DEATH]: "BummerF",
}

async function tryGetSfxFile(
	loader: LevelSetLoaderFunction,
	sfxName: string
): Promise<ArrayBuffer | null> {
	for (const ext of ["ogg", "wav", "WAV"]) {
		try {
			return (await loader(`${sfxName}.${ext}`, true)) as ArrayBuffer
		} catch {
			continue
		}
	}
	return null
}

export class AudioSfxManager {
	ctx = new AudioContext()
	audioBuffers: Partial<Record<SfxBit, AudioBuffer>> = {}
	playingNodes: Partial<Record<SfxBit, AudioBufferSourceNode>> = {}
	async loadSfx(loader: LevelSetLoaderFunction): Promise<void> {
		this.stopAllSfx()
		this.audioBuffers = {}
		let anySfxLoaded = false
		for (const [internalName, fileName] of Object.entries(SFX_FILENAME_MAP)) {
			const buffer = await tryGetSfxFile(loader, fileName)
			if (!buffer) continue
			const audioBuffer = await this.ctx.decodeAudioData(buffer)
			this.audioBuffers[parseInt(internalName) as SfxBit] = audioBuffer
			anySfxLoaded = true
		}
		if (!anySfxLoaded) {
			throw new Error("Couldn't load any sfx")
		}
	}
	getSfxNode(sfx: SfxBit): AudioBufferSourceNode | null {
		const audioBuffer = this.audioBuffers[sfx]
		if (audioBuffer === undefined) {
			return null
		}
		const node = new AudioBufferSourceNode(this.ctx)
		node.buffer = audioBuffer
		node.connect(this.ctx.destination)
		this.playingNodes[sfx] = node
		return node
	}
	stopSfx(sfx: SfxBit): void {
		const node = this.playingNodes[sfx]
		if (node === undefined) return
		node.stop()
		node.disconnect()
		delete this.playingNodes[sfx]
	}
	playOnce(sfx: SfxBit): void {
		this.stopSfx(sfx)
		const node = this.getSfxNode(sfx)
		if (node === null) return
		node.addEventListener("ended", () => {
			if (this.playingNodes[sfx] === node) {
				delete this.playingNodes[sfx]
			}
		})
		node.start()
	}
	playContinuous(sfx: SfxBit): void {
		if (this.playingNodes[sfx] !== undefined) return
		const node = this.getSfxNode(sfx)
		if (node === null) return
		node.loop = true
		node.start()
	}
	isSfxPlaying(sfx: SfxBit): boolean {
		return sfx in this.playingNodes
	}
	stopAllSfx() {
		for (const node of Object.values(this.playingNodes)) {
			node.stop()
			node.disconnect()
		}
		this.playingNodes = {}
	}
	processSfxField(field: number): void {
		for (let bit = SfxBit.FIRST; bit <= SfxBit.LAST; bit <<= 1) {
			const runSfx = bit & field
			const isContinuous = bit & SFX_BITS_CONTINUOUS
			if (!isContinuous) {
				if (runSfx) this.playOnce(bit)
			} else {
				const wasRunning = this.isSfxPlaying(bit)
				if (wasRunning && !runSfx) this.stopSfx(bit)
				else if (!wasRunning && runSfx) this.playContinuous(bit)
			}
		}
	}
	pause() {
		return this.ctx.suspend()
	}
	unpause() {
		return this.ctx.resume()
	}
}
