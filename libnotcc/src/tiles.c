#include "tiles.h"
#include <assert.h>
#include <math.h>
#include "logic.h"
#pragma clang diagnostic ignored "-Winitializer-overrides"

// Terrain

#define IS_GHOST(actor) has_flag(actor, ACTOR_FLAGS_GHOST)

// FLOOR: `custom_data` indicates wires
const TileType FLOOR_tile = {

    .name = "floor",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_CROSS,
};

const TileType WALL_tile = {.name = "wall",
                            .layer = LAYER_TERRAIN,
                            .impedes_mask = ACTOR_FLAGS_NOT_GHOST};

// STEEL_WALL: `custom_data` indicates wires
const TileType STEEL_WALL_tile = {

    .name = "steelWall",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ~0,
};

static uint8_t ice_modify_move_duration(BasicTile* self,
                                        Level* level,
                                        Actor* actor,
                                        uint8_t move_duration) {
  if (IS_GHOST(actor))
    return move_duration;
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return move_duration;
  // TODO: Speed boots
  return move_duration / 2;
}

static uint8_t force_modify_move_duration(BasicTile* self,
                                          Level* level,
                                          Actor* actor,
                                          uint8_t move_duration) {
  if (IS_GHOST(actor))
    return move_duration;
  if (has_item_counter(actor->inventory, ITEM_INDEX_FORCE_BOOTS))
    return move_duration;
  // TODO: Speed boots
  return move_duration / 2;
}

static void ice_on_join(BasicTile* self,
                        Level* level,
                        Actor* other,
                        Direction _direction) {
  if (has_item_counter(other->inventory, ITEM_INDEX_ICE_BOOTS))
    return;
  other->sliding_state = SLIDING_STRONG;
}

static void force_on_join(BasicTile* self,
                          Level* level,
                          Actor* other,
                          Direction _direction) {
  if (has_item_counter(other->inventory, ITEM_INDEX_FORCE_BOOTS))
    return;
  other->sliding_state = SLIDING_WEAK;
}

static void ice_on_complete_join(BasicTile* self, Level* level, Actor* other) {
  // Cancel the slidingstate if the actor has an ice boot now
  if (has_item_counter(other->inventory, ITEM_INDEX_ICE_BOOTS)) {
    other->sliding_state = SLIDING_NONE;
  }
}

static void force_on_complete_join(BasicTile* self,
                                   Level* level,
                                   Actor* other) {
  // Cancel the slidingstate if the actor has an ice boot now
  if (has_item_counter(other->inventory, ITEM_INDEX_FORCE_BOOTS)) {
    other->sliding_state = SLIDING_NONE;
  }
}

static void ICE_on_idle(BasicTile* self, Level* level, Actor* actor) {
  // TODO: Melinda (note that Melinda's behavior diverges from just having
  // cleats)
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return;
  if (!actor->bonked)
    return;
  actor->direction = back(actor->direction);
  Actor_move_to(actor, level, actor->direction);
}

// ICE_CORNER: `custom_data` indicates direction of the corner
static void ICE_CORNER_on_idle(BasicTile* self, Level* level, Actor* actor) {
  // TODO: Melinda (note that Melinda's behavior diverges from just having
  // cleats)
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return;
  if (actor->bonked)
    actor->direction = back(actor->direction);
  // I don't know how this works. sorry
  actor->direction =
      right_n(self->custom_data, 7 + self->custom_data - actor->direction);
  if (actor->bonked)
    Actor_move_to(actor, level, actor->direction);
}
// NOTE: `direction` means no impede, `DIRECTION_NONE` means impede, so take
// note that ICE_CORNER_redirect_exit is the opposite of ICE_CORNER_impedes
static Direction ICE_CORNER_redirect_exit(BasicTile* self,
                                          Level* level,
                                          Actor* actor,
                                          Direction direction) {
  return direction == self->custom_data || direction == right(self->custom_data)
             ? DIRECTION_NONE
             : direction;
}
static bool ICE_CORNER_impedes(BasicTile* self,
                               Level* level,
                               Actor* actor,
                               Direction direction) {
  return direction == back(self->custom_data) ||
         direction == left(self->custom_data);
}

const TileType ICE_tile = {.name = "ice",
                           .layer = LAYER_TERRAIN,
                           .actor_joined = ice_on_join,
                           .on_idle = ICE_on_idle,
                           .modify_move_duration = ice_modify_move_duration,
                           .actor_completely_joined = ice_on_complete_join};

const TileType ICE_CORNER_tile = {

    .name = "iceCorner",
    .layer = LAYER_TERRAIN,
    .actor_joined = ice_on_join,
    .on_idle = ICE_CORNER_on_idle,
    .modify_move_duration = ice_modify_move_duration,
    .actor_completely_joined = ice_on_complete_join,
    .redirect_exit = ICE_CORNER_redirect_exit,
    .impedes = ICE_CORNER_impedes};

