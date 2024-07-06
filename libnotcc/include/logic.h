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

typedef enum SlidingState {
  SLIDING_NONE,
  SLIDING_WEAK,
  SLIDING_STRONG
} SlidingState;

#define _libnotcc_accessors_Inventory                    \
  _libnotcc_accessor(Inventory, item1, const TileType*); \
  _libnotcc_accessor(Inventory, item2, const TileType*); \
  _libnotcc_accessor(Inventory, item3, const TileType*); \
  _libnotcc_accessor(Inventory, item4, const TileType*); \
  _libnotcc_accessor(Inventory, keys_red, uint8_t);      \
  _libnotcc_accessor(Inventory, keys_green, uint8_t);    \
  _libnotcc_accessor(Inventory, keys_blue, uint8_t);     \
  _libnotcc_accessor(Inventory, keys_yellow, uint8_t);

_libnotcc_accessors_Inventory;

Actor* Actor_new(Level* level,
                 const ActorType* type,
                 Position pos,
                 Direction direction);
bool Actor_check_collision(Actor* self, Level* level, Direction direction);
bool Actor_move_to(Actor* self, Level* level, Direction direction);
bool Actor_push_to(Actor* self, Level* level, Direction direction);
bool Actor_is_moving(Actor* self);
void Actor_do_decision(Actor* self, Level* level);
void Actor_do_player_decision(Actor* self, Level* level);
void Actor_do_decided_move(Actor* self, Level* level);
void Actor_do_cooldown(Actor* self, Level* level);
void Actor_do_idle(Actor* self, Level* level);
void Actor_transform_into(Actor* self, const ActorType* new_type);
void Actor_destroy(Actor* self, Level* level, const ActorType* anim_type);
void Actor_erase(Actor* self, Level* level);
uint16_t Actor_get_position_xy(Actor* self);
Inventory* Actor_get_inventory_ptr(Actor* self);
void Player_do_decision(Actor* self, Level* level);

#define _libnotcc_accessors_Actor                          \
  _libnotcc_accessor(Actor, type, const ActorType*);       \
  _libnotcc_accessor(Actor, custom_data, uint64_t);        \
  _libnotcc_accessor(Actor, inventory, Inventory);         \
  _libnotcc_accessor(Actor, position, Position);           \
  _libnotcc_accessor(Actor, direction, Direction);         \
  _libnotcc_accessor(Actor, move_decision, Direction);     \
  _libnotcc_accessor(Actor, pending_decision, Direction);  \
  _libnotcc_accessor(Actor, pending_move_locked_in, bool); \
  _libnotcc_accessor(Actor, move_progress, uint8_t);       \
  _libnotcc_accessor(Actor, move_length, uint8_t);         \
  _libnotcc_accessor(Actor, sliding_state, SlidingState);  \
  _libnotcc_accessor(Actor, bonked, bool);

_libnotcc_accessors_Actor;

bool BasicTile_impedes(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction);
void BasicTile_transform_into(BasicTile* self, const TileType* new_type);
void BasicTile_destroy(BasicTile* self);

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
} GameState;

BasicTile* Cell_get_layer(Cell* self, Layer layer);
Actor* Cell_get_actor(Cell* self);
void Cell_set_actor(Cell* self, Actor* actor);

typedef enum WireType {
  WIRES_NONE,
  WIRES_UNCONNECTED,
  WIRES_CROSS,
  WIRES_CONNECTED
} WireType;

typedef struct ActorType {
  char* name;
  void (*init)(Actor* self, Level* level);
  void (*on_bump)(Actor* self, Level* level, BasicTile* other);
  void (*on_bump_actor)(Actor* self, Level* level, Actor* other);
  void (*decide_movement)(Actor* self, Level* level, Direction* directions);
  bool (*can_be_pushed)(Actor* self,
                        Level* level,
                        Actor* other,
                        Direction direction);
  bool (*can_push)(Actor* self, Level* level, Actor* other);
  bool (*impedes)(Actor* self, Level* level, Actor* other, Direction direction);
  uint64_t flags;
  uint8_t move_duration;
} ActorType;
#define ACTOR_TYPE                                                             \
  .init = NULL, .on_bump = NULL, .on_bump_actor = NULL, .can_be_pushed = NULL, \
  .can_push = NULL, .impedes = NULL, .move_duration = 12

