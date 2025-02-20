#ifndef _libnotcc_logic_h
#define _libnotcc_logic_h
#include <stdint.h>
#include <stdlib.h>
#include "accessors/declare.h"
#include "misc.h"

typedef struct TileType TileType;
typedef struct ActorType ActorType;
typedef struct Level Level;
typedef struct LevelMetadata LevelMetadata;
typedef struct Cell Cell;
typedef struct Actor Actor;
typedef struct BasicTile BasicTile;
typedef struct Inventory Inventory;
typedef struct PlayerSeat PlayerSeat;
typedef struct Replay Replay;
typedef struct Glitch Glitch;

typedef enum Direction {
  DIRECTION_NONE = 0,
  DIRECTION_UP = 1,
  DIRECTION_RIGHT = 2,
  DIRECTION_DOWN = 3,
  DIRECTION_LEFT = 4
} Direction;

typedef struct Position {
  uint8_t x;
  uint8_t y;
} Position;
typedef struct PositionF {
  float x;
  float y;
} PositionF;
size_t Position_to_offset(Position pos, size_t pitch);
Position Position_from_offset(size_t offset, size_t pitch);

typedef enum SlidingState {
  SLIDING_NONE,
  SLIDING_WEAK,
  SLIDING_STRONG
} SlidingState;

typedef struct WireNetworkMember {
  Position pos;
  uint8_t wires;
} WireNetworkMember;

DECLARE_VECTOR(WireNetworkMember);
DECLARE_VECTOR(Position);

typedef struct WireNetwork {
  Vector_WireNetworkMember members;
  Vector_WireNetworkMember emitters;
  bool force_power_this_subtick;
} WireNetwork;

// 16 uint8_t's. C is kinda dumb here, you can return arbitrary structs but not
// arrays? Weird
typedef struct Uint8_16 {
  uint8_t val[16];
} Uint8_16;

typedef enum ItemIndex {
  ITEM_INDEX_FORCE_BOOTS = 1,
  ITEM_INDEX_ICE_BOOTS = 2,
  ITEM_INDEX_FIRE_BOOTS = 3,
  ITEM_INDEX_WATER_BOOTS = 4,
  ITEM_INDEX_DYNAMITE = 5,
  ITEM_INDEX_HELMET = 6,
  ITEM_INDEX_DIRT_BOOTS = 7,
  ITEM_INDEX_LIGHTNING_BOLT = 8,
  ITEM_INDEX_BOWLING_BALL = 9,
  ITEM_INDEX_YELLOW_TP = 10,
  ITEM_INDEX_RR_SIGN = 11,
  ITEM_INDEX_STEEL_FOIL = 12,
  ITEM_INDEX_SECRET_EYE = 13,
  ITEM_INDEX_BRIBE = 14,
  ITEM_INDEX_SPEED_BOOTS = 15,
  ITEM_INDEX_HOOK = 16
} ItemIndex;

#define _libnotcc_accessors_Inventory                    \
  _libnotcc_accessor(Inventory, counters, Uint8_16);     \
  _libnotcc_accessor(Inventory, item1, const TileType*); \
  _libnotcc_accessor(Inventory, item2, const TileType*); \
  _libnotcc_accessor(Inventory, item3, const TileType*); \
  _libnotcc_accessor(Inventory, item4, const TileType*); \
  _libnotcc_accessor(Inventory, keys_red, uint8_t);      \
  _libnotcc_accessor(Inventory, keys_green, uint8_t);    \
  _libnotcc_accessor(Inventory, keys_blue, uint8_t);     \
  _libnotcc_accessor(Inventory, keys_yellow, uint8_t);