// FORCE_FLOOR: `custom-data` indicated FF direction
static void force_on_idle(BasicTile* self,
                          Level* level,
                          Actor* actor,
                          Direction (*get_dir)(BasicTile* self, Level* level)) {
  if (actor->bonked) {
    Actor_enter_tile(actor, level);
  }
  if (IS_GHOST(actor))
    return;
  if (has_item_counter(actor->inventory, ITEM_INDEX_FORCE_BOOTS))
    return;
  actor->sliding_state = SLIDING_WEAK;
  actor->direction = get_dir(self, level);
  if (actor->bonked) {
    Actor_move_to(actor, level, actor->direction);
  }
}

// Is this dumb? Would copying the same code twice be any better?
static Direction force_floor_idle_dir(BasicTile* self, Level* level) {
  return (Direction)self->custom_data;
}
static Direction force_floor_random_idle_dir(BasicTile* self, Level* level) {
  Direction dir = level->rff_direction;
  level->rff_direction = right(level->rff_direction);
  return dir;
}

static void FORCE_FLOOR_on_idle(BasicTile* self, Level* level, Actor* actor) {
  force_on_idle(self, level, actor, force_floor_idle_dir);
}

static void FORCE_FLOOR_RANDOM_on_idle(BasicTile* self,
                                       Level* level,
                                       Actor* actor) {
  force_on_idle(self, level, actor, force_floor_random_idle_dir);
}

const TileType FORCE_FLOOR_tile = {
    .name = "forceFloor",
    .layer = LAYER_TERRAIN,
    .on_idle = FORCE_FLOOR_on_idle,
    .actor_joined = force_on_join,
    .actor_completely_joined = force_on_complete_join,
    .modify_move_duration = force_modify_move_duration};

const TileType FORCE_FLOOR_RANDOM_tile = {
    .name = "forceFloorRandom",
    .layer = LAYER_TERRAIN,
    .on_idle = FORCE_FLOOR_RANDOM_on_idle,
    .actor_joined = force_on_join,
    .actor_completely_joined = force_on_complete_join,
    .modify_move_duration = force_modify_move_duration};

static void WATER_actor_completely_joined(BasicTile* self,
                                          Level* level,
                                          Actor* actor) {
  if (actor->type == &GLIDER_actor ||
      has_item_counter(actor->inventory, ITEM_INDEX_WATER_BOOTS))
    return;
  if (actor->type == &DIRT_BLOCK_actor) {
    BasicTile_transform_into(self, &DIRT_tile);
  }
  Actor_destroy(actor, level, &SPLASH_actor);
}

const TileType WATER_tile = {
    .name = "water",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = WATER_actor_completely_joined};

static void FIRE_actor_completely_joined(BasicTile* self,
                                         Level* level,
                                         Actor* actor) {
  // TODO: Ghost double erasure thing
  if (actor->type == &DIRT_BLOCK_actor || actor->type == &FIREBALL_actor)
    return;
  if (has_item_counter(actor->inventory, ITEM_INDEX_FIRE_BOOTS))
    return;
  if (actor->type == &ICE_BLOCK_actor) {
    BasicTile_transform_into(self, &WATER_tile);
  }
  Actor_destroy(actor, level, &EXPLOSION_actor);
}

const TileType FIRE_tile = {

    .name = "fire",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_AVOIDS_FIRE,
    .actor_completely_joined = FIRE_actor_completely_joined,
};

// TOGGLE_WALL: `custom_data` indicates if this is a wall
static bool TOGGLE_WALL_impedes(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                Direction _dir) {
  if (IS_GHOST(actor))
    return false;
  return (bool)self->custom_data != level->toggle_wall_inverted;
}

const TileType TOGGLE_WALL_tile = {.name = "toggleWall",
                                   .layer = LAYER_TERRAIN,
                                   .impedes = TOGGLE_WALL_impedes};
const TileType TELEPORT_RED_tile = {.name = "teleportRed",
                                    .layer = LAYER_TERRAIN};

static bool search_for_type(void* type_void, Level* level, Cell* cell) {
  TileType* type = type_void;
  return Cell_get_layer(cell, type->layer)->type == type;
}

