#include "tiles.h"
#include <assert.h>
#include <math.h>
#include <stdbool.h>
#include "logic.h"
#include "misc.h"

// Terrain
//

int8_t compare_wire_membs_in_reading_order_unconst(void* ctx,const WireNetworkMember* val) {
 return compare_wire_membs_in_reading_order(ctx,val);
}

static WireNetwork* tile_find_network(Level* level,
                                      Position pos,
                                      uint8_t wires,
                                      WireNetworkMember** out_memb) {
  for_vector(WireNetwork*, network, &level->wire_networks) {
    WireNetworkMember* found_memb = Vector_WireNetworkMember_binary_search(
        &network->members,
            compare_wire_membs_in_reading_order_unconst,
        (void*)&pos);
    if (!found_memb)
      continue;
    if (!(found_memb->wires & wires))
      continue;
    if (out_memb) {
      *out_memb = found_memb;
    }
    return network;
  }
  return NULL;
}

#define is_ghost(actor) has_flag(actor, ACTOR_FLAGS_GHOST)
#define get_dir_bit(dir) (1 << dir_to_cc2(dir))

static bool impedes_non_ghost(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction _dir) {
  return !is_ghost(actor);
}

static void FLOOR_on_idle(BasicTile* self, Level* level, Actor* actor) {
  if (compiler_expect_prob(!self->custom_data, true, .99))
    return;
  if (compiler_expect_prob(
          !has_item_counter(actor->inventory, ITEM_INDEX_LIGHTNING_BOLT), true,
          .99))
    return;
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  if (!cell->is_wired)
    return;
  Position pos = Level_pos_from_cell(level, cell);
  if ((self->custom_data & 0xf) == 0xf) {
    WireNetwork* network1 = tile_find_network(level, pos, 0b0101, NULL);
    WireNetwork* network2 = tile_find_network(level, pos, 0b1010, NULL);
    // `network1 == network2` may be true if both wires are connected at another
    // tile
    assert(network1 != NULL);
    assert(network2 != NULL);
    network1->force_power_this_subtick = true;
    network2->force_power_this_subtick = true;
  } else {
    WireNetwork* network = tile_find_network(level, pos, 0xf, NULL);
    assert(network != NULL);
    network->force_power_this_subtick = true;
  }
}

// FLOOR: `custom_data` indicates wires
const TileType FLOOR_tile = {.name = "floor",
                             .layer = LAYER_TERRAIN,
                             .wire_type = WIRES_CROSS,
                             .on_idle = FLOOR_on_idle};

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
const TileType STEEL_WALL_tile = {.name = "steelWall",
                                  .layer = LAYER_TERRAIN,
                                  .flags = ACTOR_FLAGS_DYNAMITE_IMMUNE,
                                  .impedes_mask = ~0,
                                  .wire_type = WIRES_CROSS};

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
  if (!is_ghost(other) &&
      (has_item_counter(other->inventory, ITEM_INDEX_ICE_BOOTS) ||
       has_flag(other, ACTOR_FLAGS_MELINDA)))
    return;
  other->sliding_state = SLIDING_STRONG;
}

static void force_on_join(BasicTile* self,
                          Level* level,
                          Actor* other,
                          Direction _direction) {
  if (is_ghost(other))
    return;
  if (has_item_counter(other->inventory, ITEM_INDEX_FORCE_BOOTS))
    return;
  other->sliding_state = SLIDING_WEAK;
}

static void ice_on_complete_join(BasicTile* self, Level* level, Actor* other) {
  if (is_ghost(other))
    return;
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
  actor->sliding_state = SLIDING_STRONG;
  actor->direction = back(actor->direction);
  Actor_move_to(actor, level, actor->direction);
}

