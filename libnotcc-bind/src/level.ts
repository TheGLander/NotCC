import { Actor, Direction } from "./actor.js"
import { Cell } from "./cell.js"
import { InputProvider, KeyInputs } from "./index.js"
import { getModuleInstance, wasmFuncs } from "./module.js"
import { getStringAt, getWasmReader, Struct } from "./struct.js"
export class PlayerSeat extends Struct {
	get actor() {
		const ptr = wasmFuncs.PlayerSeat_get_actor(this._ptr)
		if (ptr === 0) return null
		return new Actor(ptr)
	}
	get inputs(): KeyInputs {
		return wasmFuncs.PlayerSeat_get_inputs(this._ptr)
	}
	set inputs(val: KeyInputs) {
		wasmFuncs.PlayerSeat_set_inputs(this._ptr, val)
	}
	get releasedInputs(): KeyInputs {
		return wasmFuncs.PlayerSeat_get_released_inputs(this._ptr)
	}
	set releasedInputs(val: KeyInputs) {
		wasmFuncs.PlayerSeat_set_released_inputs(this._ptr, val)
	}
}
export class LevelMetadata extends Struct {
	get title() {
		return getStringAt(wasmFuncs.LevelMetadata_get_title(this._ptr))
	}
	get author() {
		return getStringAt(wasmFuncs.LevelMetadata_get_author(this._ptr))
	}
	get defaultHint() {
		return getStringAt(wasmFuncs.LevelMetadata_get_default_hint(this._ptr))
	}
	get cameraWidth(): number {
		return wasmFuncs.LevelMetadata_get_camera_width(this._ptr)
	}
	get cameraHeight(): number {
		return wasmFuncs.LevelMetadata_get_camera_height(this._ptr)
	}
	get cc1Boots(): boolean {
		return !!wasmFuncs.LevelMetadata_get_cc1_boots(this._ptr)
	}
	set cc1Boots(val: boolean) {
		wasmFuncs.LevelMetadata_set_cc1_boots(this._ptr, val)
	}
}

export class Replay extends Struct {
	get randomForceFloorDirection(): number {
		return wasmFuncs.Replay_get_rff_direction(this._ptr)
	}
	set randomForceFloorDirection(val: number) {
		wasmFuncs.Replay_set_rff_direction(this._ptr, val)
	}
	get rngBlob(): number {
		return wasmFuncs.Replay_get_rng_blob(this._ptr)
	}
	set rngBlob(val: number) {
		wasmFuncs.Replay_set_rng_blob(this._ptr, val)
	}
	get replayLength(): number {
		return wasmFuncs.Replay_get_replay_length(this._ptr)
	}
	getInputAt(tick: number): KeyInputs {
		return getWasmReader().getUint8(
			wasmFuncs.Replay_get_inputs(this._ptr) + tick
		)
	}
}

export enum HashSettings {
	IGNORE_BLOCK_ORDER = 1 << 0,
	IGNORE_PLAYER_DIRECTION = 1 << 1,
	// TODO: IGNORE_PLAYER_BUMP = 1 << 2,
	IGNORE_MIMIC_PARITY = 1 << 3,
	IGNORE_TEETH_PARITY = 1 << 4,
}