static void TELEPORT_BLUE_actor_joined(BasicTile* self,
                                       Level* level,
                                       Actor* actor,
                                       Direction direction) {
  actor->sliding_state = SLIDING_STRONG;
}
// TODO: I don't want to think about wired teleports and logic gates
static void TELEPORT_BLUE_actor_completely_joined(BasicTile* self,
                                                  Level* level,
                                                  Actor* actor) {
  actor->sliding_state = SLIDING_STRONG;
  Cell* init_cell = Level_get_cell(level, actor->position);
  Cell* next_cell = init_cell;
  while (true) {
    Cell* old_cell = next_cell;
    next_cell = Level_search_reading_order(
        level, next_cell, true, search_for_type, (void*)&TELEPORT_BLUE_tile);
    // No other teleports (left) in the level, nothing to do here
    if (next_cell == NULL)
      return;
    old_cell->actor = NULL;
  // Ignore teleports which are already busy with an actor on top of them
    if (next_cell->actor != NULL)
      continue;
    // Move the actor to the next potential tile
    next_cell->actor = actor;
    actor->position = Level_pos_from_cell(level, next_cell);
    // We're back where we started, give up
    if (next_cell == init_cell)
      return;
    // If this is a valid exit tile, leave the actor on it
    // FIXME: This collision check ignores pulls in notcc.js, but Pullcrap had a
    // desync regarding teleports and pulling actors, so maybe not disabling
    // pulling is right?
    if (Actor_check_collision(actor, level, actor->direction))
      return;
  }
}
const TileType TELEPORT_BLUE_tile = {
    .name = "teleportBlue",
    .layer = LAYER_TERRAIN,
    .actor_joined = TELEPORT_BLUE_actor_joined,
    .actor_completely_joined = TELEPORT_BLUE_actor_completely_joined};
const TileType TELEPORT_GREEN_tile = {.name = "teleportGreen",
                                      .layer = LAYER_TERRAIN};
const TileType TELEPORT_YELLOW_tile = {.name = "teleportYellow",
                                       .layer = LAYER_TERRAIN};
const TileType SLIME_tile = {.name = "slime", .layer = LAYER_TERRAIN};
const TileType GRAVEL_tile = {.name = "gravel",
                              .layer = LAYER_TERRAIN,
                              .impedes_mask = ACTOR_FLAGS_AVOIDS_GRAVEL};
static void DIRT_actor_completely_joined(BasicTile* self,
                                         Level* level,
                                         Actor* other) {
  // TODO: Ghost erasing
  if (IS_GHOST(other))
    return;
  BasicTile_erase(self);
}
const TileType DIRT_tile = {

    .name = "dirt",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .flags = 0,
    .actor_completely_joined = DIRT_actor_completely_joined};

// TRAP: rightmost bit of `custom_data` indicates open/closed state, other bits
// are for the open request count

static inline bool is_controlled_by_trap(Actor* actor) {
  return !(actor->type->flags & (ACTOR_FLAGS_REAL_PLAYER | ACTOR_FLAGS_GHOST));
}

static void trap_increment_opens(BasicTile* self, Level* level, Cell* cell) {
  if (self->type != &TRAP_tile)
    return;
  self->custom_data += 2;
  if ((self->custom_data & 1) == 0) {
    self->custom_data |= 1;
    if (cell->actor && !IS_GHOST(cell->actor)) {
      cell->actor->frozen = false;
      if (level->current_subtick != -1) {
        Actor_move_to(cell->actor, level, cell->actor->direction);
      }
    }
  }
}
static void trap_decrement_opens(BasicTile* self, Level* level, Cell* cell) {
  if (self->type != &TRAP_tile)
    return;
  if ((self->custom_data & ~1) == 0)
    return;
  self->custom_data -= 2;
  if (self->custom_data == 1) {
    self->custom_data = 0;
    if (cell->actor && is_controlled_by_trap(cell->actor)) {
      cell->actor->frozen = true;
    }
  }
}
static void trap_control_actor(BasicTile* self, Level* level, Actor* actor) {
  if (!is_controlled_by_trap(actor) || (self->custom_data & 1))
    return;
  actor->frozen = true;
}
static void TRAP_init(BasicTile* self, Level* level, Cell* cell) {
  if (cell->actor) {
    trap_control_actor(self, level, cell->actor);
  }
}
static Direction TRAP_redirect_exit(BasicTile* self,
                                    Level* level,
                                    Actor* actor,
                                    Direction direction) {
  if (!(self->custom_data & 1) || IS_GHOST(actor))
    return DIRECTION_NONE;
  return direction;
}

const TileType TRAP_tile = {.name = "trap",
                            .layer = LAYER_TERRAIN,
                            .actor_completely_joined = trap_control_actor,
                            .init = TRAP_init,
                            .redirect_exit = TRAP_redirect_exit};

static void clone_machine_control_actor(BasicTile* self,
                                        Level* level,
                                        Actor* actor) {
  actor->frozen = true;
}
static void CLONE_MACHINE_init(BasicTile* self, Level* level, Cell* cell) {
  if (cell->actor) {
    clone_machine_control_actor(self, level, cell->actor);
  }
}
static void clone_machine_trigger(BasicTile* self,
                                  Level* level,
                                  Cell* cell,
                                  bool try_all_dirs) {
  if (self->type != &CLONE_MACHINE_tile)
    return;
  Actor* actor = cell->actor;
  Direction og_actor_dir = actor->direction;
  Actor* new_actor = NULL;
  Position this_pos = actor->position;
  if (!actor)
    return;
#define release_actor()  \
  actor->frozen = false; \
  new_actor = Actor_new(level, actor->type, this_pos, actor->direction);

  if (Actor_move_to(actor, level, og_actor_dir)) {
    release_actor()
  } else if (try_all_dirs) {
    if (Actor_move_to(actor, level, right(og_actor_dir))) {
      release_actor()
    } else if (Actor_move_to(actor, level, back(og_actor_dir))) {
      release_actor()
    } else if (Actor_move_to(actor, level, left(og_actor_dir))) {
      release_actor()
    } else {
      actor->direction = og_actor_dir;
    }
  }
  if (new_actor) {
    new_actor->frozen = true;
    // XXX: Is this always true? Any other data to be inherited?
    new_actor->custom_data = actor->custom_data;
  }
#undef release_actor
}