const TileType** Inventory_get_rightmost_item(Inventory* self);
const TileType** Inventory_get_item_by_idx(Inventory* self, uint8_t idx);
const TileType* Inventory_shift_right(Inventory* self);
const TileType* Inventory_remove_item(Inventory* self, uint8_t idx);
void Inventory_decrement_counter(Inventory* self, uint8_t iidx);
void Inventory_increment_counter(Inventory* self, uint8_t iidx);
void Inventory_set_items(Inventory* self,
                         ItemIndex item1,
                         ItemIndex item2,
                         ItemIndex item3,
                         ItemIndex item4);
_libnotcc_accessors_Inventory;

Actor* Actor_new(Level* level,
                 const ActorType* type,
                 Position pos,
                 Direction direction);
bool Actor_check_collision(Actor* self, Level* level, Direction* direction);
bool Actor_move_to(Actor* self, Level* level, Direction direction);
bool Actor_push_to(Actor* self, Level* level, Direction direction);
bool Actor_is_moving(const Actor* self);
bool Actor_is_gone(const Actor* self);
void Actor_do_decision(Actor* self, Level* level);
void Actor_do_player_decision(Actor* self, Level* level);
void Actor_do_decided_move(Actor* self, Level* level);
void Actor_do_cooldown(Actor* self, Level* level);
void Actor_do_idle(Actor* self, Level* level);
void Actor_transform_into(Actor* self, const ActorType* new_type);
void Actor_destroy(Actor* self, Level* level, const ActorType* anim_type);
void Actor_erase(Actor* self, Level* level);
bool Actor_pickup_item(Actor* self, Level* level, BasicTile* item);
bool Actor_drop_item(Actor* self, Level* level);
void Actor_place_item_on_tile(Actor* self,
                              Level* level,
                              const TileType* item_type);
uint16_t Actor_get_position_xy(Actor* self);
Inventory* Actor_get_inventory_ptr(Actor* self);
void Player_do_decision(Actor* self, Level* level);
Direction Player_get_last_decision(Actor* self);
void Actor_enter_tile(Actor* self, Level* level);
PositionF Actor_get_visual_position(const Actor* self);
uint32_t Actor_get_actor_list_idx(const Actor* self, const Level* level);

#define _libnotcc_accessors_Actor                                  \
  _libnotcc_accessor(Actor, type, const ActorType*);               \
  _libnotcc_accessor(Actor, custom_data, uint64_t);                \
  _libnotcc_accessor(Actor, inventory, Inventory);                 \
  _libnotcc_accessor(Actor, position, Position);                   \
  _libnotcc_accessor(Actor, direction, Direction);                 \
  _libnotcc_accessor_bits(Actor, move_decision, Direction, 3);     \
  _libnotcc_accessor_bits(Actor, pending_decision, Direction, 3);  \
  _libnotcc_accessor_bits(Actor, pending_move_locked_in, bool, 1); \
  _libnotcc_accessor(Actor, move_progress, uint8_t);               \
  _libnotcc_accessor(Actor, move_length, uint8_t);                 \
  _libnotcc_accessor_bits(Actor, sliding_state, SlidingState, 2);  \
  _libnotcc_accessor_bits(Actor, bonked, bool, 1);                 \
  _libnotcc_accessor_bits(Actor, frozen, bool, 1);                 \
  _libnotcc_accessor_bits(Actor, pulled, bool, 1);                 \
  _libnotcc_accessor_bits(Actor, pulling, bool, 1);                \
  _libnotcc_accessor_bits(Actor, pushing, bool, 1);                \
  _libnotcc_accessor_bits(Actor, is_being_pushed, bool, 1);

_libnotcc_accessors_Actor;

bool BasicTile_impedes(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction);
void BasicTile_transform_into(BasicTile* self, const TileType* new_type);
void BasicTile_erase(BasicTile* self);
bool TileType_can_be_dropped(const TileType** self,
                             Level* level,
                             Actor* dropper,
                             int8_t layer_to_ignore);

#define _libnotcc_accessors_BasicTile                   \
  _libnotcc_accessor(BasicTile, type, const TileType*); \
  _libnotcc_accessor(BasicTile, custom_data, uint64_t);