export class Level extends Struct {
	static unalloc(ptr: number) {
		wasmFuncs.Level_uninit(ptr)
	}
	// Basic
	get width(): number {
		return wasmFuncs.Level_get_width(this._ptr)
	}
	get height(): number {
		return wasmFuncs.Level_get_height(this._ptr)
	}
	get currentTick(): number {
		return wasmFuncs.Level_get_current_tick(this._ptr)
	}
	get currentSubtick(): number {
		return wasmFuncs.Level_get_current_subtick(this._ptr)
	}
	get gameState(): GameState {
		return wasmFuncs.Level_get_game_state(this._ptr)
	}
	get metadata(): LevelMetadata {
		return new LevelMetadata(wasmFuncs.Level_get_metadata_ptr(this._ptr))
	}
	get builtinReplay() {
		const ptr = wasmFuncs.Level_get_builtin_replay(this._ptr)
		if (ptr === 0) return null
		return new Replay(ptr)
	}
	setProviderInputs(ip: InputProvider) {
		const seats = this.playerSeats
		for (let idx = 0; idx < seats.length; idx += 1) {
			seats[idx].inputs = ip.getInput(this, idx)
		}
	}
	tick() {
		wasmFuncs.Level_tick(this._ptr)
	}
	getCell(x: number, y: number): Cell {
		const cell = new Cell(wasmFuncs.Level_get_cell_xy(this._ptr, x, y))
		return cell
	}
	// Player
	get playerSeats(): PlayerSeat[] {
		const len = wasmFuncs.Level_get_players_n(this._ptr)
		const arr = []
		for (let idx = 0; idx < len; idx += 1) {
			arr.push(
				new PlayerSeat(wasmFuncs.Level_get_player_seat_n(this._ptr, idx))
			)
		}
		return arr
	}
	// Metrics
	get timeLeft(): number {
		return wasmFuncs.Level_get_time_left(this._ptr)
	}
	set timeLeft(val: number) {
		wasmFuncs.Level_set_time_left(this._ptr, val)
	}
	get timeStopped() {
		return !!wasmFuncs.Level_get_time_stopped(this._ptr)
	}
	get chipsLeft(): number {
		return wasmFuncs.Level_get_chips_left(this._ptr)
	}
	get bonusPoints() {
		return wasmFuncs.Level_get_bonus_points(this._ptr)
	}
	// Rng
	get rng1(): number {
		return wasmFuncs.Level_get_rng1(this._ptr)
	}
	get rng2(): number {
		return wasmFuncs.Level_get_rng2(this._ptr)
	}
	get rngBlob(): number {
		return wasmFuncs.Level_get_rng_blob(this._ptr)
	}
	set rngBlob(val: number) {
		wasmFuncs.Level_set_rng_blob(this._ptr, val)
	}
	// Global state
	get randomForceFloorDirection(): Direction {
		return wasmFuncs.Level_get_rff_direction(this._ptr)
	}
	set randomForceFloorDirection(val: Direction) {
		wasmFuncs.Level_set_rff_direction(this._ptr, val)
	}
	clone() {
		return new Level(wasmFuncs.Level_clone(this._ptr))
	}
	getHint() {
		return null
	}
	subticksPassed() {
		return this.currentTick * 3 + this.currentSubtick
	}
	msecsPassed() {
		return this.subticksPassed() * (1000 / 60)
	}
	hash(settings: HashSettings) {
		return wasmFuncs.Level_hash(this._ptr, settings)
	}
}

export enum GameState {
	PLAYING,
	DEATH,
	TIMEOUT,
	WON,
}

export class CResult extends Struct {
	static alloc() {
		const res = this.allocStruct<CResult>(8)
		return res
	}
	static unalloc(ptr: number): void {
		if (!getWasmReader().getInt32(ptr)) {
			wasmFuncs.free(ptr + 4)
		}
	}
	get success() {
		return this.getBool(0)
	}
	get error() {
		if (this.success) return null
		return getStringAt(this.getPtr(4))
	}
	get value() {
		if (!this.success) return null
		return this.getPtr(4)
	}
}
function copyBuffer(buff: ArrayBuffer) {
	const dataPtr = wasmFuncs.malloc(buff.byteLength)
	if (dataPtr === 0) throw new Error("Failed to malloc ")
	const memBuf = new Uint8Array(getWasmReader().buffer)
	memBuf.set(new Uint8Array(buff), dataPtr)
	return dataPtr
}
export function parseC2M(buff: ArrayBuffer) {
	const dataPtr = copyBuffer(buff)
	const levelRes = CResult.alloc()
	wasmFuncs.parse_c2m(levelRes._ptr, dataPtr, buff.byteLength)
	wasmFuncs.free(dataPtr)
	const err = levelRes.error
	const valPtr = levelRes.value
	levelRes.free()
	if (err) throw new Error(err)
	return new Level(valPtr!)
}
export function parseC2MMeta(buff: ArrayBuffer) {
	const dataPtr = copyBuffer(buff)
	const levelRes = CResult.alloc()
	wasmFuncs.parse_c2m_meta(levelRes._ptr, dataPtr, buff.byteLength)
	wasmFuncs.free(dataPtr)
	const err = levelRes.error
	const valPtr = levelRes.value
	levelRes.free()
	if (err) throw new Error(err)
	return new LevelMetadata(valPtr!)
}