const TileType CLONE_MACHINE_tile = {

    .name = "cloneMachine",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = clone_machine_control_actor,
    .init = CLONE_MACHINE_init,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER | ACTOR_FLAGS_REAL_PLAYER};

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
    .name = "exit",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = EXIT_actor_completely_joined};

#define MAKE_DOOR(var_name, capital, simple, reuse_flag)                       \
  static bool var_name##_impedes(BasicTile* self, Level* level, Actor* other,  \
                                 Direction direction) {                        \
    if (IS_GHOST(other))                                                       \
      return false;                                                            \
    return other->inventory.keys_##simple == 0;                                \
  };                                                                           \
  static void var_name##_actor_completely_joined(BasicTile* self,              \
                                                 Level* level, Actor* other) { \
    BasicTile_erase(self);                                                     \
    if (!(other->type->flags & reuse_flag) &&                                  \
        other->inventory.keys_##simple > 0) {                                  \
      other->inventory.keys_##simple -= 1;                                     \
    }                                                                          \
  };                                                                           \
  const TileType var_name##_tile = {                                           \
                                                                               \
      .name = "door" #capital,                                                 \
      .layer = LAYER_TERRAIN,                                                  \
      .impedes = var_name##_impedes,                                           \
      .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,                               \
      .actor_completely_joined = var_name##_actor_completely_joined};

MAKE_DOOR(DOOR_RED, Red, red, 0);
MAKE_DOOR(DOOR_BLUE, Blue, blue, 0);
MAKE_DOOR(DOOR_YELLOW, Yellow, yellow, ACTOR_FLAGS_MELINDA);
MAKE_DOOR(DOOR_GREEN, Green, green, ACTOR_FLAGS_CHIP);

static void BUTTON_GREEN_actor_completely_joined(BasicTile* self,
                                                 Level* level,
                                                 Actor* actor) {
  level->green_button_pressed = !level->green_button_pressed;
}

const TileType BUTTON_GREEN_tile = {
    .name = "buttonGreen",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = BUTTON_GREEN_actor_completely_joined};

static void BUTTON_BLUE_actor_completely_joined(BasicTile* self,
                                                Level* level,
                                                Actor* actor) {
  level->blue_button_pressed = !level->blue_button_pressed;
}

const TileType BUTTON_BLUE_tile = {
    .name = "buttonBlue",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = BUTTON_BLUE_actor_completely_joined};

#define NO_CONNECTED_TILE 0xffffffff
static Cell* get_connected_cell(BasicTile* self, Level* level) {
  if (self->custom_data == NO_CONNECTED_TILE)
    return NULL;
  return Level_get_cell(level,
                        Position_from_offset(self->custom_data, level->width));
}
static Cell* connect_to_tile_reading_order(BasicTile* self,
                                           Level* level,
                                           Cell* cell,
                                           const TileType* type) {
  Cell* connected_cell = Level_search_reading_order(
      level, cell, false, search_for_type, (void*)type);
  if (!connected_cell) {
    self->custom_data = NO_CONNECTED_TILE;
    return NULL;
  };
  self->custom_data = Position_to_offset(
      Level_pos_from_cell(level, connected_cell), level->width);
  return connected_cell;
}

// BUTTON_BROWN, BUTTON_RED, BUTTON_ORANGE: `custom_data` is the offset to the
// linked tile
static void BUTTON_BROWN_init(BasicTile* self, Level* level, Cell* cell) {
  Cell* trap_cell =
      connect_to_tile_reading_order(self, level, cell, &TRAP_tile);
  if (trap_cell && cell->actor) {
    trap_increment_opens(&trap_cell->terrain, level, trap_cell);
  }
}
static void BUTTON_BROWN_actor_completely_joined(BasicTile* self,
                                                 Level* level,
                                                 Actor* actor) {
  if (IS_GHOST(actor))
    return;
  Cell* trap_cell = get_connected_cell(self, level);
  if (trap_cell == NULL)
    return;
  trap_increment_opens(&trap_cell->terrain, level, trap_cell);
}
static void button_brown_close_trap(BasicTile* self, Level* level) {
  Cell* trap_cell = get_connected_cell(self, level);
  if (trap_cell == NULL)
    return;
  trap_decrement_opens(&trap_cell->terrain, level, trap_cell);
}