_libnotcc_accessors_BasicTile;

#define get_wires(t) (t->custom_data >> 0) & 0xf
#define get_powered_wires(t) (t->custom_data >> 4) & 0xf
#define get_powering_wires(t) (t->custom_data >> 8) & 0xf
#define set_wires(t, v) t->custom_data = (t->custom_data & ~0x00f) | v
#define set_powered_wires(t, v) \
  t->custom_data = (t->custom_data & ~0x0f0) | (v << 4)
#define set_powering_wires(t, v) \
  t->custom_data = (t->custom_data & ~0xf00) | (v << 8)

typedef enum Layer {
  LAYER_SPECIAL,
  LAYER_ACTOR,
  LAYER_ITEM_MOD,
  LAYER_ITEM,
  LAYER_TERRAIN
} Layer;

typedef enum GameState {
  GAMESTATE_PLAYING = 0,
  GAMESTATE_DEAD = 1,
  GAMESTATE_TIMEOUT = 2,
  GAMESTATE_WON = 3,
  GAMESTATE_CRASH = 4,
} GameState;

BasicTile* Cell_get_layer(Cell* self, Layer layer);
Actor* Cell_get_actor(Cell* self);
void Cell_set_actor(Cell* self, Actor* actor);
void Cell_place_actor(Cell* self, Level* level, Actor* actor);
uint8_t Cell_get_powered_wires(Cell* self);
void Cell_set_powered_wires(Cell* self, uint8_t val);
BasicTile* Cell_get_layer(Cell* self, Layer layer);
bool Cell_get_is_wired(Cell* self);
void Cell_set_is_wired(Cell* self, bool val);
Cell* BasicTile_get_cell(const BasicTile* tile, Layer layer);

typedef enum WireType {
  WIRES_NONE,
  WIRES_READ,
  WIRES_UNCONNECTED,
  WIRES_CROSS,
  WIRES_ALWAYS_CROSS,
  WIRES_EVERYWHERE
} WireType;

typedef struct ActorType {
  char* name;
  void (*init)(Actor* self, Level* level);
  void (*on_bonk)(Actor* self, Level* level, BasicTile* other);
  void (*on_bump_actor)(Actor* self, Level* level, Actor* other);
  void (*on_bumped_by)(Actor* self, Level* level, Actor* other);
  void (*decide_movement)(Actor* self, Level* level, Direction* directions);
  bool (*can_be_pushed)(Actor* self,
                        Level* level,
                        Actor* other,
                        Direction direction,
                        bool pulling);
  bool (*impedes)(Actor* self, Level* level, Actor* other, Direction direction);
  void (*on_redirect)(Actor* self, Level* level, uint8_t turn);
  uint64_t flags;
  uint8_t move_duration;
} ActorType;

typedef struct TileType {
  char* name;
  Layer layer;
  void (*init)(BasicTile* self, Level* level, Cell* cell);
  void (*on_bumped_by)(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction);
  void (*on_idle)(BasicTile* self, Level* level, Actor* other);
  bool (*impedes)(BasicTile* self,
                  Level* level,
                  Actor* other,
                  Direction direction);
  Direction (*redirect_exit)(BasicTile* self,
                             Level* level,
                             Actor* other,
                             Direction direction);
  void (*actor_destroyed)(BasicTile* self, Level* level);
  bool (*overrides_item_layer)(BasicTile* self, Level* level, BasicTile* other);
  uint64_t impedes_mask;
  uint64_t flags;
  uint8_t item_index;
  WireType wire_type;
  uint8_t (*give_power)(BasicTile* self, Level* level);
  void (*receive_power)(BasicTile* self, Level* level, uint8_t powered_wires);
  void (*on_wire_high)(BasicTile* self, Level* level, bool real);
  void (*on_wire_low)(BasicTile* self, Level* level, bool real);
  uint8_t (*modify_move_duration)(BasicTile* self,
                                  Level* level,
                                  Actor* other,
                                  uint8_t move_duration);
  void (*actor_left)(BasicTile* self,
                     Level* level,
                     Actor* other,
                     Direction direction);
  void (*actor_joined)(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction);
  void (*actor_completely_joined)(BasicTile* self, Level* level, Actor* other);
} TileType;

