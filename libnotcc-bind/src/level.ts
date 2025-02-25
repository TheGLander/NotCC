import { Actor, Direction } from "./actor.js"
import { Cell } from "./cell.js"
import { InputProvider, Inventory, KeyInputs, msToProtoTime } from "./index.js"
import { getModuleInstance, wasmFuncs } from "./module.js"
import { GlitchInfo, IGlitchInfo } from "./nonbind/nccs.pb.js"
import {
	CVector,
	getStringAt,
	getWasmReader,
	makeAccessorClassObj,
	Struct,
} from "./struct.js"
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
	get displayedHint() {
		return getStringAt(wasmFuncs.PlayerSeat_get_displayed_hint(this._ptr))
	}
	hasPerspective(): boolean {
		return !!wasmFuncs.PlayerSeat_has_perspective(this._ptr)
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
	get wiresHidden(): boolean {
		return !!wasmFuncs.LevelMetadata_get_wires_hidden(this._ptr)
	}
	set wiresHidden(val: boolean) {
		wasmFuncs.LevelMetadata_set_wires_hidden(this._ptr, val)
	}
	get c2gCommand() {
		return getStringAt(wasmFuncs.LevelMetadata_get_c2g_command(this._ptr))
	}
	get rngBlob4Pat() {
		return !!wasmFuncs.LevelMetadata_get_rng_blob_4pat(this._ptr)
	}
	get rngBlobDeterministic() {
		return !!wasmFuncs.LevelMetadata_get_rng_blob_deterministic(this._ptr)
	}
}