static void BUTTON_BROWN_actor_left(BasicTile* self,
                                    Level* level,
                                    Actor* actor,
                                    Direction _direction) {
  if (IS_GHOST(actor))
    return;
  button_brown_close_trap(self, level);
}

const TileType BUTTON_BROWN_tile = {

    .name = "buttonBrown",
    .layer = LAYER_TERRAIN,
    .init = BUTTON_BROWN_init,
    .actor_completely_joined = BUTTON_BROWN_actor_completely_joined,
    .actor_left = BUTTON_BROWN_actor_left,
    .actor_destroyed = button_brown_close_trap};

static void BUTTON_RED_init(BasicTile* self, Level* level, Cell* cell) {
  connect_to_tile_reading_order(self, level, cell, &CLONE_MACHINE_tile);
}
static void BUTTON_RED_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* actor) {
  Cell* clone_machine_cell = get_connected_cell(self, level);
  if (!clone_machine_cell)
    return;
  clone_machine_trigger(&clone_machine_cell->terrain, level, clone_machine_cell,
                        false);
}

const TileType BUTTON_RED_tile = {
    .name = "buttonRed",
    .layer = LAYER_TERRAIN,
    .init = BUTTON_RED_init,
    .actor_completely_joined = BUTTON_RED_actor_completely_joined};

static bool ECHIP_GATE_impedes(BasicTile* self,
                               Level* level,
                               Actor* other,
                               Direction direction) {
  if (IS_GHOST(other))
    return false;
  return level->chips_left > 0;
}

static void ECHIP_GATE_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* other) {
  if (level->chips_left > 0)
    return;
  BasicTile_erase(self);
}

const TileType ECHIP_GATE_tile = {

    .name = "echipGate",
    .layer = LAYER_TERRAIN,
    .impedes = ECHIP_GATE_impedes,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = ECHIP_GATE_actor_completely_joined,
    .flags = ACTOR_FLAGS_TNT_IMMUNE};

const TileType HINT_tile = {.name = "hint",
                            .layer = LAYER_TERRAIN,
                            .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER};

static void POPUP_WALL_actor_left(BasicTile* self,
                                     Level* level,
                                     Actor* actor,
                                     Direction direction) {
  BasicTile_transform_into(self, &WALL_tile);
}

const TileType POPUP_WALL_tile = {.name = "popupWall",
                                     .layer = LAYER_TERRAIN,
                                     .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
                                     .actor_left = POPUP_WALL_actor_left};

static void APPEARING_WALL_on_bumped_by(BasicTile* self,
                                        Level* level,
                                        Actor* actor,
                                        Direction direction) {
  if (has_flag(actor, ACTOR_FLAGS_REVEALS_HIDDEN)) {
    BasicTile_transform_into(self, &WALL_tile);
  }
}
const TileType APPEARING_WALL_tile = {
    .name = "appearingWall",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_NOT_GHOST,
    .on_bumped_by = APPEARING_WALL_on_bumped_by};

static void INVISIBLE_WALL_on_bumped_by(BasicTile* self,
                                        Level* level,
                                        Actor* actor,
                                        Direction direction) {
  if (has_flag(actor, ACTOR_FLAGS_REVEALS_HIDDEN)) {
    self->custom_data = level->current_tick * 3 + level->current_subtick + 1;
  }
}
const TileType INVISIBLE_WALL_tile = {
    .name = "invisibleWall",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_NOT_GHOST,
    .on_bumped_by = INVISIBLE_WALL_on_bumped_by};

static void BLUE_WALL_on_bumped_by(BasicTile* self,
                                   Level* level,
                                   Actor* actor,
                                   Direction direction) {
  if (has_flag(actor, ACTOR_FLAGS_REVEALS_HIDDEN)) {
    BasicTile_transform_into(
        self, self->custom_data & BLUE_WALL_REAL ? &WALL_tile : &FLOOR_tile);
  }
}

const TileType BLUE_WALL_tile = {.name = "blueWall",
                                 .layer = LAYER_TERRAIN,
                                 .impedes_mask = ACTOR_FLAGS_NOT_GHOST,
                                 .on_bumped_by = BLUE_WALL_on_bumped_by};

static bool GREEN_WALL_impedes(BasicTile* self,
                               Level* level,
                               Actor* actor,
                               Direction direction) {
  return self->custom_data || has_flag(actor, ACTOR_FLAGS_BLOCK);
}

const TileType GREEN_WALL_tile = {.name = "greenWall",
                                  .layer = LAYER_TERRAIN,
                                  .impedes = GREEN_WALL_impedes};