// ICE_CORNER: `custom_data` indicates direction of the corner
static void ICE_CORNER_on_idle(BasicTile* self, Level* level, Actor* actor) {
  if (has_item_counter(actor->inventory, ITEM_INDEX_ICE_BOOTS))
    return;
  if (has_flag(actor, ACTOR_FLAGS_MELINDA)) {
    if (actor->bonked)
      Actor_enter_tile(actor, level);
    return;
  }
  if (is_ghost(actor)) {
    ICE_on_idle(self, level, actor);
    return;
  }
  if (actor->bonked) {
    actor->sliding_state = SLIDING_STRONG;
    actor->direction = back(actor->direction);
  }
  // I don't know how this works. sorry
  actor->direction =
      right_n(self->custom_data, 7 + self->custom_data - actor->direction);
  if (actor->bonked) {
    Actor_move_to(actor, level, actor->direction);
  }
}
// NOTE: `direction` means no impede, `DIRECTION_NONE` means impede, so take
// note that ICE_CORNER_redirect_exit is the opposite of ICE_CORNER_impedes
static Direction ICE_CORNER_redirect_exit(BasicTile* self,
                                          Level* level,
                                          Actor* actor,
                                          Direction direction) {
  if (is_ghost(actor))
    return direction;
  return direction == self->custom_data || direction == right(self->custom_data)
             ? DIRECTION_NONE
             : direction;
}
static bool ICE_CORNER_impedes(BasicTile* self,
                               Level* level,
                               Actor* actor,
                               Direction direction) {
  if (is_ghost(actor))
    return false;
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
  if (Actor_is_gone(actor))
    return;
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

static void FORCE_FLOOR_on_wire_high(BasicTile* self,
                                     Level* level,
                                     bool _real) {
  self->custom_data = back(self->custom_data);
}

const TileType FORCE_FLOOR_tile = {
    .name = "forceFloor",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_READ,
    .flags = ACTOR_FLAGS_FORCE_FLOOR,
    .on_wire_high = FORCE_FLOOR_on_wire_high,
    .on_idle = FORCE_FLOOR_on_idle,
    .actor_joined = force_on_join,
    .actor_completely_joined = force_on_complete_join,
    .modify_move_duration = force_modify_move_duration};

const TileType FORCE_FLOOR_RANDOM_tile = {
    .name = "forceFloorRandom",
    .layer = LAYER_TERRAIN,
    .flags = ACTOR_FLAGS_FORCE_FLOOR,
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
  if (is_ghost(actor))
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

static bool WATER_impedes(BasicTile* self,
                          Level* level,
                          Actor* actor,
                          Direction dir) {
  return is_ghost(actor) &&
         !has_item_counter(actor->inventory, ITEM_INDEX_WATER_BOOTS);
}

const TileType WATER_tile = {
    .name = "water",
    .layer = LAYER_TERRAIN,
    .impedes = WATER_impedes,
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

// FLAME_JET: lowest bit of `custom_data` indicates if the jet is on

static void flip_state_on_wire_change(BasicTile* self,
                                      Level* level,
                                      bool _real) {
  bool was_on = self->custom_data & 1;
  self->custom_data &= ~1;
  self->custom_data |= was_on ? 0 : 1;
}

static void FLAME_JET_actor_idle(BasicTile* self, Level* level, Actor* actor) {
  if (has_item_counter(actor->inventory, ITEM_INDEX_FIRE_BOOTS) ||
      actor->type == &FIREBALL_actor || actor->type == &DIRT_BLOCK_actor)
    return;
  if (!(self->custom_data & 1))
    return;
  Actor_destroy(actor, level, &EXPLOSION_actor);
}
const TileType FLAME_JET_tile = {.name = "flameJet",
                                 .layer = LAYER_TERRAIN,
                                 .wire_type = WIRES_READ,
                                 .on_wire_high = flip_state_on_wire_change,
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
                                   .wire_type = WIRES_READ,
                                   .on_wire_high = flip_state_on_wire_change,
                                   .impedes = TOGGLE_WALL_impedes};

static bool HOLD_WALL_impedes(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction _dir) {
  if (is_ghost(actor))
    return false;
  return self->custom_data;
}

const TileType HOLD_WALL_tile = {.name = "holdWall",
                                 .layer = LAYER_TERRAIN,
                                 .wire_type = WIRES_READ,
                                 .on_wire_high = flip_state_on_wire_change,
                                 .on_wire_low = flip_state_on_wire_change,
                                 .impedes = HOLD_WALL_impedes};

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

enum { TP_ACTOR_JUST_JOINED = 0x100 };

static void teleport_set_just_joined(BasicTile* self,
                                     Level* level,
                                     Actor* actor) {
  self->custom_data |= TP_ACTOR_JUST_JOINED;
}

static void teleport_red_do_teleport(BasicTile* self,
                                     Level* level,
                                     Actor* actor) {
  Cell* this_cell = Level_get_cell(level, actor->position);
  actor->sliding_state = SLIDING_WEAK;
  if ((self->custom_data & 0xf) && this_cell->is_wired &&
      !this_cell->powered_wires)
    return;
  Cell* init_cell = Level_get_cell(level, actor->position);
  Cell* next_cell = init_cell;
  Cell* last_cell = next_cell;
  while (true) {
    next_cell = Level_search_reading_order(
        level, next_cell, false, search_for_type, (void*)&TELEPORT_RED_tile);
    // No other teleports (left) in the level, nothing to do here
    if (next_cell == NULL)
      return;
    // We're back where we started, give up
    // NOTE: Red teleports fail before trying all directions on themselves,
    // green teleports try all dirs on themselves before failing
    if (next_cell == init_cell)
      break;
    // Ignore teleports which are already busy with an actor on top of them
    if (next_cell->actor != NULL)
      continue;
    // Unpowered red TP
    if (next_cell->is_wired && !next_cell->powered_wires &&
        (next_cell->terrain.custom_data & 0xf))
      continue;
    last_cell->actor = NULL;
    last_cell = next_cell;
    // Move the actor to the next potential tile
    next_cell->actor = actor;
    actor->position = Level_pos_from_cell(level, next_cell);
    for (uint8_t dir_offset = 0; dir_offset < 4; dir_offset += 1) {
      Direction dir = right_n(actor->direction, dir_offset);
      if (Actor_check_collision(actor, level, &dir)) {
        actor->direction = dir;
        return;
      }
    }
  }
  last_cell->actor = NULL;
  next_cell->actor = actor;
  actor->position = Level_pos_from_cell(level, next_cell);
}

static void teleport_actor_idle(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                void (*teleport_actor_fn)(BasicTile* self,
                                                          Level* level,
                                                          Actor* actor)) {
  if (self->custom_data & TP_ACTOR_JUST_JOINED) {
    self->custom_data &= ~TP_ACTOR_JUST_JOINED;
    teleport_actor_fn(self, level, actor);
    return;
  }
  if (!actor->bonked)
    return;
  actor->sliding_state = SLIDING_NONE;
  if (actor->type == &BOWLING_BALL_ROLLING_actor) {
    // I don't know
    Actor_destroy(actor, level, &EXPLOSION_actor);
  }
}
static void TELEPORT_RED_actor_idle(BasicTile* self,
                                    Level* level,
                                    Actor* actor) {
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  // If this is a player, give them a free override
  if (has_flag(actor, ACTOR_FLAGS_REAL_PLAYER)) {
    actor->custom_data |= PLAYER_HAS_OVERRIDE;
  }
  if (cell->is_wired && (self->custom_data & 0xf) && !cell->powered_wires) {
    // If an actor joined us and we're powered off, don't try to teleport the
    // actor when we do get powered on
    self->custom_data &= ~TP_ACTOR_JUST_JOINED;
    return;
  }
  teleport_actor_idle(self, level, actor, teleport_red_do_teleport);
}

const TileType TELEPORT_RED_tile = {
    .name = "teleportRed",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_UNCONNECTED,
    .actor_joined = weak_teleport_actor_joined,
    .actor_completely_joined = teleport_set_just_joined,
    .on_idle = TELEPORT_RED_actor_idle};

static void strong_teleport_actor_joined(BasicTile* self,
                                         Level* level,
                                         Actor* actor,
                                         Direction direction) {
  actor->sliding_state = SLIDING_STRONG;
}

static bool blue_tp_is_target_in_an_earlier_network_than_this_pos(
    Level* level,
    Position this_pos,
    Position target_pos) {
  for_vector(WireNetwork*, network, &level->wire_networks) {
    // If the first member (the earliest one in reading order, since we iterated
    // on cells in reading order when tracing, and thus if there could have been
    // any cell before us in reading order also part of our network, the network
    // would've been traced from that cell and not us) is later in RO than us,
    // this network comes completely after us in RO, which we have to skip
    if (compare_pos_in_reading_order(&network->members.items[0].pos,
                                     &this_pos) > 0)
      return false;

    // By the way, all network members are also sorted in reading order after
    // the fact, just to speed this (and other member lookups) up, but the
    // first-member-is-first-in-RO-and-earliest-among-all-future-networks
    // property holds regardless of us sorting it
    WireNetworkMember* found_memb = Vector_WireNetworkMember_binary_search(
        &network->members,
            compare_wire_membs_in_reading_order_unconst,
        (void*)&target_pos);
    if (found_memb)
      return true;
  }
  // This function should only be called when the cell at `target_pos` is
  // `is_wired`, and thus must be an a wire network, all of which we have now
  // iterated over
  assert(false);
  return false;
}

// WTD: Wired Teleportation Destination (wired blue TPs and logic gates)

static uint8_t logic_gate_get_output_wire(const BasicTile* self) {
  uint8_t wires = self->custom_data & 0xf;
  if (wires == 0b1011)
    return 0b0001;
  if (wires == 0b0111)
    return 0b0010;
  if (wires == 0b1110)
    return 0b0100;
  if (wires == 0b1101)
    return 0b1000;
  if (wires == 0b1111)
    return 0b1000;
  bool not_gate_bottom_left = self->custom_data & 0b10000;
  if (wires == 0b0101)
    return not_gate_bottom_left ? 0b0100 : 0b0001;
  if (wires == 0b1010)
    return not_gate_bottom_left ? 0b1000 : 0b0010;
  assert(false);
  return 0;
}

enum { LOGIC_GATE_IS_BUSY = 0x800 };

static Actor* logic_gate_find_actor(const BasicTile* self, Level* level) {
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Position this_pos = Level_pos_from_cell(level, cell);
  for (size_t idx = 0; idx < level->actors_allocated_n; idx += 1) {
    Actor* actor = level->actors[idx];
    if (actor->position.x != this_pos.x || actor->position.y != this_pos.y)
      continue;
    if (actor->frozen)
      return actor;
  }
  return NULL;
}

static bool wtd_is_wtd(const BasicTile* self) {
  return self->type == &TELEPORT_BLUE_tile || self->type == &LOGIC_GATE_tile;
}
static bool wtd_is_busy(BasicTile* self, Level* level) {
  if (self->type == &TELEPORT_BLUE_tile) {
    Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
    return cell->actor;
  } else if (self->type == &LOGIC_GATE_tile) {
    return self->custom_data & LOGIC_GATE_IS_BUSY;
  }
  // This function is only supposed to be for WTDs
  assert(false);
  return true;
}
static void wtd_remove_actor(BasicTile* self, Level* level, Actor* actor) {
  if (self->type == &TELEPORT_BLUE_tile) {
    Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
    assert(cell->actor == actor);
    cell->actor = NULL;
    return;
  } else if (self->type == &LOGIC_GATE_tile) {
    actor->frozen = false;
    self->custom_data &= ~LOGIC_GATE_IS_BUSY;
    return;
  }
  assert(false);
}
static void wtd_add_actor(BasicTile* self, Level* level, Actor* actor) {
  if (self->type == &TELEPORT_BLUE_tile) {
    Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
    assert(cell->actor == NULL);
    cell->actor = actor;
    actor->position = Level_pos_from_cell(level, cell);
    actor->sliding_state = SLIDING_STRONG;
    return;
  } else if (self->type == &LOGIC_GATE_tile) {
    Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
    actor->frozen = true;
    actor->position = Level_pos_from_cell(level, cell);
    self->custom_data |= LOGIC_GATE_IS_BUSY;
    return;
  }
  assert(false);
}

static bool wtd_can_host(BasicTile* self, Level* level, Actor* actor) {
  if (self->type == &TELEPORT_BLUE_tile) {
    // FIXME: This collision check ignores pulls in notcc.js, but Pullcrap had a
    // desync regarding teleports and pulling actors, so maybe not disabling
    // pulling is right?

    // Giving a reference to a real direction doesn't matter, there's not going
    // to be a railroad on the cell
    return Actor_check_collision(actor, level, &actor->direction);
  } else if (self->type == &LOGIC_GATE_tile) {
    Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
    uint8_t out_wire = logic_gate_get_output_wire(self);
    return cell->powered_wires & out_wire;
  }
  assert(false);
  return false;
}

// For wired blue TPs and logic gates
static void wtd_do_teleport(BasicTile* self,
                            Level* level,
                            WireNetwork* tp_network,
                            WireNetworkMember* memb,
                            Actor* actor) {
  BasicTile* last_wtd = self;

  assert(tp_network != NULL);
  assert(memb != NULL);
  assert(memb >= &tp_network->members.items[0]);
  size_t network_size = tp_network->members.length;
  size_t starting_idx = memb - tp_network->members.items;
  for (size_t network_memb_offset_idx = 1;
       network_memb_offset_idx < network_size; network_memb_offset_idx += 1) {
    size_t idx =
        (network_size + starting_idx - network_memb_offset_idx) % network_size;
    Cell* memb_cell = Level_get_cell(level, tp_network->members.items[idx].pos);
    BasicTile* new_wtd = &memb_cell->terrain;
    if (!wtd_is_wtd(new_wtd) || wtd_is_busy(new_wtd, level))
      continue;
    wtd_remove_actor(last_wtd, level, actor);
    last_wtd = new_wtd;
    wtd_add_actor(new_wtd, level, actor);
    if (wtd_can_host(new_wtd, level, actor)) {
      return;
    }
  }
  // We didn't find any valid exit, just go through us again
  wtd_remove_actor(last_wtd, level, actor);
  wtd_add_actor(self, level, actor);
}

static void blue_tp_do_unwired_tp(BasicTile* self, Level* level, Actor* actor) {
  Cell* this_cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Cell* new_cell = this_cell;
  Position this_pos = Level_pos_from_cell(level, new_cell);
  Cell* last_cell = new_cell;
  Position last_unwired_pos = this_pos;
  Position last_unwired_prewrapped_pos;
  bool found_wrap_pos = false;
  bool crash_if_tp_into_wired = false;
  while (true) {
    new_cell = Level_search_reading_order(
        level, new_cell, true, search_for_type, (void*)&TELEPORT_BLUE_tile);
    // No other teleports (left) in the level, nothing to do here
    if (new_cell == NULL)
      return;
    Position new_pos = Level_pos_from_cell(level, new_cell);
    if (!found_wrap_pos) {
      if (compare_pos_in_reading_order(&new_pos, &last_unwired_pos) > 0) {
        last_unwired_prewrapped_pos = last_unwired_pos;
        found_wrap_pos = true;
        crash_if_tp_into_wired = true;
      }
   if(!new_cell->is_wired) {
      last_unwired_pos = new_pos;
   }
    }
    // We're back where we started, give up
    if (new_cell == this_cell)
      break;
    BasicTile* teleport = &new_cell->terrain;
    compiler_expect(teleport->type == &TELEPORT_BLUE_tile, true);
    // Ignore teleports which are already busy with an actor on top of them
    if (wtd_is_busy(teleport, level))
      continue;
    if (new_cell->is_wired) {
      if (!crash_if_tp_into_wired)
        continue;
      crash_if_tp_into_wired = false;
      if (blue_tp_is_target_in_an_earlier_network_than_this_pos(
              level, last_unwired_prewrapped_pos, new_pos)) {
        crash_if_tp_into_wired = true;
        continue;
      }
      // Very dumb behavior in CC2 here, just crash.
      Level_add_glitch(
          level,
          (Glitch){.glitch_kind = GLITCH_TYPE_BLUE_TELEPORT_INFINITE_LOOP,
                   .location = new_pos});
      return;
    }
    crash_if_tp_into_wired = false;
    // Move the actor to the next potential tile
    compiler_expect(last_cell->terrain.type == &TELEPORT_BLUE_tile, true);
    wtd_remove_actor(&last_cell->terrain, level, actor);
    last_cell = new_cell;
    wtd_add_actor(teleport, level, actor);
    // If this is a valid exit tile, leave the actor on it
    if (wtd_can_host(teleport, level, actor))
      return;
  }
  // We couldn't find any other place to put the actor, add it back to ourselves
  wtd_remove_actor(&last_cell->terrain, level, actor);
  wtd_add_actor(self, level, actor);
}

static void teleport_blue_do_teleport(BasicTile* self,
                                      Level* level,
                                      Actor* actor) {
  Cell* this_cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  if (this_cell->is_wired) {
    Position this_pos = Level_pos_from_cell(level, this_cell);
    WireNetworkMember* network_memb = NULL;
    // XXX: Maybe do this at prepare-time, or at least cache the network index
    // once we look it up?
    WireNetwork* network =
        tile_find_network(level, this_pos, 0xf, &network_memb);
    wtd_do_teleport(self, level, network, network_memb, actor);
  } else {
    blue_tp_do_unwired_tp(self, level, actor);
  }
}

static void TELEPORT_BLUE_actor_idle(BasicTile* self,
                                     Level* level,
                                     Actor* actor) {
  teleport_actor_idle(self, level, actor, teleport_blue_do_teleport);
}

const TileType TELEPORT_BLUE_tile = {
    .name = "teleportBlue",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_EVERYWHERE,
    .actor_joined = strong_teleport_actor_joined,
    .actor_completely_joined = teleport_set_just_joined,
    .on_idle = TELEPORT_BLUE_actor_idle};

static void teleport_green_do_teleport(BasicTile* self,
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
  this_cell->actor = NULL;
  while (true) {
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
    if (next_cell == this_cell) {
      // We've come back to our original cell, give up
      return;
    }
    for (uint8_t dir_offset = 0; dir_offset < 4; dir_offset += 1) {
      Direction dir = right_n(exit_dir, dir_offset);
      if (Actor_check_collision(actor, level, &dir)) {
        actor->direction = dir;
        return;
      }
    }
    next_cell->actor = NULL;
  }
}

static void TELEPORT_GREEN_actor_idle(BasicTile* self,
                                      Level* level,
                                      Actor* actor) {
  teleport_actor_idle(self, level, actor, teleport_green_do_teleport);
}

const TileType TELEPORT_GREEN_tile = {
    .name = "teleportGreen",
    .layer = LAYER_TERRAIN,
    .actor_joined = strong_teleport_actor_joined,
    .actor_completely_joined = teleport_set_just_joined,
    .on_idle = TELEPORT_GREEN_actor_idle};

enum { YELLOW_TP_IS_ONLY_TP_IN_LEVEL = 0x1000 };

static void teleport_yellow_init(BasicTile* self, Level* level, Cell* cell) {
  Cell* other_tp_cell = Level_search_reading_order(
      level, cell, true, search_for_type, (void*)&TELEPORT_YELLOW_tile);
  if (!other_tp_cell) {
    self->custom_data |= YELLOW_TP_IS_ONLY_TP_IN_LEVEL;
  }
}

static void teleport_yellow_do_teleport(BasicTile* self,
                                        Level* level,
                                        Actor* actor) {
  if (has_flag(actor, ACTOR_FLAGS_REAL_PLAYER)) {
    actor->custom_data |= PLAYER_HAS_OVERRIDE;
  }
  actor->sliding_state = SLIDING_WEAK;
  Cell* this_cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Cell* next_cell = this_cell;
  this_cell->actor = NULL;
  while (true) {
    next_cell = Level_search_reading_order(
        level, next_cell, true, search_for_type, (void*)&TELEPORT_YELLOW_tile);
    if (next_cell == NULL)
      break;
    if (next_cell->actor && next_cell != this_cell)
      continue;
    next_cell->actor = actor;
    actor->position = Level_pos_from_cell(level, next_cell);
    if (next_cell == this_cell)
      break;
    if (Actor_check_collision(actor, level, &actor->direction)) {
      return;
    }
    next_cell->actor = NULL;
  }
  this_cell->actor = actor;
  // Don't give us to the player if we're the only yellow teleport in the whole
  // level
  if ((self->custom_data & YELLOW_TP_IS_ONLY_TP_IN_LEVEL))
    return;
  if (has_flag(actor, ACTOR_FLAGS_IGNORES_ITEMS))
    return;
  // Can't be picked up if there's a no sign on us
  if (this_cell->item_mod.type &&
      this_cell->item_mod.type->overrides_item_layer(&this_cell->item_mod,
                                                     level, self))
    return;
  bool picked_up = Actor_pickup_item(actor, level, self);
  if (picked_up) {
    actor->sliding_state = SLIDING_NONE;
  }
}

static void TELEPORT_YELLOW_actor_idle(BasicTile* self,
                                       Level* level,
                                       Actor* actor) {
  teleport_actor_idle(self, level, actor, teleport_yellow_do_teleport);
}

const TileType TELEPORT_YELLOW_tile = {
    .name = "teleportYellow",
    .layer = LAYER_TERRAIN,
    .flags = ACTOR_FLAGS_ITEM,
    .actor_joined = weak_teleport_actor_joined,
    .actor_completely_joined = teleport_set_just_joined,
    .on_idle = TELEPORT_YELLOW_actor_idle,
    .item_index = ITEM_INDEX_YELLOW_TP};

static void SLIME_actor_completely_joined(BasicTile* self,
                                          Level* level,
                                          Actor* actor) {
  if (is_ghost(actor) || actor->type == &BLOB_actor)
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

enum { TRAP_OPENED = 1, TRAP_OPEN_REQUESTS = ~1 };

static inline bool is_controlled_by_trap(Actor* actor) {
  return !has_flag(actor, ACTOR_FLAGS_GHOST | ACTOR_FLAGS_REAL_PLAYER);
}

static void trap_increment_opens(BasicTile* self, Level* level, Cell* cell) {
  if (self->type != &TRAP_tile)
    return;
  self->custom_data += 2;
  if ((self->custom_data & TRAP_OPENED) == 0) {
    self->custom_data |= TRAP_OPENED;
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
  if ((self->custom_data & TRAP_OPEN_REQUESTS) == 0)
    return;
  self->custom_data -= 2;
  if ((self->custom_data & TRAP_OPEN_REQUESTS) == 0) {
    self->custom_data = 0;
    if (cell->actor && is_controlled_by_trap(cell->actor)) {
      cell->actor->frozen = true;
    }
  }
}
static void trap_control_actor(BasicTile* self, Level* level, Actor* actor) {
  if (!is_controlled_by_trap(actor) || (self->custom_data & TRAP_OPENED))
    return;
  actor->frozen = true;
}
static void TRAP_init(BasicTile* self, Level* level, Cell* cell) {
  if (cell->actor) {
    trap_control_actor(self, level, cell->actor);
  }
}
static void TRAP_receive_power(BasicTile* self, Level* level, uint8_t power) {
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  if (!cell->is_wired)
    return;
  // NOTE: We intentionally don't respect open requests OR try to eject the
  // actor here if we're now open
  self->custom_data &= ~TRAP_OPENED;
  self->custom_data |= power ? TRAP_OPENED : 0;
  if (cell->actor && is_controlled_by_trap(cell->actor)) {
    cell->actor->frozen = !power;
  }
}

static Direction TRAP_redirect_exit(BasicTile* self,
                                    Level* level,
                                    Actor* actor,
                                    Direction direction) {
  if (!(self->custom_data & TRAP_OPENED) && !is_ghost(actor))
    return DIRECTION_NONE;
  return direction;
}

const TileType TRAP_tile = {.name = "trap",
                            .layer = LAYER_TERRAIN,
                            .actor_completely_joined = trap_control_actor,
                            .receive_power = TRAP_receive_power,
                            .init = TRAP_init,
                            .redirect_exit = TRAP_redirect_exit,
                            .wire_type = WIRES_READ};

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
static bool clone_machine_try_dir(Actor* actor, Level* level, Direction dir) {
  return Actor_check_collision(actor, level, &dir) &&
         Actor_move_to(actor, level, dir);
}
static void clone_machine_trigger(BasicTile* self,
                                  Level* level,
                                  bool try_all_dirs) {
  if (self->type != &CLONE_MACHINE_tile)
    return;
  Actor* actor = BasicTile_get_cell(self, LAYER_TERRAIN)->actor;
  // Someone triggered an empty clone machine
  if (actor == NULL)
    return;
  if (Actor_is_moving(actor))
    return;
  actor->frozen = false;
  Direction og_actor_dir = actor->direction;
  Actor* new_actor = NULL;
  Position this_pos = actor->position;
  if (!actor)
    return;
#define release_actor() \
  new_actor = Actor_new(level, actor->type, this_pos, actor->direction);

  actor->sliding_state = SLIDING_STRONG;
  if (clone_machine_try_dir(actor, level, og_actor_dir)) {
    release_actor()
  } else if (try_all_dirs) {
    if (clone_machine_try_dir(actor, level, right(og_actor_dir))) {
      release_actor()
    } else if (clone_machine_try_dir(actor, level, back(og_actor_dir))) {
      release_actor()
    } else if (clone_machine_try_dir(actor, level, left(og_actor_dir))) {
      release_actor()
    } else {
      actor->direction = og_actor_dir;
      actor->sliding_state = SLIDING_NONE;
    }
  } else {
    actor->sliding_state = SLIDING_NONE;
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
    .wire_type = WIRES_READ,
    .actor_completely_joined = clone_machine_control_actor,
    .init = CLONE_MACHINE_init,
    .on_wire_high = clone_machine_trigger,
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
    if (other->inventory.keys_##simple == 0)                                   \
      return;                                                                  \
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
  clone_machine_trigger(&clone_machine_cell->terrain, level, false);
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

enum { BUTTON_PURPLE_SHOULD_POWER = 0b10000 };

// BUTTON_PURPLE: lowest four bits indicate wires, 5th bit indicates if there
// was an actor on us this subtick
static void BUTTON_PURPLE_on_idle(BasicTile* self, Level* level, Actor* actor) {
  self->custom_data |= BUTTON_PURPLE_SHOULD_POWER;
}
static uint8_t BUTTON_PURPLE_give_power(BasicTile* self, Level* level) {
  bool should_power = self->custom_data & BUTTON_PURPLE_SHOULD_POWER;
  self->custom_data &= ~BUTTON_PURPLE_SHOULD_POWER;
  return should_power ? 0xf : 0;
}

const TileType BUTTON_PURPLE_tile = {.name = "buttonPurple",
                                     .layer = LAYER_TERRAIN,
                                     .wire_type = WIRES_UNCONNECTED,
                                     .on_idle = BUTTON_PURPLE_on_idle,
                                     .give_power = BUTTON_PURPLE_give_power};

// BUTTON_BLACK, TOGGLE_SWITCH: Lowest 4 bits indicate wires, 5th indicates if
// there should be pwoer (modulo the actor being destroyed), 6th indicates if
// the 5th bit was set last subtick, which is what power emission actually
// depends on
enum {
  POWER_BUTTON_SHOULD_BE_POWERED = 1 << 4,
  POWER_BUTTON_WILL_BE_POWERED = 1 << 5
};

static uint8_t power_button_give_power(BasicTile* self, Level* level) {
  bool should_power = self->custom_data & POWER_BUTTON_WILL_BE_POWERED;
  self->custom_data &= ~POWER_BUTTON_WILL_BE_POWERED;
  self->custom_data |= (self->custom_data & POWER_BUTTON_SHOULD_BE_POWERED)
                           ? POWER_BUTTON_WILL_BE_POWERED
                           : 0;
  return should_power ? 0xf : 0;
}

static void BUTTON_BLACK_init(BasicTile* self, Level* level, Cell* cell) {
  if (cell->actor) {
    self->custom_data &= ~POWER_BUTTON_SHOULD_BE_POWERED;
  }
}

static void BUTTON_BLACK_actor_completely_joined(BasicTile* self,
                                                 Level* level,
                                                 Actor* actor) {
  self->custom_data &= ~POWER_BUTTON_SHOULD_BE_POWERED;
}
static void BUTTON_BLACK_actor_left(BasicTile* self,
                                    Level* level,
                                    Actor* actor,
                                    Direction _dir) {
  // Hack: If a bowling ball was rolled from this tile, don't become unpressed
  // because an actor will be on us again in just a moment
  if (actor->type == &BOWLING_BALL_ROLLING_actor && actor->custom_data & 1)
    return;
  self->custom_data |= POWER_BUTTON_SHOULD_BE_POWERED;
}
const TileType BUTTON_BLACK_tile = {
    .name = "buttonBlack",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_ALWAYS_CROSS,
    .init = BUTTON_BLACK_init,
    .give_power = power_button_give_power,
    .actor_completely_joined = BUTTON_BLACK_actor_completely_joined,
    .actor_left = BUTTON_BLACK_actor_left};

static void TOGGLE_SWITCH_actor_completely_joined(BasicTile* self,
                                                  Level* level,
                                                  Actor* cell) {
  if (self->custom_data & POWER_BUTTON_SHOULD_BE_POWERED) {
    self->custom_data &= ~POWER_BUTTON_SHOULD_BE_POWERED;
  } else {
    self->custom_data |= POWER_BUTTON_SHOULD_BE_POWERED;
  }
}

const TileType TOGGLE_SWITCH_tile = {
    .name = "toggleSwitch",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_UNCONNECTED,
    .give_power = power_button_give_power,
    .actor_completely_joined = TOGGLE_SWITCH_actor_completely_joined,
};

static void BUTTON_GRAY_actor_completely_joined(BasicTile* self,
                                                Level* level,
                                                Actor* actor) {
  Cell* this_cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Position this_pos = Level_pos_from_cell(level, this_cell);
  for (int8_t dy = -2; dy <= 2; dy += 1) {
    if (this_pos.y < -dy || this_pos.y >= level->height - dy)
      continue;
    for (int8_t dx = -2; dx <= 2; dx += 1) {
      if (this_pos.x < -dx || this_pos.x >= level->width - dx)
        continue;
      Position pos = {this_pos.x + dx, this_pos.y + dy};
      Cell* cell = Level_get_cell(level, pos);
      if (cell->terrain.type->on_wire_high) {
        cell->terrain.type->on_wire_high(&cell->terrain, level, false);
      }
    }
  }
}

const TileType BUTTON_GRAY_tile = {
    .name = "buttonGray",
    .layer = LAYER_TERRAIN,
    .actor_completely_joined = BUTTON_GRAY_actor_completely_joined};

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
  if (is_ghost(actor))
    return;
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
  if (is_ghost(actor))
    return false;
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
  if (actor->type == &GLIDER_actor || is_ghost(actor))
    return;
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
  if (is_ghost(actor))
    return false;
  return dir == back(self->custom_data) || dir == left(self->custom_data);
}
static void SWIVEL_actor_left(BasicTile* self,
                              Level* level,
                              Actor* actor,
                              Direction dir) {
  if (is_ghost(actor))
    return;
  Direction self_dir = (Direction)self->custom_data;
  if (dir == self_dir)
    self->custom_data = right(self->custom_data);
  else if (dir == right(self_dir))
    self->custom_data = left(self->custom_data);
}
static void SWIVEL_on_wire_high(BasicTile* self, Level* level, bool _real) {
  self->custom_data = right(self->custom_data);
}
const TileType SWIVEL_tile = {.name = "swivel",
                              .layer = LAYER_TERRAIN,
                              .wire_type = WIRES_READ,
                              .on_wire_high = SWIVEL_on_wire_high,
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
static const TransmogEntry transmog_entries[] = {
    // Chip-Melinda
    {&CHIP_actor, &MELINDA_actor},
    {&MELINDA_actor, &CHIP_actor},
    {&MIRROR_CHIP_actor, &MIRROR_MELINDA_actor},
    {&MIRROR_MELINDA_actor, &MIRROR_CHIP_actor},
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
    const TransmogEntry* ent = &transmog_entries[idx];
    if (ent->key == type)
      return ent->val;
  }
  return NULL;
}

static void TRANSMOGRIFIER_actor_completely_joined(BasicTile* self,
                                                   Level* level,
                                                   Actor* actor) {
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  if (cell->is_wired && !cell->powered_wires)
    return;
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
    .wire_type = WIRES_READ,
    .actor_completely_joined = TRANSMOGRIFIER_actor_completely_joined};

// RAILROAD: `custom_data` indicates-- Oh boy. Just go check tiles.h for the
// RAILROAD_* enum
static void RAILROAD_actor_completely_joined(BasicTile* self,
                                             Level* level,
                                             Actor* actor) {
  self->custom_data = (self->custom_data & ~RAILROAD_ENTERED_DIR_MASK) |
                      (dir_to_cc2(actor->direction) << 12);
}
static uint8_t rr_get_relevant_tracks(Direction dir) {
  assert(dir != DIRECTION_NONE);
  if (dir == DIRECTION_UP)
    return RAILROAD_TRACK_UR | RAILROAD_TRACK_LU | RAILROAD_TRACK_UD;
  if (dir == DIRECTION_RIGHT)
    return RAILROAD_TRACK_UR | RAILROAD_TRACK_RD | RAILROAD_TRACK_LR;
  if (dir == DIRECTION_DOWN)
    return RAILROAD_TRACK_RD | RAILROAD_TRACK_DL | RAILROAD_TRACK_UD;
  if (dir == DIRECTION_LEFT)
    return RAILROAD_TRACK_DL | RAILROAD_TRACK_LU | RAILROAD_TRACK_LR;
  return 0;
}
static uint8_t rr_get_active_track_idx(uint64_t custom_data) {
  return (custom_data & RAILROAD_ACTIVE_TRACK_MASK) >> 8;
}
static uint8_t rr_get_available_tracks(uint64_t custom_data) {
  if (custom_data & RAILROAD_TRACK_SWITCH) {
    return (custom_data & RAILROAD_TRACK_MASK) &
           (1 << rr_get_active_track_idx(custom_data));
  }
  return custom_data & RAILROAD_TRACK_MASK;
}
static uint8_t rr_get_entered_track(uint64_t custom_data) {
  return dir_from_cc2((custom_data & RAILROAD_ENTERED_DIR_MASK) >> 12);
}
inline static bool rr_check_direction(BasicTile* self,
                                      Level* level,
                                      Actor* actor,
                                      Direction base_dir,
                                      uint8_t turn) {
  Direction dir = right_n(base_dir, turn);
  Direction entered_dir = rr_get_entered_track(self->custom_data);
  if (dir == back(entered_dir) && !has_flag(actor, ACTOR_FLAGS_BLOCK))
    return false;
  uint8_t valid_exits = rr_get_relevant_tracks(back(entered_dir)) &
                        rr_get_available_tracks(self->custom_data);
  uint8_t dir_exits = rr_get_relevant_tracks(dir);
  if (!(valid_exits & dir_exits))
    return false;
  if (actor->type->on_redirect) {
    actor->type->on_redirect(actor, level, turn);
  }
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  if (cell->special.type == &THIN_WALL_tile &&
      cell->special.custom_data & get_dir_bit(dir))
    return false;
  return true;
}
static Direction RAILROAD_redirect_exit(BasicTile* self,
                                        Level* level,
                                        Actor* actor,
                                        Direction dir) {
  if (is_ghost(actor))
    return dir;
  if (has_item_counter(actor->inventory, ITEM_INDEX_RR_SIGN))
    return dir;
  if (rr_check_direction(self, level, actor, dir, 0))
    return dir;
  if (rr_check_direction(self, level, actor, dir, 1))
    return right(dir);
  if (rr_check_direction(self, level, actor, dir, 3))
    return left(dir);
  if (rr_check_direction(self, level, actor, dir, 2))
    return back(dir);
  return DIRECTION_NONE;
}

static bool RAILROAD_impedes(BasicTile* self,
                             Level* level,
                             Actor* actor,
                             Direction dir) {
  if (is_ghost(actor))
    return false;
  if (has_item_counter(actor->inventory, ITEM_INDEX_RR_SIGN))
    return false;
  uint8_t enter_rails = rr_get_relevant_tracks(back(dir));
  return !(enter_rails & rr_get_available_tracks(self->custom_data));
}
enum { TRACKS_N = 6 };

static void rr_toggle_to_next_track(BasicTile* self) {
  uint8_t tracks = self->custom_data & RAILROAD_TRACK_MASK;
  // Find the next track
  uint8_t current_active_idx = rr_get_active_track_idx(self->custom_data);
  for (uint8_t offset = 1; offset < TRACKS_N; offset += 1) {
    uint8_t track_idx = (current_active_idx + offset) % TRACKS_N;
    uint8_t track_bit = 1 << track_idx;
    if (track_bit & tracks) {
      self->custom_data =
          (self->custom_data & ~RAILROAD_ACTIVE_TRACK_MASK) | (track_idx << 8);
      return;
    }
  }
}
static void RAILROAD_on_wire_high(BasicTile* self, Level* _level, bool _real) {
  rr_toggle_to_next_track(self);
}

static void RAILROAD_actor_left(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                Direction dir) {
  if (is_ghost(actor))
    return;
  if (!(self->custom_data & RAILROAD_TRACK_SWITCH))
    return;
  // The rail that we "followed" when we entered and exited this railroad tile
  uint8_t enter_exit_rail =
      rr_get_relevant_tracks(dir) &
      rr_get_relevant_tracks(back(rr_get_entered_track(self->custom_data)));
  // Note that if we exited the opposite direction we entered (possible with
  // blocks and anything with an RR sign), `enter_exit_rail` would have *three*
  // rails. For example: if you have a switching railroad with RD, DL, and UD
  // tracks, and go (with an RR sign) up onto and down off the tile repeatedly,
  // it will cycle between all three rails
  if (enter_exit_rail & rr_get_available_tracks(self->custom_data)) {
    Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
    if (cell->is_wired)
      return;
    rr_toggle_to_next_track(self);
  }
}

const TileType RAILROAD_tile = {
    .name = "railroad",
    .layer = LAYER_TERRAIN,
    .wire_type = WIRES_READ,
    .on_wire_high = RAILROAD_on_wire_high,
    .actor_completely_joined = RAILROAD_actor_completely_joined,
    .impedes = RAILROAD_impedes,
    .redirect_exit = RAILROAD_redirect_exit,
    .actor_left = RAILROAD_actor_left};

enum { LOGIC_GATE_STATE_BITMASK = 0x7ff };

static uint8_t normalize_wire_bits(uint8_t bits, Direction self_dir) {
  assert(self_dir != DIRECTION_NONE);
  if (self_dir == DIRECTION_UP)
    return bits;
  if (self_dir == DIRECTION_RIGHT)
    return ((bits >> 1) & 0b0111) | ((bits << 3) & 0b1000);
  if (self_dir == DIRECTION_DOWN)
    return ((bits >> 2) & 0b0011) | ((bits << 2) & 0b1100);
  if (self_dir == DIRECTION_LEFT)
    return ((bits << 1) & 0b1110) | ((bits >> 3) & 0b0001);
  assert(false);
  return 0;
}

static Direction logic_gate_get_direction(const BasicTile* self) {
  uint8_t wire_bits = self->custom_data & 0b1111;
  // Three-wire gates (AND, OR, XOR, NOR, latch, latch mirror)
  if (wire_bits == 0b1011)
    return DIRECTION_UP;
  if (wire_bits == 0b0111)
    return DIRECTION_RIGHT;
  if (wire_bits == 0b1110)
    return DIRECTION_DOWN;
  if (wire_bits == 0b1101)
    return DIRECTION_LEFT;
  uint8_t logic_gate_wire_state = self->custom_data & LOGIC_GATE_STATE_BITMASK;
  // Two-wire gate (NOT)
  if (logic_gate_wire_state == LOGIC_GATE_NOT_UP)
    return DIRECTION_UP;
  if (logic_gate_wire_state == LOGIC_GATE_NOT_RIGHT)
    return DIRECTION_RIGHT;
  if (logic_gate_wire_state == LOGIC_GATE_NOT_DOWN)
    return DIRECTION_DOWN;
  if (logic_gate_wire_state == LOGIC_GATE_NOT_LEFT)
    return DIRECTION_LEFT;
  // Four-wire gate (counter)
  if (wire_bits == 0b1111)
    return DIRECTION_UP;
  return DIRECTION_NONE;
}

static uint8_t LOGIC_GATE_give_power(BasicTile* self, Level* level) {
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Direction this_dir = logic_gate_get_direction(self);
  uint8_t powered = normalize_wire_bits(cell->powered_wires, this_dir);
  uint8_t powering = 0;
  uint8_t wires = self->custom_data & 0xf;
  if (wires == 0b0101 || wires == 0b1010) {
    // NOT gate
    powering = powered & 0b0100 ? 0 : 0b0001;
  } else if (wires == 0b1111) {
    // counter gate
    uint8_t value = (self->custom_data & 0xf0) >> 4;
    bool had_add = (self->custom_data & 0x100) >> 8;
    bool is_add = powered & 0b0010;
    bool had_sub = (self->custom_data & 0x200) >> 9;
    bool is_sub = powered & 0b0100;
    bool underflow = (self->custom_data & 0x400) >> 10;
    bool do_add = !had_add && is_add;
    bool do_sub = !had_sub && is_sub;
    if (do_add && do_sub) {
      underflow = false;
    } else if (do_add) {
      underflow = false;
      value += 1;
      if (value == 10) {
        value = 0;
        powering |= 0b1000;
      }
    } else if (do_sub) {
      underflow = value == 0;
      if (value == 0) {
        value = 9;
      } else {
        value -= 1;
      }
    }
    if (underflow) {
      powering |= 0b0001;
    }
    self->custom_data &= ~LOGIC_GATE_STATE_BITMASK;
    self->custom_data |= (underflow << 10) | (is_sub << 9) | (is_add << 8) |
                         (value << 4) | 0b1111;

  } else {
    // Three-wire gates
    uint8_t type_specifier =
        (self->custom_data & LOGIC_GATE_SPECIFIER_BITMASK) >> 4;
    uint8_t input_wires = powered & 0b1010;
    if (type_specifier == LOGIC_GATE_SPECIFIER_OR) {
      powering = input_wires ? 0b0001 : 0;
    } else if (type_specifier == LOGIC_GATE_SPECIFIER_AND) {
      powering = input_wires == 0b1010 ? 0b0001 : 0;
    } else if (type_specifier == LOGIC_GATE_SPECIFIER_NAND) {
      powering = input_wires == 0b1010 ? 0 : 0b0001;
    } else if (type_specifier == LOGIC_GATE_SPECIFIER_XOR) {
      powering = input_wires == 0b1000 || input_wires == 0b0010 ? 0b0001 : 0;
    } else if (type_specifier == LOGIC_GATE_SPECIFIER_LATCH ||
               type_specifier == LOGIC_GATE_SPECIFIER_LATCH_MIRROR) {
      bool is_mirrored = type_specifier == LOGIC_GATE_SPECIFIER_LATCH_MIRROR;
      bool memory = self->custom_data & 0x80;
      bool write = powered & (is_mirrored ? 0b1000 : 0b0010);
      bool written_value = powered & (is_mirrored ? 0b0010 : 0b1000);
      if (write) {
        memory = written_value;
        self->custom_data &= ~0x80;
        self->custom_data |= written_value ? 0x80 : 0;
      }
      powering = memory ? 0b0001 : 0;

    } else {
      assert(false && "Invalid logic gate type");
    }
  }
  return normalize_wire_bits(powering, mirror_vert(this_dir));
}

static void LOGIC_GATE_on_idle(BasicTile* self, Level* level, Actor* actor) {
  if (!(self->custom_data & LOGIC_GATE_IS_BUSY))
    return;
  if (!actor->frozen)
    return;
  Cell* cell = BasicTile_get_cell(self, LAYER_TERRAIN);
  Position this_pos = Level_pos_from_cell(level, cell);
  uint8_t out_wire = logic_gate_get_output_wire(self);
  WireNetworkMember* memb;
  WireNetwork* network = tile_find_network(level, this_pos, out_wire, &memb);
  wtd_do_teleport(self, level, network, memb, actor);
}

const TileType LOGIC_GATE_tile = {.name = "logicGate",
                                  .layer = LAYER_TERRAIN,
                                  .wire_type = WIRES_UNCONNECTED,
                                  .flags = ACTOR_FLAGS_DYNAMITE_IMMUNE,
                                  .on_idle = LOGIC_GATE_on_idle,
                                  .give_power = LOGIC_GATE_give_power};

// Actors

static void kill_player(Actor* self, Level* level, Actor* other) {
  if (!has_flag(other, ACTOR_FLAGS_REAL_PLAYER))
    return;
  if (has_item_counter(other->inventory, ITEM_INDEX_HELMET) ||
      has_item_counter(self->inventory, ITEM_INDEX_HELMET))
    return;
  if (self->pulled && other->pulling)
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
  Direction checked_dir = self->direction;
  if (Actor_check_collision(self, level, &checked_dir)) {
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
  if (other->type == &FIREBALL_actor && (cell->terrain.type == &FLOOR_tile ||
                                         cell->terrain.type == &WATER_tile)) {
    BasicTile_transform_into(&cell->terrain, &WATER_tile);
    Actor_destroy(self, level, &SPLASH_actor);
  }
}

const ActorType ICE_BLOCK_actor = {
    .name = "iceBlock",
    .flags = ACTOR_FLAGS_BLOCK | ACTOR_FLAGS_IGNORES_ITEMS |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_KILLS_PLAYER |
             ACTOR_FLAGS_REVEALS_HIDDEN,
    .can_be_pushed = cc2_block_can_be_pushed,
    .on_bump_actor = kill_player,
    .on_bumped_by = ICE_BLOCK_on_bumped_by};

static bool FRAME_BLOCK_can_be_pushed(Actor* self,
                                      Level* level,
                                      Actor* other,
                                      Direction dir) {
  if (!(self->custom_data & get_dir_bit(dir)))
    return false;
  return cc2_block_can_be_pushed(self, level, other, dir);
}
static uint8_t rotate_arrows_right(uint8_t arrows) {
  return ((arrows & 0x7) << 1) | ((arrows & 0x8) ? 1 : 0);
}

static void FRAME_BLOCK_on_redirect(Actor* self, Level* level, uint8_t turn) {
  while (turn > 0) {
    self->custom_data = rotate_arrows_right(self->custom_data);
    turn -= 1;
  }
}

const ActorType FRAME_BLOCK_actor = {
    .name = "frameBlock",
    .flags = ACTOR_FLAGS_BLOCK | ACTOR_FLAGS_IGNORES_ITEMS |
             ACTOR_FLAGS_CAN_PUSH | ACTOR_FLAGS_KILLS_PLAYER |
             ACTOR_FLAGS_REVEALS_HIDDEN,
    .can_be_pushed = FRAME_BLOCK_can_be_pushed,
    .on_bump_actor = kill_player,
    .on_redirect = FRAME_BLOCK_on_redirect,
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
    Direction checked_dir = dir;
    if (Actor_check_collision(self, level, &checked_dir)) {
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
  Cell_place_actor(cell, level, self);
  // XXX: does this happen before or after the explosion of other tiles? (could
  // potentially affect what happens to a lit dynamite with 0 cooldown)
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
  self->custom_data = 256;
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
  if (self->sliding_state)
    return;
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
MAKE_GENERIC_ITEM(RR_SIGN, "railroadSign", ITEM_INDEX_RR_SIGN);
MAKE_GENERIC_ITEM(BRIBE, "bribe", ITEM_INDEX_BRIBE);
MAKE_GENERIC_ITEM(SPEED_BOOTS, "bootSpeed", ITEM_INDEX_SPEED_BOOTS);
MAKE_GENERIC_ITEM(SECRET_EYE, "secretEye", ITEM_INDEX_SECRET_EYE);
MAKE_GENERIC_ITEM(HELMET, "helmet", ITEM_INDEX_HELMET);
MAKE_GENERIC_ITEM(LIGHTNING_BOLT, "lightningBolt", ITEM_INDEX_LIGHTNING_BOLT);
MAKE_GENERIC_ITEM(BOWLING_BALL, "bowlingBall", ITEM_INDEX_BOWLING_BALL);
MAKE_GENERIC_ITEM(HOOK, "hook", ITEM_INDEX_HOOK);

static void DYNAMITE_actor_left(BasicTile* self,
                                Level* level,
                                Actor* actor,
                                Direction dir) {
  if (!has_flag(actor, ACTOR_FLAGS_REAL_PLAYER))
    return;
  Cell* this_cell = BasicTile_get_cell(self, LAYER_ITEM);
  // We will be despawned immediately after this because the player will
  // null-out their after notifying us
  Actor* dynamite = Actor_new(level, &DYNAMITE_LIT_actor,
                              Level_pos_from_cell(level, this_cell), dir);
  dynamite->inventory = actor->inventory;
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
  if (self->custom_data & get_dir_bit(direction))
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
  if (self->custom_data & get_dir_bit(back(direction)))
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
