#include "tiles.h"
#include "logic.h"
#pragma clang diagnostic ignored "-Winitializer-overrides"

// Terrain

const TileType FLOOR_tile = {
    TILE_TYPE,
    .name = "floor",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_CROSS,
};

const TileType WALL_tile = {TILE_TYPE, .name = "wall", .layer = LAYER_TERRAIN,
                            .impedes_mask = ACTOR_FLAGS_NOT_GHOST};

const TileType STEEL_WALL_tile = {
    TILE_TYPE,
    .name = "steelWall",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ~0,
};

const TileType ICE_tile = {TILE_TYPE, .name = "ice", .layer = LAYER_TERRAIN};
const TileType ICE_CORNER_tile = {TILE_TYPE, .name = "iceCorner",
                                  .layer = LAYER_TERRAIN};
const TileType WATER_tile = {TILE_TYPE, .name = "water",
                             .layer = LAYER_TERRAIN};
const TileType FIRE_tile = {TILE_TYPE, .name = "fire", .layer = LAYER_TERRAIN};
const TileType FORCE_FLOOR_tile = {TILE_TYPE, .name = "forceFloor",
                                   .layer = LAYER_TERRAIN};
const TileType TOGGLE_WALL_tile = {TILE_TYPE, .name = "toggleWall",
                                   .layer = LAYER_TERRAIN};
const TileType TELEPORT_RED_tile = {TILE_TYPE, .name = "teleportRed",
                                    .layer = LAYER_TERRAIN};
const TileType TELEPORT_BLUE_tile = {TILE_TYPE, .name = "teleportBlue",
                                     .layer = LAYER_TERRAIN};
const TileType TELEPORT_GREEN_tile = {TILE_TYPE, .name = "teleportGreen",
                                      .layer = LAYER_TERRAIN};
const TileType TELEPORT_YELLOW_tile = {TILE_TYPE, .name = "teleportYellow",
                                       .layer = LAYER_TERRAIN};
const TileType SLIME_tile = {TILE_TYPE, .name = "slime",
                             .layer = LAYER_TERRAIN};
const TileType GRAVEL_tile = {};
const TileType BUTTON_GREEN_tile = {};
const TileType BUTTON_BLUE_tile = {};

static void EXIT_actor_completely_joined(BasicTile* self,
                                         Level* level,
                                         Actor* other) {
  if (!(other->type->flags & ACTOR_FLAGS_REAL_PLAYER))
    return;
  level->players_left -= 1;
  PlayerSeat* seat = Level_find_player_seat(level, other);
  seat->actor = Level_find_next_player(level, other);
  Actor_erase(other, level);
}
const TileType EXIT_tile = {
    TILE_TYPE, .name = "exit", .layer = LAYER_TERRAIN,
    .actor_completely_joined = EXIT_actor_completely_joined};

#define MAKE_DOOR(var_name, capital, simple, reuse_flag)                       \
  static bool var_name##_impedes(BasicTile* self, Level* level, Actor* other,  \
                                 Direction direction) {                        \
    if (other->type->flags & ACTOR_FLAGS_GHOST)                                \
      return false;                                                            \
    return other->inventory.keys_##simple == 0;                                \
  };                                                                           \
  static void var_name##_actor_completely_joined(BasicTile* self,              \
                                                 Level* level, Actor* other) { \
    BasicTile_destroy(self);                                                   \
    if (!(other->type->flags & reuse_flag) &&                                  \
        other->inventory.keys_##simple > 0) {                                  \
      other->inventory.keys_##simple -= 1;                                     \
    }                                                                          \
  };                                                                           \
  const TileType var_name##_tile = {                                           \
      TILE_TYPE, .name = "door" #capital, .layer = LAYER_TERRAIN,              \
      .impedes = var_name##_impedes,                                           \
      .actor_completely_joined = var_name##_actor_completely_joined};

MAKE_DOOR(DOOR_RED, Red, red, 0);
MAKE_DOOR(DOOR_BLUE, Blue, blue, 0);
MAKE_DOOR(DOOR_YELLOW, Yellow, yellow, ACTOR_FLAGS_MELINDA);
MAKE_DOOR(DOOR_GREEN, Green, green, ACTOR_FLAGS_CHIP);

static bool ECHIP_GATE_impedes(BasicTile* self,
                               Level* level,
                               Actor* other,
                               Direction direction) {
  if (other->type->flags & ACTOR_FLAGS_GHOST)
    return false;
  return level->chips_left > 0;
}