static void THIEF_TOOL_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* actor) {
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  // TODO: Bribes
  actor->inventory.item1 = NULL;
  actor->inventory.item2 = NULL;
  actor->inventory.item3 = NULL;
  actor->inventory.item4 = NULL;
  actor->inventory.counters = (Uint8_16){};
}
const TileType THIEF_TOOL_tile = {
    .name = "thiefTool",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = THIEF_TOOL_actor_completely_joined};

static void THIEF_KEY_actor_completely_joined(BasicTile* self,
                                              Level* level,
                                              Actor* actor) {
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  // TODO: Bribes
  actor->inventory.keys_red = 0;
  actor->inventory.keys_green = 0;
  actor->inventory.keys_blue = 0;
  actor->inventory.keys_yellow = 0;
}
const TileType THIEF_KEY_tile = {
    .name = "thiefKey",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = THIEF_KEY_actor_completely_joined};

// Actors

static void kill_player(Actor* self, Level* level, Actor* other) {
  if (!has_flag(other, ACTOR_FLAGS_REAL_PLAYER))
    return;
  // TODO: Helmet
  Actor_destroy(other, level, &EXPLOSION_actor);
}

static void player_die_on_monster_bump(Actor* self,
                                       Level* level,
                                       Actor* other) {
  if (has_flag(other, ACTOR_FLAGS_KILLS_PLAYER)) {
    kill_player(other, level, self);
  }
}

const ActorType CHIP_actor = {
    .name = "chip",
    .flags = ACTOR_FLAGS_REAL_PLAYER | ACTOR_FLAGS_CHIP |
             ACTOR_FLAGS_PICKS_UP_ITEMS | ACTOR_FLAGS_CAN_PUSH |
             ACTOR_FLAGS_REVEALS_HIDDEN,
    .on_bump_actor = player_die_on_monster_bump};

static void CENTIPEDE_decide(Actor* self,
                             Level* level,
                             Direction directions[4]) {
  directions[0] = right(self->direction);
  directions[1] = self->direction;
  directions[2] = left(self->direction);
  directions[3] = back(self->direction);
}

#define ACTOR_FLAGS_CC1_MONSTER                          \
  ACTOR_FLAGS_BASIC_MONSTER | ACTOR_FLAGS_KILLS_PLAYER | \
      ACTOR_FLAGS_AVOIDS_GRAVEL | ACTOR_FLAGS_AVOIDS_FIRE

const ActorType CENTIPEDE_actor = {.name = "centipede",
                                   .flags = ACTOR_FLAGS_CC1_MONSTER,
                                   .decide_movement = CENTIPEDE_decide,
                                   .on_bump_actor = kill_player};

static void GLIDER_decide(Actor* self, Level* level, Direction directions[4]) {
  directions[0] = self->direction;
  directions[1] = left(self->direction);
  directions[2] = right(self->direction);
  directions[3] = back(self->direction);
}

const ActorType GLIDER_actor = {.name = "glider",
                                .flags = ACTOR_FLAGS_CC1_MONSTER,
                                .decide_movement = GLIDER_decide,
                                .on_bump_actor = kill_player};

static void ANT_decide(Actor* self, Level* level, Direction directions[4]) {
  directions[0] = left(self->direction);
  directions[1] = self->direction;
  directions[2] = right(self->direction);
  directions[3] = back(self->direction);
}

const ActorType ANT_actor = {
    .name = "ant",
    .flags = ACTOR_FLAGS_CC1_MONSTER | ACTOR_FLAGS_CANOPIABLE,
    .decide_movement = ANT_decide,
    .on_bump_actor = kill_player};

static void BALL_decide_movement(Actor* self, Level* level, Direction dirs[4]) {
  dirs[0] = self->direction;
  dirs[1] = back(self->direction);
}

const ActorType BALL_actor = {.name = "ball",
                              .flags = ACTOR_FLAGS_CC1_MONSTER,
                              .decide_movement = BALL_decide_movement,
                              .on_bump_actor = kill_player};

static void FIREBALL_decide_movement(Actor* self,
                                     Level* level,
                                     Direction directions[4]) {
  directions[0] = self->direction;
  directions[1] = right(self->direction);
  directions[2] = left(self->direction);
  directions[3] = back(self->direction);
}

const ActorType FIREBALL_actor = {
    .name = "fireball",
    .flags = ACTOR_FLAGS_CC1_MONSTER & ~ACTOR_FLAGS_AVOIDS_FIRE,
    .decide_movement = FIREBALL_decide_movement,
    .on_bump_actor = kill_player};

static void WALKER_decide_movement(Actor* self,
                                   Level* level,
                                   Direction directions[4]) {
  if (Actor_check_collision(self, level, self->direction)) {
    self->move_decision = self->direction;
    return;
  }
  directions[0] =
      dir_from_cc2((dir_to_cc2(self->direction) + Level_rng(level)) % 4);
}

const ActorType WALKER_actor = {.name = "walker",
                                .flags = ACTOR_FLAGS_CC1_MONSTER,
                                .decide_movement = WALKER_decide_movement,
                                .on_bump_actor = kill_player};