typedef struct TileType {
  char* name;
  Layer layer;
  void (*init)(BasicTile* self, Level* level);
  void (*on_bumped_by)(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction);
  void (*on_idle)(BasicTile* self, Level* level, Actor* other);
  bool (*impedes)(BasicTile* self,
                  Level* level,
                  Actor* other,
                  Direction direction);
  bool (*overrides_item_layer)(BasicTile* self, Level* level, BasicTile* other);
  uint64_t impedes_mask;
  uint64_t flags;
  WireType wire_type;
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
#define TILE_TYPE                                                         \
  .init = NULL, .on_bumped_by = NULL, .on_idle = NULL, .impedes = NULL,   \
  .overrides_item_layer = NULL, .wire_type = WIRES_NONE,                  \
  .modify_move_duration = NULL, .actor_left = NULL, .actor_joined = NULL, \
  .actor_completely_joined = NULL, .impedes_mask = 0, .flags = 0

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

#define _libnotcc_accessors_PlayerSeat                  \
  _libnotcc_accessor(PlayerSeat, actor, Actor*);        \
  _libnotcc_accessor(PlayerSeat, inputs, PlayerInputs); \
  _libnotcc_accessor(PlayerSeat, released_inputs, PlayerInputs);

void PlayerSeat_get_movement_directions(PlayerSeat* self, Direction dirs[2]);
_libnotcc_accessors_PlayerSeat;

void LevelMetadata_init(LevelMetadata* self);
void LevelMetadata_uninit(LevelMetadata* self);
#define _libnotcc_accessors_LevelMetadata                          \
  _libnotcc_accessor(LevelMetadata, title, char*);                 \
  _libnotcc_accessor(LevelMetadata, author, char*);                \
  _libnotcc_accessor(LevelMetadata, default_hint, char*);          \
  _libnotcc_accessor(LevelMetadata, hints, char**);                \
  _libnotcc_accessor(LevelMetadata, hints_n, uint32_t);            \
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
void Level_tick(Level* self);
Cell* Level_get_cell(Level* self, Position pos);
Cell* Level_get_cell_xy(Level* self, uint8_t x, uint8_t y);
Actor* Level_find_next_player(Level* self, Actor* player);
PlayerSeat* Level_find_player_seat(Level* self, Actor* player);
PlayerSeat* Level_get_player_seat_n(Level* self, size_t idx);
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

#define _libnotcc_accessors_Level                              \
  /* Basic */                                                  \
  _libnotcc_accessor(Level, width, uint8_t);                   \
  _libnotcc_accessor(Level, height, uint8_t);                  \
  _libnotcc_accessor(Level, actors, Actor*);                   \
  _libnotcc_accessor(Level, actors_n, uint32_t);               \
  _libnotcc_accessor(Level, current_tick, uint32_t);           \
  _libnotcc_accessor(Level, current_subtick, int8_t);          \
  _libnotcc_accessor(Level, game_state, GameState);            \
  _libnotcc_accessor(Level, metadata, LevelMetadata);          \
  _libnotcc_accessor(Level, builtin_replay, Replay*);          \
  /* Player */                                                 \
  _libnotcc_accessor(Level, player_seats, PlayerSeat*);        \
  _libnotcc_accessor(Level, players_n, uint32_t);              \
  _libnotcc_accessor(Level, players_left, uint32_t);           \
  /* Metrics */                                                \
  _libnotcc_accessor(Level, time_left, int32_t);               \
  _libnotcc_accessor(Level, time_stopped, bool);               \
  _libnotcc_accessor(Level, chips_left, int32_t);              \
  _libnotcc_accessor(Level, bonus_points, int32_t);            \
  /* Rng */                                                    \
  _libnotcc_accessor(Level, rng1, uint8_t);                    \
  _libnotcc_accessor(Level, rng2, uint8_t);                    \
  _libnotcc_accessor(Level, rng_blob_4pat, bool);              \
  _libnotcc_accessor(Level, rng_blob, uint8_t);                \
  /* Global state */                                           \
  _libnotcc_accessor(Level, rff_direction, Direction);         \
  _libnotcc_accessor(Level, green_button_pressed, bool);       \
  _libnotcc_accessor(Level, blue_button_pressed, bool);        \
  _libnotcc_accessor(Level, yellow_button_pressed, Direction); \
  _libnotcc_accessor(Level, current_hint, char*);

_libnotcc_accessors_Level;

#define _libnotcc_accessors_Replay                      \
  _libnotcc_accessor(Replay, rff_direction, Direction); \
  _libnotcc_accessor(Replay, rng_blob, uint8_t);        \
  _libnotcc_accessor(Replay, replay_length, size_t);    \
  _libnotcc_accessor(Replay, inputs, PlayerInputs*);

_libnotcc_accessors_Replay;

#endif