enum PlayerInputFlags {
  PLAYER_INPUT_UP = 1 << 0,
  PLAYER_INPUT_RIGHT = 1 << 1,
  PLAYER_INPUT_DOWN = 1 << 2,
  PLAYER_INPUT_LEFT = 1 << 3,
  PLAYER_INPUT_DROP_ITEM = 1 << 4,
  PLAYER_INPUT_CYCLE_ITEMS = 1 << 5,
  PLAYER_INPUT_SWITCH_PLAYERS = 1 << 6
};

typedef uint8_t PlayerInputs;

#define _libnotcc_accessors_PlayerSeat                   \
  _libnotcc_accessor(PlayerSeat, actor, Actor*);         \
  _libnotcc_accessor(PlayerSeat, displayed_hint, char*); \
  _libnotcc_accessor(PlayerSeat, inputs, PlayerInputs);  \
  _libnotcc_accessor(PlayerSeat, released_inputs, PlayerInputs);

void PlayerSeat_get_movement_directions(PlayerSeat* self, Direction dirs[2]);
bool PlayerSeat_has_perspective(const PlayerSeat* self);
_libnotcc_accessors_PlayerSeat;

void LevelMetadata_init(LevelMetadata* self);
void LevelMetadata_uninit(LevelMetadata* self);

typedef char* CharPtr;
DECLARE_VECTOR(CharPtr);
#define _libnotcc_accessors_LevelMetadata                          \
  _libnotcc_accessor(LevelMetadata, title, char*);                 \
  _libnotcc_accessor(LevelMetadata, author, char*);                \
  _libnotcc_accessor(LevelMetadata, default_hint, char*);          \
  _libnotcc_accessor(LevelMetadata, hints, Vector_CharPtr);        \
  _libnotcc_accessor(LevelMetadata, c2g_command, char*);           \
  _libnotcc_accessor(LevelMetadata, jetlife_interval, int32_t);    \
  _libnotcc_accessor(LevelMetadata, rng_blob_4pat, bool);          \
  _libnotcc_accessor(LevelMetadata, rng_blob_deterministic, bool); \
  _libnotcc_accessor(LevelMetadata, player_n, uint32_t);           \
  _libnotcc_accessor(LevelMetadata, camera_width, uint8_t);        \
  _libnotcc_accessor(LevelMetadata, camera_height, uint8_t);       \
  _libnotcc_accessor(LevelMetadata, wires_hidden, bool);           \
  _libnotcc_accessor(LevelMetadata, timer, uint16_t);              \
  _libnotcc_accessor(LevelMetadata, cc1_boots, bool);

_libnotcc_accessors_LevelMetadata;

void Level_init_basic(Level* self);
void Level_init_players(Level* self, uint32_t players_n);
void Level_init(Level* self, uint8_t width, uint8_t height, uint32_t players_n);
void Level_uninit(Level* self);
uint8_t Level_rng(Level* self);
uint8_t Level_blobmod(Level* self);
void Level_apply_blue_button(Level* self);
void Level_tick(Level* self);
Cell* Level_get_cell(Level* self, Position pos);
Cell* Level_get_cell_xy(Level* self, uint8_t x, uint8_t y);
Actor* Level_find_next_player(Level* self, Actor* player);
PlayerSeat* Level_find_player_seat(Level* self, const Actor* player);
LevelMetadata* Level_get_metadata_ptr(Level* self);
Level* Level_clone(const Level* self);
enum HashSettings {
  HASH_SETTINGS_IGNORE_BLOCK_ORDER = 1 << 0,
  HASH_SETTINGS_IGNORE_PLAYER_DIRECTION = 1 << 1,
  // TODO: HASH_SETTINGS_IGNORE_PLAYER_BUMP = 1 << 2,
  HASH_SETTINGS_IGNORE_MIMIC_PARITY = 1 << 3,
  HASH_SETTINGS_IGNORE_TEETH_PARITY = 1 << 4,
};
int32_t Level_hash(const Level* self, uint32_t settings);
size_t Level_total_size(const Level* self);
Cell* Level_search_reading_order(Level* self,
                                 Cell* base,
                                 bool reverse,
                                 bool (*match_func)(void* ctx,
                                                    Level* level,
                                                    Cell* cell),
                                 void* ctx);