static void BLOB_decide_movement(Actor* self,
                                 Level* level,
                                 Direction directions[4]) {
  self->move_decision =
      dir_from_cc2((Level_rng(level) + Level_blobmod(level)) % 4);
}

const ActorType BLOB_actor = {.name = "blob",
                              .flags = ACTOR_FLAGS_CC1_MONSTER,
                              .decide_movement = BLOB_decide_movement,
                              .on_bump_actor = kill_player,
                              .move_duration = 24};

static void get_pursuit_dirs(Position source,
                             PositionF target,
                             bool reverse,
                             Direction dirs[2]) {
  float dx = target.x - (float)source.x;
  float dy = target.y - (float)source.y;
  if (reverse) {
    dx *= -1;
    dy *= -1;
  }
  Direction x_dir = dx > 0   ? DIRECTION_RIGHT
                    : dx < 0 ? DIRECTION_LEFT
                             : DIRECTION_NONE;
  Direction y_dir = dy > 0   ? DIRECTION_DOWN
                    : dy < 0 ? DIRECTION_UP
                             : DIRECTION_NONE;
  if (x_dir != DIRECTION_NONE && y_dir != DIRECTION_NONE) {
    // When we have two available directions, go with the one that's further
    // away, and pick the vertical one if they match
    if (fabsf(dx) > fabsf(dy)) {
      dirs[0] = x_dir;
      dirs[1] = y_dir;
    } else {
      dirs[0] = y_dir;
      dirs[1] = x_dir;
    }
  } else if (x_dir != DIRECTION_NONE) {
    dirs[0] = x_dir;
  } else {
    dirs[0] = y_dir;
  }
}

static void TEETH_RED_decide_movement(Actor* self,
                                      Level* level,
                                      Direction directions[4]) {
  if ((level->current_tick + 5) % 8 >= 4)
    return;
  Actor* player = Level_find_closest_player(level, self->position);
  if (!player)
    return;
  get_pursuit_dirs(self->position, Actor_get_visual_position(player),
                   has_flag(player, ACTOR_FLAGS_MELINDA), directions);
}

const ActorType TEETH_RED_actor = {.name = "teethRed",
                                   .flags = ACTOR_FLAGS_CC1_MONSTER,
                                   .decide_movement = TEETH_RED_decide_movement,
                                   .on_bump_actor = kill_player};

static bool DIRT_BLOCK_can_be_pushed(Actor* self,
                                     Level* level,
                                     Actor* other,
                                     Direction dir) {
  // TODO: Frame blocks
  return !has_flag(other, ACTOR_FLAGS_BLOCK);
};

const ActorType DIRT_BLOCK_actor = {
    .name = "dirtBlock",
    .flags = ACTOR_FLAGS_BLOCK | ACTOR_FLAGS_BASIC_MONSTER,
    .can_be_pushed = DIRT_BLOCK_can_be_pushed,
    .on_bump_actor = kill_player};
const ActorType ICE_BLOCK_actor = {};

// BLUE_TANK: `custom_data` is BLUE_TANK_ROTATE if it's to rotate
static void BLUE_TANK_decide_movement(Actor* self,
                                      Level* level,
                                      Direction dirs[4]) {
  if (self->custom_data != 0) {
    dirs[0] = back(self->direction);
    self->custom_data = 0;
  } else {
    dirs[0] = self->direction;
  }
}

const ActorType BLUE_TANK_actor = {.name = "tankBlue",
                                   .decide_movement = BLUE_TANK_decide_movement,
                                   .flags = ACTOR_FLAGS_CC1_MONSTER,
                                   .on_bump_actor = kill_player};

// YELLOW_TANK: `custom_data` is what direction to move in, BLUE_TANK_ROTATE if
// it's to rotate like a blue tank

static void YELLOW_TANK_decide_movement(Actor* self,
                                        Level* level,
                                        Direction dirs[4]) {
  if (self->custom_data & BLUE_TANK_ROTATE) {
    dirs[0] = self->direction;
  } else if (self->custom_data != DIRECTION_NONE) {
    dirs[0] = (Direction)self->custom_data;
  }
  self->custom_data = 0;
}

const ActorType YELLOW_TANK_actor = {
    .name = "tankYellow",
    .decide_movement = YELLOW_TANK_decide_movement,
    .flags = (ACTOR_FLAGS_CC1_MONSTER & ~ACTOR_FLAGS_AVOIDS_FIRE) |
             ACTOR_FLAGS_CAN_PUSH,
    .on_bump_actor = kill_player};

static void animation_init(Actor* self, Level* level) {
  self->custom_data = 16;
}
static void animation_on_bumped_by(Actor* self, Level* level, Actor* other) {
  if (!has_flag(other, ACTOR_FLAGS_REAL_PLAYER)) {
    Actor_erase(self, level);
  }
}

