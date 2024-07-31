#include "tiles.h"
#include <assert.h>
#include <math.h>
#include <stdbool.h>
#include "logic.h"
#include "misc.h"

// Terrain

#define is_ghost(actor) has_flag(actor, ACTOR_FLAGS_GHOST)

static bool impedes_non_ghost(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction _dir) {
  return !is_ghost(actor);
}

// FLOOR: `custom_data` indicates wires
const TileType FLOOR_tile = {

    .name = "floor",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_CROSS,
};

static void WALL_on_bumped_by(BasicTile* self,
                              Level* level,
                              Actor* other,
                              Direction _dir) {
  if (has_item_counter(other->inventory, ITEM_INDEX_STEEL_FOIL)) {
    BasicTile_transform_into(self, &STEEL_WALL_tile);
  }
}

const TileType WALL_tile = {.name = "wall",
                            .layer = LAYER_TERRAIN,
                            .impedes = impedes_non_ghost,
                            .on_bumped_by = WALL_on_bumped_by};

// STEEL_WALL: `custom_data` indicates wires
const TileType STEEL_WALL_tile = {
    .name = "steelWall",
    .layer = LAYER_TERRAIN,
    .flags = ACTOR_FLAGS_DYNAMITE_IMMUNE,
    .impedes_mask = ~0,
};

static uint8_t ice_modify_move_duration(BasicTile* self,
                                        Level* level,
                                        Actor* actor,
                                        uint8_t move_duration) {
  if (is_ghost(actor) || has_flag(actor, ACTOR_FLAGS_MELINDA))
    return move_duration;
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return move_duration;
  return move_duration / 2;
}

static uint8_t force_modify_move_duration(BasicTile* self,
                                          Level* level,
                                          Actor* actor,
                                          uint8_t move_duration) {
  if (is_ghost(actor))
    return move_duration;
  if (has_item_counter(actor->inventory, ITEM_INDEX_FORCE_BOOTS))
    return move_duration;
  return move_duration / 2;
}

static void ice_on_join(BasicTile* self,
                        Level* level,
                        Actor* other,
                        Direction _direction) {
  if (has_item_counter(other->inventory, ITEM_INDEX_ICE_BOOTS) ||
      has_flag(other, ACTOR_FLAGS_MELINDA))
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
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return;
  if (!actor->bonked)
    return;
  if (has_flag(actor, ACTOR_FLAGS_MELINDA)) {
    Actor_enter_tile(actor, level);
    return;
  }
  actor->direction = back(actor->direction);
  Actor_move_to(actor, level, actor->direction);
}

// ICE_CORNER: `custom_data` indicates direction of the corner
static void ICE_CORNER_on_idle(BasicTile* self, Level* level, Actor* actor) {
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return;
  if (actor->bonked && has_flag(actor, ACTOR_FLAGS_MELINDA)) {
    Actor_enter_tile(actor, level);
    return;
  }
  if (is_ghost(actor)) {
    ICE_on_idle(self, level, actor);
    return;
  }
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
  if (is_ghost(actor))
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
  if (actor->type == &ICE_BLOCK_actor) {
    BasicTile_transform_into(self, &ICE_tile);
  }
  if (actor->type == &FRAME_BLOCK_actor) {
    BasicTile_transform_into(self, &FLOOR_tile);
  }
  Actor_destroy(actor, level, &SPLASH_actor);
}

const TileType WATER_tile = {
    .name = "water",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_GHOST,
    .actor_completely_joined = WATER_actor_completely_joined};

static void FIRE_actor_completely_joined(BasicTile* self,
                                         Level* level,
                                         Actor* actor) {
  if (is_ghost(actor)) {
    if (has_item_counter(actor->inventory, ITEM_INDEX_FIRE_BOOTS)) {
      BasicTile_erase(self);
    }
    return;
  }
  if (actor->type == &DIRT_BLOCK_actor || actor->type == &FIREBALL_actor)
    return;
  if (has_item_counter(actor->inventory, ITEM_INDEX_FIRE_BOOTS))
    return;
  if (actor->type == &ICE_BLOCK_actor) {
    BasicTile_transform_into(self, &WATER_tile);
    Actor_destroy(actor, level, &SPLASH_actor);
    return;
  }
  Actor_destroy(actor, level, &EXPLOSION_actor);
}

const TileType FIRE_tile = {

    .name = "fire",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_AVOIDS_FIRE,
    .actor_completely_joined = FIRE_actor_completely_joined,
};

// FLAME_JET: `custom_data` indicates if the jet is on

static void FLAME_JET_actor_idle(BasicTile* self, Level* level, Actor* actor) {
  if (has_item_counter(actor->inventory, ITEM_INDEX_FIRE_BOOTS) ||
      actor->type == &FIREBALL_actor || actor->type == &DIRT_BLOCK_actor)
    return;
  if (!self->custom_data)
    return;
  Actor_destroy(actor, level, &EXPLOSION_actor);
}

const TileType FLAME_JET_tile = {.name = "flameJet",
                                 .layer = LAYER_TERRAIN,
                                 .on_idle = FLAME_JET_actor_idle};

// TOGGLE_WALL: `custom_data` indicates if this is a wall
static bool TOGGLE_WALL_impedes(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                Direction _dir) {
  if (is_ghost(actor))
    return false;
  return (bool)self->custom_data != level->toggle_wall_inverted;
}

const TileType TOGGLE_WALL_tile = {.name = "toggleWall",
                                   .layer = LAYER_TERRAIN,
                                   .impedes = TOGGLE_WALL_impedes};

static bool search_for_type(void* type_void, Level* level, Cell* cell) {
  TileType* type = type_void;
  return Cell_get_layer(cell, type->layer)->type == type;
}

// What's really annoying about the teleports is that they have very similar
// code, but are different enough to be annoying to generalize teleporting to a
// single function, aagh

static void weak_teleport_actor_joined(BasicTile* self,
                                       Level* level,
                                       Actor* actor,
                                       Direction direction) {
  actor->sliding_state = SLIDING_WEAK;
}