Cell* Level_search_taxicab(Level* self,
                           Cell* base,
                           bool (*match_func)(void* ctx,
                                              Level* level,
                                              Cell* cell),
                           void* ctx);
Cell* Level_search_taxicab_at_dist(Level* self,
                                   Position base_pos,
                                   uint8_t dist,
                                   bool (*match_func)(void* ctx,
                                                      Level* level,
                                                      Cell* cell),
                                   void* ctx);
Position Level_pos_from_cell(const Level* self, const Cell* cell);
void Level_initialize_tiles(Level* self);
Actor* Level_find_closest_player(Level* self, Position from);
bool Level_check_position_inbounds(const Level* self,
                                   Position pos,
                                   Direction dir,
                                   bool wrap);
Position Level_get_neighbor(Level* self, Position pos, Direction dir);
void Level_init_wires(Level* self);
void Level_do_wire_propagation(Level* self);
void Level_do_wire_notification(Level* self);
void Level_do_jetlife(Level* self);
void Level_add_glitch(Level* self, Glitch glitch);
enum SfxBit {
  SFX_RECESSED_WALL = 1 << 0,
  SFX_EXPLOSION = 1 << 1,
  SFX_SPLASH = 1 << 2,
  SFX_TELEPORT = 1 << 3,
  SFX_THIEF = 1 << 4,
  SFX_DIRT_CLEAR = 1 << 5,
  SFX_BUTTON_PRESS = 1 << 6,
  SFX_BLOCK_PUSH = 1 << 7,
  SFX_FORCE_FLOOR_SLIDE = 1 << 8,
  SFX_PLAYER_BONK = 1 << 9,
  SFX_WATER_STEP = 1 << 10,
  SFX_SLIDE_STEP = 1 << 11,
  SFX_ICE_SLIDE = 1 << 12,
  SFX_FIRE_STEP = 1 << 13,
  SFX_ITEM_PICKUP = 1 << 14,
  SFX_SOCKET_UNLOCK = 1 << 15,
  SFX_DOOR_UNLOCK = 1 << 16,
  SFX_CHIP_WIN = 1 << 17,
  SFX_MELINDA_WIN = 1 << 18,
  SFX_CHIP_DEATH = 1 << 19,
  SFX_MELINDA_DEATH = 1 << 20,

  SFX_CONTINUOUS = SFX_FORCE_FLOOR_SLIDE | SFX_ICE_SLIDE,
};

void Level_add_sfx(Level* self, uint64_t sfx);

DECLARE_VECTOR(PlayerSeat);

Vector_PlayerSeat* Level_get_player_seats_ptr(Level* self);

DECLARE_VECTOR(WireNetwork);
DECLARE_VECTOR(Glitch);

Vector_Glitch* Level_get_glitches_ptr(Level* self);