const ActorType SPLASH_actor = {.name = "splashAnim",
                                .flags = ACTOR_FLAGS_ANIMATION,
                                .on_bumped_by = animation_on_bumped_by,
                                .init = animation_init};
const ActorType EXPLOSION_actor = {.name = "explosionAnim",
                                   .flags = ACTOR_FLAGS_ANIMATION,
                                   .on_bumped_by = animation_on_bumped_by,
                                   .init = animation_init};

// Items
#define MAKE_KEY(var_name, capital, simple, impedes, collect_condition)        \
  static void var_name##_actor_completely_joined(BasicTile* self,              \
                                                 Level* level, Actor* other) { \
    if (other->type->flags & ACTOR_FLAGS_IGNORES_ITEMS)                        \
      return;                                                                  \
    if (!(collect_condition))                                                  \
      return;                                                                  \
    BasicTile_erase(self);                                                     \
    if (other->inventory.keys_##simple == 255) {                               \
      other->inventory.keys_##simple = 0;                                      \
    } else {                                                                   \
      other->inventory.keys_##simple += 1;                                     \
    }                                                                          \
  }                                                                            \
  const TileType var_name##_tile = {                                           \
      .name = "key" #capital,                                                  \
      .layer = LAYER_ITEM,                                                     \
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
  BasicTile_erase(self);
}

const TileType ECHIP_tile = {
    .name = "echip",
    .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = ECHIP_actor_completely_joined};

static void generic_item_pickup(BasicTile* self, Level* level, Actor* other) {
  if (other->type->flags & ACTOR_FLAGS_IGNORES_ITEMS)
    return;
  uint8_t item_index = self->type->item_index;
  Inventory* inv = &other->inventory;
  if (level->metadata.cc1_boots && item_index > ITEM_INDEX_WATER_BOOTS)
    return;

  if (level->metadata.cc1_boots) {
    Inventory_increment_counter(inv, item_index);
    // NOTE: The discrepancy between the item indecies and the item slot numbers
    // here is intentional, the CC1 boot order is ice/force/fire/water, but the
    // item index (as used in C2G's `tools` variable) goes force/ice/fire/water
    if (item_index == ITEM_INDEX_ICE_BOOTS) {
      inv->item1 = self->type;
    } else if (item_index == ITEM_INDEX_FORCE_BOOTS) {
      inv->item2 = self->type;
    } else if (item_index == ITEM_INDEX_FIRE_BOOTS) {
      inv->item3 = self->type;
    } else {
      inv->item4 = self->type;
    }
    BasicTile_erase(self);
    return;
  }
  Actor_pickup_item(other, level, self);
}

#define MAKE_GENERIC_ITEM(var_name, str_name, item_index_v) \
  const TileType var_name##_tile = {                        \
                                                            \
      .name = str_name,                                     \
      .layer = LAYER_ITEM,                                  \
      .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,            \
      .item_index = item_index_v,                           \
      .actor_completely_joined = generic_item_pickup,       \
  };

MAKE_GENERIC_ITEM(FORCE_BOOTS, "bootForceFloor", ITEM_INDEX_FORCE_BOOTS);
MAKE_GENERIC_ITEM(ICE_BOOTS, "bootIce", ITEM_INDEX_ICE_BOOTS);
MAKE_GENERIC_ITEM(FIRE_BOOTS, "bootFire", ITEM_INDEX_FIRE_BOOTS);
MAKE_GENERIC_ITEM(WATER_BOOTS, "bootWater", ITEM_INDEX_WATER_BOOTS);

// Misc
static Direction THIN_WALL_redirect_exit(BasicTile* self,
                                         Level* level,
                                         Actor* actor,
                                         Direction direction) {
  assert(direction != DIRECTION_NONE);
  if (IS_GHOST(actor))
    return direction;
  uint8_t matching_bit = 1 << dir_to_cc2(direction);
  if (self->custom_data & matching_bit)
    return DIRECTION_NONE;
  return direction;
}
static bool THIN_WALL_impedes(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction direction) {
  assert(direction != DIRECTION_NONE);
  if (IS_GHOST(actor))
    return false;
  uint8_t matching_bit = 1 << dir_to_cc2(back(direction));
  if (self->custom_data & matching_bit)
    return true;
  return false;
}
const TileType THIN_WALL_tile = {.name = "thinWall",
                                 .layer = LAYER_SPECIAL,
                                 .redirect_exit = THIN_WALL_redirect_exit,
                                 .impedes = THIN_WALL_impedes};

static void BOMB_actor_completely_joined(BasicTile* self,
                                         Level* level,
                                         Actor* actor) {
  if (actor->type->flags & ACTOR_FLAGS_GHOST)
    return;
  Actor_destroy(actor, level, &EXPLOSION_actor);
  BasicTile_erase(self);
}
const TileType BOMB_tile = {
    .name = "bomb",
    .layer = LAYER_ITEM,
    .actor_completely_joined = &BOMB_actor_completely_joined};