static void TELEPORT_RED_actor_completely_joined(BasicTile* self,
                                                 Level* level,
                                                 Actor* actor) {
  actor->sliding_state = SLIDING_WEAK;
  // If this is a player, give them a free override
  if (has_flag(actor, ACTOR_FLAGS_REAL_PLAYER)) {
    actor->custom_data |= PLAYER_HAS_OVERRIDE;
  }
  Cell* init_cell = Level_get_cell(level, actor->position);
  Cell* next_cell = init_cell;
  while (true) {
    Cell* old_cell = next_cell;
    next_cell = Level_search_reading_order(
        level, next_cell, false, search_for_type, (void*)&TELEPORT_RED_tile);
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
    // NOTE: Red teleports fail before trying all directions on themselves,
    // green teleports try all dirs on themselves before failing
    if (next_cell == init_cell)
      return;
    for (uint8_t dir_offset = 0; dir_offset < 4; dir_offset += 1) {
      if (Actor_check_collision(actor, level,
                                right_n(actor->direction, dir_offset))) {
        actor->direction = right_n(actor->direction, dir_offset);
        return;
      }
    }
  }
}

const TileType TELEPORT_RED_tile = {
    .name = "teleportRed",
    .layer = LAYER_TERRAIN,
    .actor_joined = weak_teleport_actor_joined,
    .actor_completely_joined = TELEPORT_RED_actor_completely_joined};

static void strong_teleport_actor_joined(BasicTile* self,
                                         Level* level,
                                         Actor* actor,
                                         Direction direction) {
  actor->sliding_state = SLIDING_STRONG;
}
// TODO: I don't want to think about wired teleports and logic gates.
// All of this will have to be rewritten to accomodate for the rollover
// nonsense...
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
    .actor_joined = strong_teleport_actor_joined,
    .actor_completely_joined = TELEPORT_BLUE_actor_completely_joined};

static void TELEPORT_GREEN_actor_completely_joined(BasicTile* self,
                                                   Level* level,
                                                   Actor* actor) {
  Cell* this_cell = Level_get_cell(level, actor->position);
  size_t green_tp_n = 0;
  // Count all green TPs I guess?
  Cell* next_cell = Level_search_reading_order(
      level, this_cell, false, search_for_type, (void*)&TELEPORT_GREEN_tile);
  if (next_cell == NULL) {
    // This is the only green TP. Don't bother
    return;
  }
  while (next_cell != this_cell) {
    green_tp_n += 1;
    next_cell = Level_search_reading_order(
        level, next_cell, false, search_for_type, (void*)&TELEPORT_GREEN_tile);
  }
  uint8_t teleport_cells_until_target = Level_rng(level) % green_tp_n;
  Direction exit_dir = dir_from_cc2(Level_rng(level) % 4);
  while (true) {
    next_cell->actor = NULL;
    next_cell = Level_search_reading_order(
        level, next_cell, false, search_for_type, (void*)&TELEPORT_GREEN_tile);
    if (next_cell->actor)
      continue;
    if (teleport_cells_until_target > 0) {
      teleport_cells_until_target -= 1;
      continue;
    }
    next_cell->actor = actor;
    actor->position = Level_pos_from_cell(level, next_cell);
    for (uint8_t dir_offset = 0; dir_offset < 4; dir_offset += 1) {
      if (Actor_check_collision(actor, level, right_n(exit_dir, dir_offset))) {
        actor->direction = right_n(exit_dir, dir_offset);
        return;
      }
    }
    if (next_cell == this_cell) {
      // We've come back to our original cell (and tried to exit in all
      // directions). Give up
      return;
    }
  }
}

const TileType TELEPORT_GREEN_tile = {
    .name = "teleportGreen",
    .layer = LAYER_TERRAIN,
    .actor_joined = strong_teleport_actor_joined,
    .actor_completely_joined = TELEPORT_GREEN_actor_completely_joined};

const TileType TELEPORT_YELLOW_tile = {.name = "teleportYellow",
                                       .layer = LAYER_TERRAIN};
static void SLIME_actor_completely_joined(BasicTile* self,
                                          Level* level,
                                          Actor* actor) {
  if (is_ghost(actor))
    return;
  if (actor->type == &DIRT_BLOCK_actor || actor->type == &ICE_BLOCK_actor) {
    BasicTile_erase(self);
    return;
  };
  Actor_destroy(actor, level, &SPLASH_actor);
}
static void SLIME_actor_left(BasicTile* self,
                             Level* level,
                             Actor* actor,
                             Direction _dir) {
  if (actor->type != &BLOB_actor)
    return;
  Cell* new_cell = Level_get_cell(level, actor->position);
  if (new_cell->terrain.type == &FLOOR_tile) {
    BasicTile_transform_into(&new_cell->terrain, &SLIME_tile);
  }
}
const TileType SLIME_tile = {
    .name = "slime",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = SLIME_actor_completely_joined,
    .actor_left = SLIME_actor_left};

static bool filth_block_melinda(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                Direction _dir) {
  return has_flag(actor, ACTOR_FLAGS_MELINDA) &&
         !has_item_counter(actor->inventory, ITEM_INDEX_DIRT_BOOTS);
}

const TileType GRAVEL_tile = {.name = "gravel",
                              .layer = LAYER_TERRAIN,
                              .impedes_mask = ACTOR_FLAGS_AVOIDS_GRAVEL,
                              .impedes = filth_block_melinda};
static void DIRT_actor_completely_joined(BasicTile* self,
                                         Level* level,
                                         Actor* other) {
  if (is_ghost(other) &&
      !has_item_counter(other->inventory, ITEM_INDEX_DIRT_BOOTS))
    return;
  BasicTile_erase(self);
}

const TileType DIRT_tile = {
    .name = "dirt",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .impedes = filth_block_melinda,
    .flags = 0,
    .actor_completely_joined = DIRT_actor_completely_joined};