#define _libnotcc_accessors_Level                              \
  /* Basic */                                                  \
  _libnotcc_accessor(Level, width, uint8_t);                   \
  _libnotcc_accessor(Level, height, uint8_t);                  \
  _libnotcc_accessor(Level, actors, Actor**);                  \
  _libnotcc_accessor(Level, actors_n, uint32_t);               \
  _libnotcc_accessor(Level, actors_allocated_n, uint32_t);     \
  _libnotcc_accessor(Level, current_tick, uint32_t);           \
  _libnotcc_accessor(Level, current_subtick, int8_t);          \
  _libnotcc_accessor(Level, game_state, GameState);            \
  _libnotcc_accessor(Level, metadata, LevelMetadata);          \
  _libnotcc_accessor(Level, builtin_replay, Replay*);          \
  _libnotcc_accessor(Level, glitches, Vector_Glitch);          \
  /* Player */                                                 \
  _libnotcc_accessor(Level, player_seats, Vector_PlayerSeat);  \
  _libnotcc_accessor(Level, players_left, uint32_t);           \
  /* Metrics */                                                \
  _libnotcc_accessor(Level, time_left, int32_t);               \
  _libnotcc_accessor(Level, time_stopped, bool);               \
  _libnotcc_accessor(Level, chips_left, int32_t);              \
  _libnotcc_accessor(Level, bonus_points, int32_t);            \
  /* Rng */                                                    \
  _libnotcc_accessor(Level, rng1, uint8_t);                    \
  _libnotcc_accessor(Level, rng2, uint8_t);                    \
  _libnotcc_accessor(Level, rng_blob, uint8_t);                \
  /* Global state */                                           \
  _libnotcc_accessor(Level, rff_direction, Direction);         \
  _libnotcc_accessor(Level, green_button_pressed, bool);       \
  _libnotcc_accessor(Level, toggle_wall_inverted, bool);       \
  _libnotcc_accessor(Level, blue_button_pressed, bool);        \
  _libnotcc_accessor(Level, yellow_button_pressed, Direction); \
  _libnotcc_accessor(Level, sfx, uint64_t);                    \
  /* Wires */                                                  \
  _libnotcc_accessor(Level, wire_consumers, Vector_Position);  \
  _libnotcc_accessor(Level, wire_networks, Vector_WireNetwork);

_libnotcc_accessors_Level;

DECLARE_VECTOR(PlayerInputs);

#define _libnotcc_accessors_Replay                      \
  _libnotcc_accessor(Replay, rff_direction, Direction); \
  _libnotcc_accessor(Replay, rng_blob, uint8_t);        \
  _libnotcc_accessor(Replay, inputs, Vector_PlayerInputs);

Vector_PlayerInputs* Replay_get_inputs_ptr(Replay* self);

_libnotcc_accessors_Replay;

typedef enum GlitchKind {
  GLITCH_TYPE_INVALID = 0,
  GLITCH_TYPE_DESPAWN = 1,
  GLITCH_TYPE_DYNAMITE_EXPLOSION_SNEAKING = 3,
  GLITCH_TYPE_SIMULTANEOUS_CHARACTER_MOVEMENT = 6,
  GLITCH_TYPE_DROP_BY_DESPAWNED = 7,
  GLITCH_TYPE_BLUE_TELEPORT_INFINITE_LOOP = 8,
} GlitchKind;

typedef enum GlitchSpecifier {
  GLITCH_SPECIFIER_DESPAWN_REPLACE = 1,
  GLITCH_SPECIFIER_DESPAWN_REMOVE = 2,
} GlitchSpecifier;

#define _libnotcc_accessors_Glitch                     \
  _libnotcc_accessor(Glitch, glitch_kind, GlitchKind); \
  _libnotcc_accessor(Glitch, location, Position);      \
  _libnotcc_accessor(Glitch, specifier, int32_t);      \
  _libnotcc_accessor(Glitch, happens_at, uint64_t);

_libnotcc_accessors_Glitch;
uint16_t Glitch_get_location_xy(const Glitch* self);
bool Glitch_is_crashing(const Glitch* self);

int8_t compare_wire_membs_in_reading_order(const void* ctx,
                                           const WireNetworkMember* memb);
int8_t compare_pos_in_reading_order(const Position* left,
                                    const Position* right);

#endif