static void ECHIP_GATE_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* other) {
  if (level->chips_left > 0)
    return;
  BasicTile_destroy(self);
}

const TileType ECHIP_GATE_tile = {
    TILE_TYPE,
    .name = "echipGate",
    .layer = LAYER_TERRAIN,
    .impedes = ECHIP_GATE_impedes,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = ECHIP_GATE_actor_completely_joined,
    .flags = ACTOR_FLAGS_TNT_IMMUNE};

const TileType HINT_tile = {TILE_TYPE, .name = "hint", .layer = LAYER_TERRAIN};

// Actors

const ActorType CHIP_actor = {ACTOR_TYPE, .name = "chip",
                              .flags = ACTOR_FLAGS_REAL_PLAYER |
                                       ACTOR_FLAGS_CHIP |
                                       ACTOR_FLAGS_PICKS_UP_ITEMS};

static void CENTIPEDE_decide(Actor* self, Level* level, Direction* directions) {
  directions[0] = right(self->direction);
  directions[1] = self->direction;
  directions[2] = left(self->direction);
  directions[3] = back(self->direction);
}

const ActorType CENTIPEDE_actor = {
    ACTOR_TYPE,
    .name = "centipede",
    .flags = ACTOR_FLAGS_BASIC_MONSTER | ACTOR_FLAGS_FIRE_SENSIBLE,
    .decide_movement = CENTIPEDE_decide,
};

static void GLIDER_decide(Actor* self, Level* level, Direction* directions) {
  directions[0] = self->direction;
  directions[1] = left(self->direction);
  directions[2] = right(self->direction);
  directions[3] = back(self->direction);
}

const ActorType GLIDER_actor = {
    ACTOR_TYPE,
    .name = "glider",
    .flags = ACTOR_FLAGS_BASIC_MONSTER | ACTOR_FLAGS_FIRE_SENSIBLE,
    .decide_movement = GLIDER_decide,
};

const ActorType DIRT_BLOCK_actor = {};
const ActorType WALKER_actor = {};
const ActorType ICE_BLOCK_actor = {};

const TileType BLUE_TANK_actor = {};

// Items
const TileType LIGHTNING_tile = {TILE_TYPE, .name = "lightning",
                                 .layer = LAYER_ITEM};

#define MAKE_KEY(var_name, capital, simple, impedes, collect_condition)        \
  static void var_name##_actor_completely_joined(BasicTile* self,              \
                                                 Level* level, Actor* other) { \
    if (other->type->flags & ACTOR_FLAGS_IGNORES_ITEMS)                        \
      return;                                                                  \
    if (!(collect_condition))                                                  \
      return;                                                                  \
    BasicTile_destroy(self);                                                   \
    if (other->inventory.keys_##simple == 255) {                               \
      other->inventory.keys_##simple = 0;                                      \
    } else {                                                                   \
      other->inventory.keys_##simple += 1;                                     \
    }                                                                          \
  }                                                                            \
  const TileType var_name##_tile = {                                           \
      TILE_TYPE, .name = "key" #capital, .layer = LAYER_ITEM,                  \
      .impedes_mask = impedes,                                                 \
      .actor_completely_joined = var_name##_actor_completely_joined};

MAKE_KEY(KEY_RED, Red, red, 0, (other->type->flags & ACTOR_FLAGS_PLAYER));
MAKE_KEY(KEY_BLUE, Blue, blue, 0, true);
MAKE_KEY(KEY_YELLOW, Yellow, yellow, ACTOR_FLAGS_BASIC_MONSTER, true);
MAKE_KEY(KEY_GREEN, Green, green, ACTOR_FLAGS_BASIC_MONSTER, true);

static void ECHIP_actor_completely_joined(BasicTile* self,
                                          Level* level,
                                          Actor* actor) {
  if (!(actor->type->flags & ACTOR_FLAGS_REAL_PLAYER))
    return;
  if (level->chips_left > 0) {
    level->chips_left -= 1;
  }
  BasicTile_destroy(self);
}

const TileType ECHIP_tile = {
    TILE_TYPE, .name = "echip", .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = ECHIP_actor_completely_joined};

// Misc
const TileType THIN_WALL_tile = {TILE_TYPE, .name = "thinWall",
                                 .layer = LAYER_SPECIAL};