// TRAP: rightmost bit of `custom_data` indicates open/closed state, other bits
// are for the open request count

static inline bool is_controlled_by_trap(Actor* actor) {
  return !has_flag(actor, ACTOR_FLAGS_GHOST | ACTOR_FLAGS_REAL_PLAYER);
}

static void trap_increment_opens(BasicTile* self, Level* level, Cell* cell) {
  if (self->type != &TRAP_tile)
    return;
  self->custom_data += 2;
  if ((self->custom_data & 1) == 0) {
    self->custom_data |= 1;
    if (cell->actor && !is_ghost(cell->actor)) {
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
  if (!(self->custom_data & 1) || is_ghost(actor))
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
  // Someone triggered an empty clone machine
  if (actor == NULL)
    return;
  actor->frozen = false;
  Direction og_actor_dir = actor->direction;
  Actor* new_actor = NULL;
  Position this_pos = actor->position;
  if (!actor)
    return;
#define release_actor() \
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
  } else {
    actor->frozen = true;
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
  if (!has_flag(other, ACTOR_FLAGS_REAL_PLAYER))
    return;
  level->players_left -= 1;
  PlayerSeat* seat = Level_find_player_seat(level, other);
  // If this player is selected, switch to a different one. If the player was
  // not select (eg. they slid into the win tile) don't try to change the
  // current player
  if (seat) {
    seat->actor = Level_find_next_player(level, other);
  }
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
    if (is_ghost(other))                                                       \
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

static void BUTTON_YELLOW_actor_completely_joined(BasicTile* self,
                                                  Level* level,
                                                  Actor* actor) {
  level->yellow_button_pressed = actor->direction;
}

const TileType BUTTON_YELLOW_tile = {
    .name = "buttonYellow",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = BUTTON_YELLOW_actor_completely_joined};

#define NO_CONNECTED_TILE 0xffffffff
static Cell* get_connected_cell(BasicTile* self, Level* level) {
  if (self->custom_data == NO_CONNECTED_TILE)
    return NULL;
  return Level_get_cell(level,
                        Position_from_offset(self->custom_data, level->width));
}
static Cell* connect_to_tile_generic(BasicTile* self,
                                     Level* level,
                                     Cell* connected_cell) {
  if (!connected_cell) {
    self->custom_data = NO_CONNECTED_TILE;
    return NULL;
  };
  self->custom_data = Position_to_offset(
      Level_pos_from_cell(level, connected_cell), level->width);
  return connected_cell;
}
static Cell* connect_to_tile_reading_order(BasicTile* self,
                                           Level* level,
                                           Cell* cell,
                                           const TileType* type) {
  Cell* connected_cell = Level_search_reading_order(
      level, cell, false, search_for_type, (void*)type);
  return connect_to_tile_generic(self, level, connected_cell);
}
static Cell* connect_to_tile_taxicab(BasicTile* self,
                                     Level* level,
                                     Cell* cell,
                                     const TileType* type) {
  Cell* connected_cell =
      Level_search_taxicab(level, cell, search_for_type, (void*)type);
  return connect_to_tile_generic(self, level, connected_cell);
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

static void BUTTON_ORANGE_init(BasicTile* self, Level* level, Cell* cell) {
  connect_to_tile_taxicab(self, level, cell, &FLAME_JET_tile);
}
static void button_orange_toggle(BasicTile* self, Level* level) {
  Cell* jet_cell = get_connected_cell(self, level);
  if (!jet_cell || jet_cell->terrain.type != &FLAME_JET_tile)
    return;
  jet_cell->terrain.custom_data = !jet_cell->terrain.custom_data;
}
static void BUTTON_ORANGE_actor_completely_joined(BasicTile* self,
                                                  Level* level,
                                                  Actor* actor) {
  button_orange_toggle(self, level);
}
static void BUTTON_ORANGE_actor_left(BasicTile* self,
                                     Level* level,
                                     Actor* actor,
                                     Direction _dir) {
  button_orange_toggle(self, level);
}

const TileType BUTTON_ORANGE_tile = {
    .name = "buttonOrange",
    .layer = LAYER_TERRAIN,
    .init = BUTTON_ORANGE_init,
    .actor_completely_joined = BUTTON_ORANGE_actor_completely_joined,
    .actor_left = BUTTON_ORANGE_actor_left};

static bool ECHIP_GATE_impedes(BasicTile* self,
                               Level* level,
                               Actor* other,
                               Direction direction) {
  if (is_ghost(other))
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
    .flags = ACTOR_FLAGS_DYNAMITE_IMMUNE};

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
    .impedes = impedes_non_ghost,
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
    .impedes = impedes_non_ghost,
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
                                 .impedes = impedes_non_ghost,
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

static bool thief_has_bribe(Actor* actor) {
  if (!has_item_counter(actor->inventory, ITEM_INDEX_BRIBE))
    return false;
  for (uint8_t idx = 0; idx < 4; idx += 1) {
    const TileType** item_type =
        Inventory_get_item_by_idx(&actor->inventory, idx);
    if (*item_type != &BRIBE_tile)
      continue;
    Inventory_remove_item(&actor->inventory, idx);
  Inventory_decrement_counter(&actor->inventory, ITEM_INDEX_BRIBE);
    return true;
  }
  // Possible only when using the shadow inventory glitch
  return true;
}

static void THIEF_TOOL_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* actor) {
  if (thief_has_bribe(actor))
    return;
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  actor->inventory.item1 = NULL;
  actor->inventory.item2 = NULL;
  actor->inventory.item3 = NULL;
  actor->inventory.item4 = NULL;
  actor->inventory.counters = (Uint8_16){};
  level->bonus_points /= 2;
}
const TileType THIEF_TOOL_tile = {
    .name = "thiefTool",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = THIEF_TOOL_actor_completely_joined};

static void THIEF_KEY_actor_completely_joined(BasicTile* self,
                                              Level* level,
                                              Actor* actor) {
  if (thief_has_bribe(actor))
    return;
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  actor->inventory.keys_red = 0;
  actor->inventory.keys_green = 0;
  actor->inventory.keys_blue = 0;
  actor->inventory.keys_yellow = 0;
  level->bonus_points /= 2;
}
const TileType THIEF_KEY_tile = {
    .name = "thiefKey",
    .layer = LAYER_TERRAIN,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = THIEF_KEY_actor_completely_joined};

static void TURTLE_actor_left(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction dir) {
  BasicTile_transform_into(self, &WATER_tile);
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Actor_new(level, &SPLASH_actor, Level_pos_from_cell(level, cell),
            DIRECTION_UP);
}

const TileType TURTLE_tile = {.name = "turtle",
                              .layer = LAYER_TERRAIN,
                              .impedes_mask = ACTOR_FLAGS_AVOIDS_TURTLE,
                              .actor_left = TURTLE_actor_left};

const TileType CUSTOM_FLOOR_tile = {.name = "customFloor",
                                    .layer = LAYER_TERRAIN,
                                    .impedes_mask = ACTOR_FLAGS_GHOST};
const TileType CUSTOM_WALL_tile = {.name = "customWall",
                                   .layer = LAYER_TERRAIN,
                                   .impedes_mask = ~0};

const TileType LETTER_FLOOR_tile = {.name = "letterTile",
                                    .layer = LAYER_TERRAIN};

// SWIVEL: `custom_data` indicates current direction (UP is UP/RIGHT, and so on)

static bool SWIVEL_impedes(BasicTile* self,
                           Level* level,
                           Actor* actor,
                           Direction dir) {
  return dir == back(self->custom_data) || dir == left(self->custom_data);
}
static void SWIVEL_actor_left(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction dir) {
  Direction self_dir = (Direction)self->custom_data;
  if (dir == self_dir)
    self->custom_data = right(self->custom_data);
  else if (dir == right(self_dir))
    self->custom_data = left(self->custom_data);
}
const TileType SWIVEL_tile = {.name = "swivel",
                              .layer = LAYER_TERRAIN,
                              .impedes = SWIVEL_impedes,
                              .actor_left = SWIVEL_actor_left};

const TileType NO_CHIP_SIGN_tile = {.name = "noChipSign",
                                    .layer = LAYER_TERRAIN,
                                    .impedes_mask = ACTOR_FLAGS_CHIP};
const TileType NO_MELINDA_SIGN_tile = {.name = "noMelindaSign",
                                       .layer = LAYER_TERRAIN,
                                       .impedes_mask = ACTOR_FLAGS_MELINDA};

typedef struct TransmogEntry {
  const ActorType* key;
  const ActorType* val;
} TransmogEntry;

// A simple key-val array instead of a hashmap or whatever. Sue me.
static TransmogEntry transmog_entries[] = {
    // Chip-Melinda
    {&CHIP_actor, &MELINDA_actor},
    {&MELINDA_actor, &CHIP_actor},
    // TODO: Mirror player

    // Dirt block-ice block
    {&DIRT_BLOCK_actor, &ICE_BLOCK_actor},
    {&ICE_BLOCK_actor, &DIRT_BLOCK_actor},
    // Ball-walker
    {&BALL_actor, &WALKER_actor},
    {&WALKER_actor, &BALL_actor},
    // Fireball-ant-glider-centipede
    {&FIREBALL_actor, &ANT_actor},
    {&ANT_actor, &GLIDER_actor},
    {&GLIDER_actor, &CENTIPEDE_actor},
    {&CENTIPEDE_actor, &FIREBALL_actor},
    // Blue-yellow tank
    {&BLUE_TANK_actor, &YELLOW_TANK_actor},
    {&YELLOW_TANK_actor, &BLUE_TANK_actor},
    // Red-blue teeth
    {&TEETH_RED_actor, &TEETH_BLUE_actor},
    {&TEETH_BLUE_actor, &TEETH_RED_actor}};

static const ActorType* const blob_transmog_options[] = {
    &GLIDER_actor,    &CENTIPEDE_actor, &FIREBALL_actor,
    &ANT_actor,       &WALKER_actor,    &BALL_actor,
    &TEETH_RED_actor, &BLUE_TANK_actor, &TEETH_BLUE_actor};

static const ActorType* get_transmogrified_type(const ActorType* type,
                                                Level* level) {
  if (!type)
    return NULL;
  if (type == &BLOB_actor) {
    return blob_transmog_options[Level_rng(level) %
                                 lengthof(blob_transmog_options)];
  }
  for (size_t idx = 0; idx < lengthof(transmog_entries); idx += 1) {
    TransmogEntry* ent = &transmog_entries[idx];
    if (ent->key == type)
      return ent->val;
  }
  return NULL;
}

static void TRANSMOGRIFIER_actor_completely_joined(BasicTile* self,
                                                   Level* level,
                                                   Actor* actor) {
  const ActorType* new_type = get_transmogrified_type(actor->type, level);
  if (!new_type)
    return;
  // This keeps `custom_data`, important for eg. a yellow tank transforming into
  // a blue tank and doing a (weird) move
  Actor_transform_into(actor, new_type);
}

const TileType TRANSMOGRIFIER_tile = {
    .name = "transmogrifier",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = TRANSMOGRIFIER_actor_completely_joined};

// Actors

static void kill_player(Actor* self, Level* level, Actor* other) {
  if (!has_flag(other, ACTOR_FLAGS_REAL_PLAYER))
    return;
  if (has_item_counter(other->inventory, ITEM_INDEX_HELMET) ||
      has_item_counter(self->inventory, ITEM_INDEX_HELMET))
    return;
  Actor_destroy(other, level, &EXPLOSION_actor);
}

static void player_die_on_monster_bump(Actor* self,
                                       Level* level,
                                       Actor* other) {
  if (has_flag(other, ACTOR_FLAGS_KILLS_PLAYER) &&
      !has_flag(other, ACTOR_FLAGS_BLOCK)) {
    kill_player(other, level, self);
  }
}

const ActorType CHIP_actor = {
    .name = "chip",
    .flags = ACTOR_FLAGS_REAL_PLAYER | ACTOR_FLAGS_CHIP |
             ACTOR_FLAGS_PICKS_UP_ITEMS | ACTOR_FLAGS_CAN_PUSH |
             ACTOR_FLAGS_REVEALS_HIDDEN,
    .on_bump_actor = player_die_on_monster_bump};

const ActorType MELINDA_actor = {
    .name = "melinda",
    .flags = ACTOR_FLAGS_REAL_PLAYER | ACTOR_FLAGS_MELINDA |
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
    .flags = ACTOR_FLAGS_CC1_MONSTER | ACTOR_FLAGS_AVOIDS_CANOPY,
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
    .flags = (ACTOR_FLAGS_CC1_MONSTER | ACTOR_FLAGS_AVOIDS_TURTLE) &
             ~ACTOR_FLAGS_AVOIDS_FIRE,
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

// Lol nice copypaste
static void TEETH_BLUE_decide_movement(Actor* self,
                                       Level* level,
                                       Direction directions[4]) {
  if ((level->current_tick + 5) % 8 >= 4)
    return;
  Actor* player = Level_find_closest_player(level, self->position);
  if (!player)
    return;
  get_pursuit_dirs(self->position, Actor_get_visual_position(player),
                   has_flag(player, ACTOR_FLAGS_CHIP), directions);
}

const ActorType TEETH_BLUE_actor = {
    .name = "teethBlue",
    .flags = ACTOR_FLAGS_CC1_MONSTER,
    .decide_movement = TEETH_BLUE_decide_movement,
    .on_bump_actor = kill_player};

// Lol nice copypaste
// Lol nice copypaste
static void FLOOR_MIMIC_decide_movement(Actor* self,
                                        Level* level,
                                        Direction directions[4]) {
  if ((level->current_tick + 5) % 16 >= 4)
    return;
  Actor* player = Level_find_closest_player(level, self->position);
  if (!player)
    return;
  get_pursuit_dirs(self->position, Actor_get_visual_position(player), false,
                   directions);
}

const ActorType FLOOR_MIMIC_actor = {
    .name = "floorMimic",
    .flags = ACTOR_FLAGS_CC1_MONSTER,
    .decide_movement = FLOOR_MIMIC_decide_movement,
    .on_bump_actor = kill_player};

// ROVER: least significant byte specifies moves until the next monster is
// emulated, second least byte significant specifies the currently emulated
// monster
static const ActorType* const rover_emulated_monsters[] = {
    &TEETH_RED_actor,  &GLIDER_actor,   &ANT_actor,       &BALL_actor,
    &TEETH_BLUE_actor, &FIREBALL_actor, &CENTIPEDE_actor, &WALKER_actor};

static void ROVER_init(Actor* self, Level* level) {
  self->custom_data = 32;
}

static void ROVER_decide_movement(Actor* self,
                                  Level* level,
                                  Direction dirs[4]) {
  uint8_t current_monster_idx = (self->custom_data & 0xff00) >> 8;
  uint8_t moves_until_next_emu = self->custom_data & 0xff;
  moves_until_next_emu -= 1;
  if (moves_until_next_emu == 0) {
    current_monster_idx =
        (current_monster_idx + 1) % lengthof(rover_emulated_monsters);
    moves_until_next_emu = 32;
  }
  self->custom_data = (current_monster_idx << 8) + moves_until_next_emu;
  const ActorType* emu_type = rover_emulated_monsters[current_monster_idx];
  emu_type->decide_movement(self, level, dirs);
}

const ActorType ROVER_actor = {
    .name = "rover",
    .flags = ACTOR_FLAGS_PICKS_UP_ITEMS | ACTOR_FLAGS_KILLS_PLAYER |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_AVOIDS_CANOPY |
             ACTOR_FLAGS_AVOIDS_FIRE,
    .init = ROVER_init,
    .decide_movement = ROVER_decide_movement,
    .on_bump_actor = kill_player,
    .move_duration = 24};

static bool DIRT_BLOCK_can_be_pushed(Actor* self,
                                     Level* level,
                                     Actor* other,
                                     Direction dir) {
  return !has_flag(other, ACTOR_FLAGS_BLOCK) ||
         other->type == &FRAME_BLOCK_actor;
};

const ActorType DIRT_BLOCK_actor = {.name = "dirtBlock",
                                    .flags = ACTOR_FLAGS_BLOCK |
                                             ACTOR_FLAGS_BASIC_MONSTER |
                                             ACTOR_FLAGS_KILLS_PLAYER,
                                    .can_be_pushed = DIRT_BLOCK_can_be_pushed,
                                    .on_bump_actor = kill_player};

static bool cc2_block_can_be_pushed(Actor* self,
                                    Level* level,
                                    Actor* other,
                                    Direction _dir) {
  // Weird quirk: we can't be pushed by a block if we're sliding
  if (self->sliding_state && has_flag(other, ACTOR_FLAGS_BLOCK))
    return false;
  return true;
}

static void ICE_BLOCK_on_bumped_by(Actor* self, Level* level, Actor* other) {
  Cell* cell = Level_get_cell(level, self->position);
  if (other->type == &FIREBALL_actor && cell->terrain.type == &FLOOR_tile) {
    BasicTile_transform_into(&cell->terrain, &WATER_tile);
    Actor_destroy(self, level, &SPLASH_actor);
  }
}

const ActorType ICE_BLOCK_actor = {
    .name = "iceBlock",
    .flags = ACTOR_FLAGS_BLOCK | ACTOR_FLAGS_IGNORES_ITEMS |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_KILLS_PLAYER,
    .can_be_pushed = cc2_block_can_be_pushed,
    .on_bump_actor = kill_player,
    .on_bumped_by = ICE_BLOCK_on_bumped_by};

static bool FRAME_BLOCK_can_be_pushed(Actor* self,
                                      Level* level,
                                      Actor* other,
                                      Direction dir) {
  uint8_t dir_bit = 1 << dir_to_cc2(dir);
  if (!(self->custom_data & dir_bit))
    return false;
  return cc2_block_can_be_pushed(self, level, other, dir);
}

const ActorType FRAME_BLOCK_actor = {
    .name = "frameBlock",
    .flags = ACTOR_FLAGS_BLOCK | ACTOR_FLAGS_IGNORES_ITEMS |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_KILLS_PLAYER,
    .can_be_pushed = FRAME_BLOCK_can_be_pushed,
    .on_bump_actor = kill_player,

    // TODO: Railroads
};

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
  Direction dir = DIRECTION_NONE;
  if (self->custom_data & BLUE_TANK_ROTATE) {
    dir = self->direction;
  } else if (self->custom_data != DIRECTION_NONE) {
    dir = (Direction)self->custom_data;
  }
  if (dir) {
    // Do the check manually so that we don't try to do the last tried direction
    // at move time
    if (Actor_check_collision(self, level, dir)) {
      self->move_decision = dir;
      self->direction = dir;
    }
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

static bool dynamite_lit_nuke_tile(void* ctx, Level* level, Cell* cell) {
  Position self_pos = *(Position*)ctx;
  Position tile_pos = Level_pos_from_cell(level, cell);
  int8_t dx = self_pos.x - tile_pos.x;
  int8_t dy = self_pos.y - tile_pos.y;
  // Edge cell
  if (dx == 3 || dx == -3 || dy == 3 || dy == -3)
    return false;
  if (cell->special.type == &THIN_WALL_tile &&
      cell->special.custom_data & THIN_WALL_HAS_CANOPY) {
    BasicTile_erase(&cell->special);
    // Even if it's protected under a canopy, always destroy any (!) lit
    // dynamite
    if (cell->actor && cell->actor->type == &DYNAMITE_LIT_actor) {
      Actor_destroy(cell->actor, level, &EXPLOSION_actor);
    }
    return false;
  }
  if (cell->special.type)
    BasicTile_erase(&cell->special);
  if (cell->item.type)
    BasicTile_erase(&cell->item);
  if (cell->item_mod.type)
    BasicTile_erase(&cell->item_mod);
  if (cell->actor) {
    bool was_ice_block = cell->actor->type == &ICE_BLOCK_actor;
    Actor_destroy(cell->actor, level, &EXPLOSION_actor);
    if (cell->terrain.type == &FLOOR_tile) {
      // Note that this keeps the original tile's `custom_data`
      BasicTile_transform_into(&cell->terrain,
                               was_ice_block ? &WATER_tile : &FIRE_tile);
    }
    return false;
  }
  if (cell->terrain.type != &FLOOR_tile &&
      !has_flag(&cell->terrain, ACTOR_FLAGS_DYNAMITE_IMMUNE)) {
    BasicTile_erase(&cell->terrain);
    // We also have to manually unset the `custom_data` in case we're destroying
    // something with `custom_data` which would now make the new floor appear as
    // if it has wires
    cell->terrain.custom_data = 0;
    Actor_new(level, &EXPLOSION_actor, tile_pos, DIRECTION_UP);
  }
  return false;
}

static void DYNAMITE_LIT_decide_movement(Actor* self,
                                         Level* level,
                                         Direction _directions[4]) {
  // Weird dynamite behavior: always try to respawn ourselves.
  Cell* cell = Level_get_cell(level, self->position);
  // TODO: Report despawn of other actor
  // Also: does this happen before or after the explosion of other tiles? (could
  // potentially affect what happens to a lit dynamite with 0 cooldown)
  cell->actor = self;
  self->custom_data -= 1;
  // # 3 3 3 #
  // 3 2 1 2 3
  // 2 1 3 1 2
  // 3 2 1 2 3
  // # 3 2 3 #
  if (self->custom_data == 2) {
    // Kind of a hack: search_taxicab_at_dist is meant for searching, not
    // iteration
    Level_search_taxicab_at_dist(level, self->position, 1,
                                 dynamite_lit_nuke_tile, &self->position);
  } else if (self->custom_data == 1) {
    Level_search_taxicab_at_dist(level, self->position, 2,
                                 dynamite_lit_nuke_tile, &self->position);

  } else if (self->custom_data == 0) {
    // Pass out position to exclude the edge cell which dynamite doesn't explode
    Level_search_taxicab_at_dist(level, self->position, 3,
                                 dynamite_lit_nuke_tile, &self->position);
    dynamite_lit_nuke_tile(&self->position, level,
                           Level_get_cell(level, self->position));
    assert(self->type == &EXPLOSION_actor);
  }
}
static void DYNAMITE_LIT_init(Actor* self, Level* level) {
  self->custom_data = 255;
}

const ActorType DYNAMITE_LIT_actor = {
    .name = "dynamiteLit",
    .flags = ACTOR_FLAGS_BASIC_MONSTER | ACTOR_FLAGS_KILLS_PLAYER |
             ACTOR_FLAGS_DECIDES_EVERY_SUBTICK,
    .init = DYNAMITE_LIT_init,
    .decide_movement = DYNAMITE_LIT_decide_movement,
    .on_bump_actor = kill_player};

static void mirror_player_decide_movement(Actor* self,
                                          Level* level,
                                          Direction dirs[4]) {
  Actor* player = Level_find_closest_player(level, self->position);
  if (!player || !has_flag(player, (self->type->flags & ACTOR_FLAGS_PLAYER)))
    return;
  self->move_decision = Player_get_last_decision(player);
}

const ActorType MIRROR_CHIP_actor = {
    .name = "mirrorChip",
    .flags = ACTOR_FLAGS_CHIP | ACTOR_FLAGS_PICKS_UP_ITEMS |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_REVEALS_HIDDEN |
             ACTOR_FLAGS_KILLS_PLAYER,
    .on_bump_actor = kill_player,
    .decide_movement = mirror_player_decide_movement};

const ActorType MIRROR_MELINDA_actor = {
    .name = "mirrorMelinda",
    .flags = ACTOR_FLAGS_MELINDA | ACTOR_FLAGS_PICKS_UP_ITEMS |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_REVEALS_HIDDEN |
             ACTOR_FLAGS_KILLS_PLAYER,
    .on_bump_actor = kill_player,
    .decide_movement = mirror_player_decide_movement};

static void bowling_ball_kill_whatever(Actor* self,
                                       Level* level,
                                       Actor* other) {
  Actor_destroy(self, level, &EXPLOSION_actor);
  Actor_destroy(other, level, &EXPLOSION_actor);
}
static void bowling_ball_kill_self(Actor* self,
                                   Level* level,
                                   BasicTile* _tile) {
  Actor_destroy(self, level, &EXPLOSION_actor);
}

static void BOWLING_BALL_ROLLING_decide_movement(Actor* self,
                                                 Level* level,
                                                 Direction dirs[4]) {
  dirs[0] = self->direction;
}

const ActorType BOWLING_BALL_ROLLING_actor = {
    .name = "bowlingBallRolling",
    .flags = ACTOR_FLAGS_PICKS_UP_ITEMS | ACTOR_FLAGS_REVEALS_HIDDEN |
             ACTOR_FLAGS_KILLS_PLAYER,
    .on_bump_actor = bowling_ball_kill_whatever,
    .on_bumped_by = bowling_ball_kill_whatever,
    .on_bonk = bowling_ball_kill_self,
    .decide_movement = BOWLING_BALL_ROLLING_decide_movement};

const ActorType GHOST_actor = {
    .name = "ghost",
    .flags = ACTOR_FLAGS_PICKS_UP_ITEMS | ACTOR_FLAGS_GHOST |
             ACTOR_FLAGS_KILLS_PLAYER | ACTOR_FLAGS_AVOIDS_TURTLE,
    .decide_movement = GLIDER_decide,
    .on_bump_actor = kill_player,
};

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
      .flags = ACTOR_FLAGS_ITEM,                                               \
      .impedes_mask = impedes,                                                 \
      .actor_completely_joined = var_name##_actor_completely_joined};

MAKE_KEY(KEY_RED, Red, red, 0, (other->type->flags & ACTOR_FLAGS_PLAYER));
MAKE_KEY(KEY_BLUE, Blue, blue, 0, true);
MAKE_KEY(KEY_YELLOW, Yellow, yellow, ACTOR_FLAGS_BASIC_MONSTER, true);
MAKE_KEY(KEY_GREEN, Green, green, ACTOR_FLAGS_BASIC_MONSTER, true);
#define IS_KEY(item)                                               \
  (item->type == &KEY_RED_tile || item->type == &KEY_GREEN_tile || \
   item->type == &KEY_BLUE_tile || item->type == &KEY_YELLOW_tile)
static uint8_t get_key_count(Inventory* inv, const TileType* key_type) {
  if (key_type == &KEY_RED_tile)
    return inv->keys_red;
  if (key_type == &KEY_GREEN_tile)
    return inv->keys_green;
  if (key_type == &KEY_BLUE_tile)
    return inv->keys_blue;
  if (key_type == &KEY_YELLOW_tile)
    return inv->keys_yellow;
  return 0;
}

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

static void TIME_BONUS_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* actor) {
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  level->time_left += 600;
  BasicTile_erase(self);
}

const TileType TIME_BONUS_tile = {
    .name = "timeBonus",
    .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = TIME_BONUS_actor_completely_joined};

static void TIME_PENALTY_actor_completely_joined(BasicTile* self,
                                                 Level* level,
                                                 Actor* actor) {
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  if (level->time_left <= 600) {
    level->time_left = 1;
  } else {
    level->time_left -= 600;
  }
  BasicTile_erase(self);
}

const TileType TIME_PENALTY_tile = {
    .name = "timePenalty",
    .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = TIME_PENALTY_actor_completely_joined};

static void STOPWATCH_actor_completely_joined(BasicTile* self,
                                              Level* level,
                                              Actor* actor) {
  if (!has_flag(actor, ACTOR_FLAGS_PLAYER))
    return;
  level->time_stopped = !level->time_stopped;
}

const TileType STOPWATCH_tile = {
    .name = "stopwatch",
    .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = STOPWATCH_actor_completely_joined};

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
      .flags = ACTOR_FLAGS_ITEM,                            \
      .item_index = item_index_v,                           \
      .actor_completely_joined = generic_item_pickup,       \
  };

MAKE_GENERIC_ITEM(FORCE_BOOTS, "bootForceFloor", ITEM_INDEX_FORCE_BOOTS);
MAKE_GENERIC_ITEM(ICE_BOOTS, "bootIce", ITEM_INDEX_ICE_BOOTS);
MAKE_GENERIC_ITEM(FIRE_BOOTS, "bootFire", ITEM_INDEX_FIRE_BOOTS);
MAKE_GENERIC_ITEM(WATER_BOOTS, "bootWater", ITEM_INDEX_WATER_BOOTS);
MAKE_GENERIC_ITEM(DIRT_BOOTS, "bootDirt", ITEM_INDEX_DIRT_BOOTS);
MAKE_GENERIC_ITEM(STEEL_FOIL, "steelFoil", ITEM_INDEX_STEEL_FOIL);
MAKE_GENERIC_ITEM(RR_SIGN, "rrSign", ITEM_INDEX_RR_SIGN);
MAKE_GENERIC_ITEM(BRIBE, "bribe", ITEM_INDEX_BRIBE);
MAKE_GENERIC_ITEM(SPEED_BOOTS, "bootSpeed", ITEM_INDEX_SPEED_BOOTS);
MAKE_GENERIC_ITEM(SECRET_EYE, "secretEye", ITEM_INDEX_SECRET_EYE);
MAKE_GENERIC_ITEM(HELMET, "helmet", ITEM_INDEX_HELMET);
// MAKE_GENERIC_ITEM(LIGHTNING_BOLT, "lightningBolt",
// ITEM_INDEX_LIGHTNING_BOLT);
MAKE_GENERIC_ITEM(BOWLING_BALL, "bowlingBall", ITEM_INDEX_BOWLING_BALL);
MAKE_GENERIC_ITEM(HOOK, "hook", ITEM_INDEX_HOOK);

static void DYNAMITE_actor_left(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                Direction dir) {
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  // We will be despawned immediately after this because the player will
  // null-out their after notifying us
  Actor_new(level, &DYNAMITE_LIT_actor, actor->position, dir);
  BasicTile_erase(self);
}

const TileType DYNAMITE_tile = {

    .name = "dynamite",
    .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .flags = ACTOR_FLAGS_ITEM,
    .item_index = ITEM_INDEX_DYNAMITE,
    .actor_completely_joined = generic_item_pickup,
    .actor_left = DYNAMITE_actor_left};

// BONUS_FLAG: `custom_data` indicates points earned, if the 0x8000 bit is set,
// multiply instead of add
static void BONUS_FLAG_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* actor) {
  if (is_ghost(actor) || has_flag(actor, ACTOR_FLAGS_IGNORES_ITEMS))
    return;
  if (has_flag(actor, ACTOR_FLAGS_REAL_PLAYER)) {
    if (self->custom_data & 0x8000) {
      level->bonus_points *= self->custom_data & 0x7fff;
    } else {
      level->bonus_points += self->custom_data;
    }
  }
  BasicTile_erase(self);
}

const TileType BONUS_FLAG_tile = {
    .name = "bonusFlag",
    .layer = LAYER_ITEM,
    .impedes_mask = ACTOR_FLAGS_BASIC_MONSTER,
    .actor_completely_joined = BONUS_FLAG_actor_completely_joined};

// Misc
static Direction THIN_WALL_redirect_exit(BasicTile* self,
                                         Level* level,
                                         Actor* actor,
                                         Direction direction) {
  assert(direction != DIRECTION_NONE);
  if (is_ghost(actor))
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
  if (is_ghost(actor))
    return false;
  if (actor->type == &BLOB_actor &&
      (self->custom_data & THIN_WALL_HAS_CANOPY)) {
    Cell* blob_tile = Level_get_cell(level, actor->position);
    BasicTile* blob_special = &blob_tile->special;
    if (blob_special->type == &THIN_WALL_tile &&
        (blob_special->custom_data & THIN_WALL_HAS_CANOPY))
      return true;
  }
  if ((self->custom_data & THIN_WALL_HAS_CANOPY) &&
      has_flag(actor, ACTOR_FLAGS_AVOIDS_CANOPY))
    return true;
  uint8_t matching_bit = 1 << dir_to_cc2(back(direction));
  if (self->custom_data & matching_bit)
    return true;
  return false;
}
const TileType THIN_WALL_tile = {.name = "thinWall",
                                 .layer = LAYER_SPECIAL,
                                 .redirect_exit = THIN_WALL_redirect_exit,
                                 .impedes = THIN_WALL_impedes};

static void bomb_actor_interacts(BasicTile* self, Level* level, Actor* actor) {
  if (is_ghost(actor))
    return;
  Actor_destroy(actor, level, &EXPLOSION_actor);
  BasicTile_erase(self);
}
const TileType BOMB_tile = {.name = "bomb",
                            .layer = LAYER_ITEM,
                            .on_idle = bomb_actor_interacts,
                            .actor_completely_joined = bomb_actor_interacts};

static bool NO_SIGN_impedes(BasicTile* self,
                            Level* level,
                            Actor* actor,
                            Direction _dir) {
  Cell* cell = BasicTile_get_cell(self, LAYER_ITEM_MOD);
  BasicTile* item = &cell->item;
  if (!item->type || !has_flag(item, ACTOR_FLAGS_ITEM))
    return false;
  if (item->type->item_index) {
    return has_item_counter(actor->inventory, item->type->item_index);
  } else if (IS_KEY(item)) {
    return get_key_count(&actor->inventory, item->type) > 0;
  } else {
    return has_item_generic(actor->inventory, item->type);
  }
}

static bool NO_SIGN_overrides_item_layer(BasicTile* self,
                                         Level* level,
                                         BasicTile* item) {
  // TODO: Ghost nonsense?
  if (level->metadata.cc1_boots)
    return false;
  return item->type && has_flag(item, ACTOR_FLAGS_ITEM);
}

const TileType NO_SIGN_tile = {
    .name = "noSign",
    .layer = LAYER_ITEM_MOD,
    .impedes = NO_SIGN_impedes,
    .overrides_item_layer = NO_SIGN_overrides_item_layer};

static bool green_bomb_is_chip(BasicTile* self, Level* level) {
  return (bool)self->custom_data != level->toggle_wall_inverted;
}

static bool GREEN_BOMB_impedes(BasicTile* self,
                               Level* level,
                               Actor* actor,
                               Direction _dir) {
  return green_bomb_is_chip(self, level)
             ? has_flag(actor, ACTOR_FLAGS_BASIC_MONSTER)
             : false;
}

static void GREEN_BOMB_actor_completely_joined(BasicTile* self,
                                               Level* level,
                                               Actor* actor) {
  if (is_ghost(actor))
    return;
  if (green_bomb_is_chip(self, level)) {
    if (has_flag(actor, ACTOR_FLAGS_REAL_PLAYER)) {
      if (level->chips_left > 0) {
        level->chips_left -= 1;
      }
      BasicTile_erase(self);
    }
  } else {
    Actor_destroy(actor, level, &EXPLOSION_actor);
    BasicTile_erase(self);
  }
}

const TileType GREEN_BOMB_tile = {
    .name = "greenBomb",
    .layer = LAYER_ITEM,
    .impedes = GREEN_BOMB_impedes,
    .actor_completely_joined = GREEN_BOMB_actor_completely_joined};