export class VectorUint8 extends CVector<number> {
	getItemSize(): number {
		return 1
	}
	instantiateItem(ptr: number): number {
		return getWasmReader().getUint8(ptr)
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
	get inputs(): VectorUint8 {
		return new VectorUint8(wasmFuncs.Replay_get_inputs_ptr(this._ptr))
	}
}

export enum HashSettings {
	IGNORE_BLOCK_ORDER = 1 << 0,
	IGNORE_PLAYER_DIRECTION = 1 << 1,
	// TODO: IGNORE_PLAYER_BUMP = 1 << 2,
	IGNORE_MIMIC_PARITY = 1 << 3,
	IGNORE_TEETH_PARITY = 1 << 4,
}

export class VectorPlayerSeat extends CVector<PlayerSeat> {
	getItemSize(): number {
		return wasmFuncs._libnotcc_bind_PlayerSeat_size()
	}
	instantiateItem(ptr: number): PlayerSeat {
		return new PlayerSeat(ptr)
	}
}

export class Glitch extends Struct {
	get glitchKind(): GlitchInfo.KnownGlitches {
		return wasmFuncs.Glitch_get_glitch_kind(this._ptr)
	}
	get location(): [number, number] {
		const loc: number = wasmFuncs.Glitch_get_location_xy(this._ptr)
		return [loc & 0xff, loc >> 8]
	}
	get specifier(): number {
		return wasmFuncs.Glitch_get_specifier(this._ptr)
	}
	get happensAt(): bigint {
		return wasmFuncs.Glitch_get_happens_at(this._ptr)
	}
	isCrashing(): boolean {
		return !!wasmFuncs.Glitch_is_crashing(this._ptr)
	}
	toGlitchInfo(): IGlitchInfo {
		const pos = this.location
		return {
			glitchKind: this.glitchKind,
			location: { x: pos[0], y: pos[1] },
			happensAt: msToProtoTime(Number((this.happensAt * 1000n) / 60n)),
			specifier: this.specifier,
		}
	}
}

export class VectorGlitch extends CVector<Glitch> {
	getItemSize(): number {
		return wasmFuncs._libnotcc_bind_Glitch_size()
	}
	instantiateItem(ptr: number): Glitch {
		return new Glitch(ptr)
	}
}

export class ActorList {
	get length(): number {
		return this.level.actor_n
	}
	[idx: number]: Actor
	*[Symbol.iterator]() {
		const length = this.length
		for (let idx = 0; idx < length; idx += 1) {
			yield this[idx]
		}
	}
	getItem(idx: number): Actor {
		return new Actor(getWasmReader().getUint32(this.level.actors_ptr + idx * 4))
	}
	constructor(public level: Level) {
		return makeAccessorClassObj(this)
	}
	getItemSize(): number {
		return wasmFuncs._libnotcc_bind_Actor_size()
	}
	instantiateItem(ptr: number): Actor {
		return new Actor(ptr)
	}
}

export enum SfxBit {
	FIRST = 1,
	RECESSED_WALL = 1 << 0,
	EXPLOSION = 1 << 1,
	SPLASH = 1 << 2,
	TELEPORT = 1 << 3,
	THIEF = 1 << 4,
	DIRT_CLEAR = 1 << 5,
	BUTTON_PRESS = 1 << 6,
	BLOCK_PUSH = 1 << 7,
	FORCE_FLOOR_SLIDE = 1 << 8,
	PLAYER_BONK = 1 << 9,
	WATER_STEP = 1 << 10,
	SLIDE_STEP = 1 << 11,
	ICE_SLIDE = 1 << 12,
	FIRE_STEP = 1 << 13,
	ITEM_PICKUP = 1 << 14,
	SOCKET_UNLOCK = 1 << 15,
	DOOR_UNLOCK = 1 << 16,
	CHIP_WIN = 1 << 17,
	MELINDA_WIN = 1 << 18,
	CHIP_DEATH = 1 << 19,
	MELINDA_DEATH = 1 << 20,
	LAST = MELINDA_DEATH,
}

export const SFX_BITS_CONTINUOUS = SfxBit.FORCE_FLOOR_SLIDE | SfxBit.ICE_SLIDE

export class LastPlayerInfo extends Struct {
	get inventory() {
		return new Inventory(wasmFuncs.LastPlayerInfo_get_inventory_ptr(this._ptr))
	}
	get exitN(): number {
		return wasmFuncs.LastPlayerInfo_get_exit_n(this._ptr)
	}
	get isMale(): boolean {
		return wasmFuncs.LastPlayerInfo_get_is_male(this._ptr)
	}
}

export const DETERMINISTIC_BLOB_MOD = 0x55

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
	get actors_ptr(): number {
		return wasmFuncs.Level_get_actors(this._ptr)
	}
	get actor_n(): number {
		return wasmFuncs.Level_get_actors_n(this._ptr)
	}
	get actors(): ActorList {
		return new ActorList(this)
	}
	get lastWonPlayerInfo() {
		return new LastPlayerInfo(
			wasmFuncs.Level_get_last_won_player_info_ptr(this._ptr)
		)
	}
	get ignoreBonusFlags(): boolean {
		return !!wasmFuncs.Level_get_ignore_bonus_flags(this._ptr)
	}
	set ignoreBonusFlags(val: boolean) {
		wasmFuncs.Level_set_ignore_bonus_flags(this._ptr, val)
	}
	setProviderInputs(ip: InputProvider) {
		const seats = this.playerSeats
		for (let idx = 0; idx < seats.length; idx += 1) {
			seats[idx].inputs = ip.getInput(this.subticksPassed(), idx)
		}
	}
	tick() {
		wasmFuncs.Level_tick(this._ptr)
	}
	getCell(x: number, y: number): Cell {
		const cell = new Cell(wasmFuncs.Level_get_cell_xy(this._ptr, x, y))
		return cell
	}
	get glitches(): VectorGlitch {
		return new VectorGlitch(wasmFuncs.Level_get_glitches_ptr(this._ptr))
	}
	// Player
	get playerSeats(): VectorPlayerSeat {
		return new VectorPlayerSeat(wasmFuncs.Level_get_player_seats_ptr(this._ptr))
	}
	get playersLeft(): number {
		return wasmFuncs.Level_get_players_left(this._ptr)
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
	get toggleWallInverted(): boolean {
		return !!wasmFuncs.Level_get_toggle_wall_inverted(this._ptr)
	}
	set toggleWallInverted(val: boolean) {
		wasmFuncs.Level_set_toggle_wall_inverted(this._ptr, val)
	}
	clone() {
		return new Level(wasmFuncs.Level_clone(this._ptr))
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
	totalByteSize(): number {
		return wasmFuncs.Level_total_size(this._ptr)
	}
	get sfx(): number {
		return Number(wasmFuncs.Level_get_sfx(this._ptr))
	}
	erase(actor: Actor) {
		wasmFuncs.Actor_erase(actor._ptr, this._ptr)
	}
}

export enum GameState {
	PLAYING,
	DEATH,
	TIMEOUT,
	WON,
	CRASH,
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
