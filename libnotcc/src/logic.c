#include "logic.h"
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "accessors/define.h"
#include "assert.h"
#include "tiles.h"

_libnotcc_accessors_Inventory;

#define position_get_offset(pos, pitch) (pos.x + pos.y * pitch)

_libnotcc_accessors_LevelMetadata;

void LevelMetadata_init(LevelMetadata* self) {
  self->title = NULL;
  self->author = NULL;
  self->default_hint = NULL;
  self->hints = NULL;
  self->hints_n = 0;
  self->c2g_command = NULL;
  self->jetlife_interval = 0;
  self->rng_blob_4pat = false;
  self->rng_blob_deterministic = true;
  self->player_n = 1;
  self->camera_width = 10;
  self->camera_height = 10;
  self->wires_hidden = false;
  self->cc1_boots = false;
}

void LevelMetadata_uninit(LevelMetadata* self) {
  free(self->title);
  free(self->author);
  free(self->default_hint);
  for (uint32_t idx = 0; idx < self->hints_n; idx += 1) {
    free(self->hints[idx]);
  }
  free(self->hints);
  free(self->c2g_command);
}

LevelMetadata LevelMetadata_clone(const LevelMetadata* self) {
  LevelMetadata new_meta;
  memcpy(&new_meta, self, sizeof(LevelMetadata));
  new_meta.title = strdup(self->title);
  new_meta.author = strdup(self->author);
  new_meta.default_hint = strdup(self->default_hint);
  new_meta.hints = malloc(sizeof(char*) * new_meta.hints_n);
  for (uint32_t idx = 0; idx < new_meta.hints_n; idx += 1) {
    new_meta.hints[idx] = strdup(self->hints[idx]);
  }
  return new_meta;
}

_libnotcc_accessors_Level;

Position Level_get_neighbor(Level* self, Position pos, Direction dir) {
  uint8_t pitch = self->width;
  uint16_t position_offset = position_get_offset(pos, pitch);
  if (dir == DIRECTION_UP)
    position_offset -= pitch;
  if (dir == DIRECTION_RIGHT)
    position_offset += 1;
  if (dir == DIRECTION_DOWN)
    position_offset += pitch;
  if (dir == DIRECTION_LEFT)
    position_offset -= 1;
  Position new_pos = {.x = position_offset % pitch,
                      .y = position_offset / pitch};
  return new_pos;
}

bool Level_check_position_inbounds(Level* self,
                                   Position pos,
                                   Direction dir,
                                   bool wrap) {
  if (dir == DIRECTION_UP && pos.y == 0)
    return false;
  if (!wrap && dir == DIRECTION_RIGHT && pos.x == self->width)
    return false;
  if (dir == DIRECTION_DOWN && pos.y == self->height)
    return false;
  if (!wrap && dir == DIRECTION_LEFT && pos.x == 0)
    return false;
  return true;
}

Cell* Level_get_cell(Level* self, Position pos) {
  uint16_t position_offset = position_get_offset(pos, self->width);
  if (position_offset >= self->width * self->height)
    return NULL;
  return self->map + position_offset;
}

void Level_init_basic(Level* self) {
  // Basic
  self->map = NULL;
  self->width = 0;
  self->height = 0;
  self->actors = NULL;
  self->actors_n = 0;
  self->current_tick = 0;
  self->current_subtick = -1;
  self->game_state = GAMESTATE_PLAYING;
  LevelMetadata_init(&self->metadata);
  self->builtin_replay = NULL;
  // Player
  self->player_seats = NULL;
  self->players_n = 0;
  self->players_left = 0;
  // Metrics
  self->time_left = 0;
  self->time_stopped = false;
  self->chips_left = 0;
  self->bonus_points = 0;
  // Rng
  self->rng1 = 0;
  self->rng2 = 0;
  self->rng_blob = 0x55;
  // Global state
  self->rff_direction = DIRECTION_UP;
  self->green_button_pressed = false;
  self->blue_button_pressed = false;
  self->yellow_button_pressed = DIRECTION_NONE;
}
void Level_init_players(Level* self, uint32_t players_n) {
  self->player_seats = calloc(players_n, sizeof(PlayerSeat));
  self->players_n = players_n;
}
void Level_init(Level* self,
                uint8_t width,
                uint8_t height,
                uint32_t players_n) {
  Level_init_basic(self);
  Level_init_players(self, players_n);
  self->width = width;
  self->height = height;
  uint16_t tile_count = width * height;
  self->map = calloc(tile_count, sizeof(Cell));
  for (uint16_t i = 0; i < tile_count; i += 1) {
    self->map[i].terrain.type = &FLOOR_tile;
  }
}
void Level_uninit(Level* self) {
  if (self == NULL)
    return;
  free(self->actors);
  free(self->map);
  LevelMetadata_uninit(&self->metadata);
  if (self->builtin_replay) {
    free(self->builtin_replay->inputs);
    free(self->builtin_replay);
  }
  free(self->player_seats);
}
uint8_t Level_rng(Level* self) {
  int8_t n = (self->rng2 >> 2) - self->rng1;
  if (!(self->rng1 & 0x02))
    n -= 1;
  self->rng1 = ((self->rng1 >> 1) | (self->rng2 & 0x80)) & 0xff;
  self->rng2 = ((self->rng2 << 1) | (n & 0x1)) & 0xff;
  return self->rng1 ^ self->rng2;
}
uint8_t Level_blobmob(Level* self) {
  if (self->rng_blob_4pat) {
    self->rng_blob = right(self->rng_blob);
  } else {
    uint16_t mod = self->rng_blob * 2;
    if (mod < 255)
      mod ^= 0x1d;
    self->rng_blob = mod & 0xff;
  }
  return self->rng_blob;
}

void Level_realloc_actors(Level* self) {
  if (self->actors_n == 0) {
    free(self->actors);
    self->actors = NULL;
    return;
  }
  Actor* old_ptr = self->actors;
  self->actors = realloc(self->actors, self->actors_n * sizeof(Actor));
  ptrdiff_t actor_ptr_offset = (void*)self->actors - (void*)old_ptr;
  if (actor_ptr_offset == 0 || old_ptr == NULL || self->actors == NULL)
    return;
  for (uint32_t idx = 0; idx < self->players_n; idx += 1) {
    PlayerSeat* seat = &self->player_seats[idx];
    seat->actor = (void*)seat->actor + actor_ptr_offset;
  }
}

void Level_compact_actor_array(Level* self) {
  Actor* actors = self->actors;
  Actor* actors_free = self->actors;
  uint32_t actors_seen = 0;
  while (actors_seen < self->actors_n) {
    if (actors->type == NULL) {
      actors += 1;
      continue;
    }
    if (actors != actors_free) {
      *actors_free = *actors;
      if (actors_free->type->flags & ACTOR_FLAGS_REAL_PLAYER) {
        PlayerSeat* seat = Level_find_player_seat(self, actors_free);
        seat->actor = actors_free;
      }
    }
    actors_free += 1;
    actors += 1;
    actors_seen += 1;
  }
  Level_realloc_actors(self);
}

Actor* Level_find_next_player(Level* self, Actor* player) {
  Actor* search_position = player - 1;
  // Search between `player` and start of actor list
  while (search_position >= self->actors) {
    if ((search_position->type->flags & ACTOR_FLAGS_REAL_PLAYER) &&
        Level_find_player_seat(self, search_position) == NULL) {
      return search_position;
    }
    search_position -= 1;
  }
  // Search between end of actor list and `player`
  search_position = self->actors + self->actors_n - 1;
  while (search_position > player) {
    if ((search_position->type->flags & ACTOR_FLAGS_REAL_PLAYER) &&
        Level_find_player_seat(self, search_position) == NULL) {
      return search_position;
    }
    search_position -= 1;
  }
  return NULL;
}

PlayerSeat* Level_find_player_seat(Level* self, Actor* player) {
  for (uint32_t idx = 0; idx < self->players_n; idx += 1) {
    if (self->player_seats[idx].actor == player) {
      return self->player_seats + idx;
    }
  }
  return NULL;
}

PlayerSeat* Level_get_player_seat_n(Level* self, size_t idx) {
  return self->player_seats + idx;
}

Level* Level_clone(const Level* self) {
  // return self;
  Level* new_level = malloc(sizeof(Level));
  // Copy over all fields and modify the ones that aren't trivially copied
  memcpy(new_level, self, sizeof(Level));
  // `map`
  size_t map_size = self->width * self->height * sizeof(Cell);
  new_level->map = malloc(map_size);
  memcpy(new_level->map, self->map, map_size);
  // `actors`
  size_t actors_size = self->actors_n * sizeof(Actor);
  new_level->actors = malloc(actors_size);
  ptrdiff_t actor_ptr_offset = (void*)new_level->actors - (void*)self->actors;
  memcpy(new_level->actors, self->actors, actors_size);
  // `player_seats`
  size_t seats_size = self->players_n * sizeof(PlayerSeat);
  new_level->player_seats = malloc(seats_size);
  memcpy(new_level->player_seats, self->player_seats, seats_size);
  for (uint32_t idx = 0; idx < new_level->players_n; idx += 1) {
    PlayerSeat* seat = &new_level->player_seats[idx];
    seat->actor = (void*)seat->actor + actor_ptr_offset;
  }
  new_level->metadata = LevelMetadata_clone(&self->metadata);
  return new_level;
}

Cell* Level_get_cell_xy(Level* self, uint8_t x, uint8_t y) {
  Position pos = {x, y};
  return self->map + position_get_offset(pos, self->width);
}

LevelMetadata* Level_get_metadata_ptr(Level* self) {
  return &self->metadata;
}

_libnotcc_accessors_PlayerSeat;

BasicTile* Cell_get_layer(Cell* self, Layer layer) {
  if (layer == LAYER_SPECIAL)
    return &self->special;
  if (layer == LAYER_ITEM_MOD)
    return &self->item_mod;
  if (layer == LAYER_ITEM)
    return &self->item;
  if (layer == LAYER_TERRAIN)
    return &self->terrain;
  return NULL;
}

Actor* Cell_get_actor(Cell* self) {
  return self->actor;
}

void Cell_set_actor(Cell* self, Actor* actor) {
  self->actor = actor;
}

_libnotcc_accessors_BasicTile;

bool BasicTile_impedes(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction) {
  if (self->type->on_bumped_by)
    self->type->on_bumped_by(self, level, other, direction);
  if (other->type->on_bump)
    other->type->on_bump(other, level, self);
  if (self->type->impedes_mask & other->type->flags)
    return true;
  if (self->type->impedes && self->type->impedes(self, level, other, direction))
    return true;
  return false;
}
void BasicTile_destroy(BasicTile* self) {
  if (self->type->layer == LAYER_TERRAIN) {
    self->type = &FLOOR_tile;
  } else {
    self->type = NULL;
  }
}

void BasicTile_transform_into(BasicTile* self, const TileType* new_type) {
  self->type = new_type;
}

_libnotcc_accessors_Actor;

bool Actor_is_moving(Actor* actor) {
  return actor->move_progress > 0;
}

Actor* Actor_new(Level* level,
                 const ActorType* type,
                 Position position,
                 Direction direction) {
  level->actors_n += 1;
  Level_realloc_actors(level);
  Actor* self = level->actors + level->actors_n - 1;
  self->type = type;
  self->custom_data = 0;

  self->inventory.item1 = NULL;
  self->inventory.item2 = NULL;
  self->inventory.item3 = NULL;
  self->inventory.item4 = NULL;
  self->inventory.keys_red = 0;
  self->inventory.keys_green = 0;
  self->inventory.keys_blue = 0;
  self->inventory.keys_yellow = 0;

  self->position = position;
  self->direction = direction;
  self->move_decision = DIRECTION_NONE;
  self->pending_decision = DIRECTION_NONE;
  self->pending_move_locked_in = false;
  self->move_progress = 0;
  self->move_length = 0;
  self->sliding_state = SLIDING_NONE;
  self->bonked = false;
  Cell* cell = Level_get_cell(level, position);
  cell->actor = self;
  // TODO warn about despawn
  // TODO notify other layers?
  return self;
}

#define NOTIFY_ALL_LAYERS(cell, func, ...)                          \
  if (cell->special.type && cell->special.type->func)               \
    cell->special.type->func(&cell->special, level, __VA_ARGS__);   \
  if (cell->item_mod.type && cell->item_mod.type->func)             \
    cell->item_mod.type->func(&cell->item_mod, level, __VA_ARGS__); \
  if (cell->item.type && cell->item.type->func)                     \
    cell->item.type->func(&cell->item, level, __VA_ARGS__);         \
  if (cell->terrain.type && cell->terrain.type->func)               \
    cell->terrain.type->func(&cell->terrain, level, __VA_ARGS__);

void Actor_do_idle(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, on_idle, self);
}

bool Level_is_movement_subtick(Level* level) {
  return level->current_subtick == 2;
}

void Level_tick(Level* self) {
  self->current_subtick += 1;
  if (self->current_subtick == 3) {
    self->current_tick += 1;
    self->current_subtick = 0;
  }
  if (self->time_left > 0 && !self->time_stopped) {
    self->time_left -= 1;
  }
  for (int32_t idx = self->actors_n - 1; idx >= 0; idx -= 1) {
    Actor* actor = self->actors + idx;
    if (actor->type == NULL)
      continue;
    Actor_do_decision(actor, self);
  }
  for (int32_t idx = self->actors_n - 1; idx >= 0; idx -= 1) {
    Actor* actor = self->actors + idx;
    if (actor->type == NULL)
      continue;
    if (Actor_is_moving(actor)) {
      Actor_do_cooldown(actor, self);
    } else {
      Actor_do_decided_move(actor, self);
    }
    Actor_do_idle(actor, self);
  }
  if (self->players_left == 0) {
    if (self->game_state == GAMESTATE_PLAYING && self->time_left > 0) {
      self->time_left -= 1;
    }
    self->game_state = GAMESTATE_WON;
  } else if (self->time_left == 1) {
    self->time_left -= 1;
    self->game_state = GAMESTATE_TIMEOUT;
  }

  Level_compact_actor_array(self);
}

_libnotcc_accessors_Replay;

void Actor_do_decision(Actor* self, Level* level) {
  if (Actor_is_moving(self))
    return;
  if (self->type->flags & ACTOR_FLAGS_REAL_PLAYER) {
    Player_do_decision(self, level);
    return;
  }
  if (self->pending_decision) {
    self->move_decision = self->pending_decision;
    self->pending_decision = DIRECTION_NONE;
    self->pending_move_locked_in = true;
    return;
  }
  if (self->sliding_state != SLIDING_NONE) {
    self->pending_decision = self->direction;
    return;
  }
  if (!Level_is_movement_subtick(level))
    return;
  self->move_decision = DIRECTION_NONE;
  Direction directions[4] = {DIRECTION_NONE, DIRECTION_NONE, DIRECTION_NONE,
                             DIRECTION_NONE};
  self->type->decide_movement(self, level, directions);
  for (uint8_t idx = 0; idx < 4; idx += 1) {
    Direction dir = directions[idx];
    if (dir == DIRECTION_NONE)
      return;
    self->move_decision = dir;
    if (Actor_check_collision(self, level, dir)) {
      return;
    }
  }
}

void Actor_do_decided_move(Actor* self, Level* level) {
  if (self->move_progress) {
    self->move_decision = DIRECTION_NONE;
    return;
  }
  self->pending_decision = DIRECTION_NONE;
  self->pending_move_locked_in = false;
  if (self->move_decision != DIRECTION_NONE) {
    Actor_move_to(self, level, self->move_decision);
  }
  self->move_decision = DIRECTION_NONE;
}

uint8_t Actor_get_move_speed(Actor* self, Level* level, Cell* cell) {
  uint8_t move_speed = self->type->move_duration;
  BasicTile* terrain = &cell->terrain;
  if (terrain->type->modify_move_duration) {
    move_speed =
        terrain->type->modify_move_duration(terrain, level, self, move_speed);
  }
  // TODO Speed boots
  return move_speed;
}

bool Actor_move_to(Actor* self, Level* level, Direction direction) {
  if (Actor_is_moving(self))
    return false;
  self->direction = direction;
  bool can_move = Actor_check_collision(self, level, direction);
  self->bonked = !can_move;
  if (!can_move)
    return false;
  Position new_pos = Level_get_neighbor(level, self->position, direction);
  Cell* old_cell = Level_get_cell(level, self->position);
  Cell* new_cell = Level_get_cell(level, new_pos);
  if (old_cell->actor && old_cell->actor != self) {
    // TODO Report despawn
  }
  old_cell->actor = NULL;
  NOTIFY_ALL_LAYERS(old_cell, actor_left, self, direction);

  if (new_cell->actor) {
    // TODO Report despawn
  }
  new_cell->actor = self;
  NOTIFY_ALL_LAYERS(old_cell, actor_joined, self, direction);

  self->position = new_pos;

  self->move_progress = 1;
  self->move_length = Actor_get_move_speed(self, level, new_cell);
  self->sliding_state = SLIDING_NONE;
  return true;
}

void Actor_enter_tile(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, actor_completely_joined, self);
};

void Actor_do_cooldown(Actor* self, Level* level) {
  self->move_progress += 1;
  if (self->move_progress == self->move_length) {
    Actor_enter_tile(self, level);
    self->move_progress = 0;
    if (self->pending_decision) {
      self->pending_move_locked_in = true;
    }
  }
}

bool Actor_push_to(Actor* self, Level* level, Direction direction) {
  if (self->sliding_state) {
    if (!self->pending_move_locked_in) {
      self->pending_decision = self->move_decision = direction;
    }
    return false;
  }
  if (Actor_is_moving(self) || !Actor_check_collision(self, level, direction)) {
    return false;
  }
  Actor_move_to(self, level, direction);
  return true;
}

bool Actor_check_collision(Actor* self, Level* level, Direction direction) {
  // TODO Railroad, thin walls
  if (!Level_check_position_inbounds(level, self->position, direction, false)) {
    // TODO Report bowlingball edge collision
    return false;
  }
  Position new_pos = Level_get_neighbor(level, self->position, direction);
  Cell* cell = Level_get_cell(level, new_pos);
#define CHECK_LAYER(layer)                                     \
  if (cell->layer.type &&                                      \
      BasicTile_impedes(&cell->layer, level, self, direction)) \
    return false;
  CHECK_LAYER(special);
  CHECK_LAYER(item_mod);
  CHECK_LAYER(terrain);
  if (cell->actor) {
    Actor* other = cell->actor;
    self->type->on_bump_actor(self, level, cell->actor);
    if (self->type->can_push && other->type->can_be_pushed &&
        self->type->can_push(self, level, other) &&
        other->type->can_be_pushed(other, level, self, direction)) {
      if (!Actor_push_to(other, level, direction))
        return false;
    } else if (!other->type->impedes ||
               other->type->impedes(other, level, self, direction))
      return false;
  } else if (cell->item.type) {
    BasicTile* item_mod = &cell->item_mod;
    BasicTile* item = &cell->item;
    if (!item_mod->type || !item_mod->type->overrides_item_layer ||
        !item_mod->type->overrides_item_layer(item_mod, level, item)) {
      if (BasicTile_impedes(item, level, self, direction)) {
        return false;
      }
    }
  }
  // TODO Pulling
  return true;
#undef CHECK_LAYER
}

void Actor_transform_into(Actor* self, const ActorType* new_type) {
  self->type = new_type;
}

void Actor_destroy(Actor* self, Level* level, const ActorType* anim_type) {
  Actor_transform_into(self, anim_type);
  if (self->type->flags & ACTOR_FLAGS_REAL_PLAYER) {
    level->game_state = GAMESTATE_DEAD;
  }
}

void Actor_erase(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  // TODO: Record despawn glitch
  cell->actor = NULL;
  self->type = NULL;
  level->actors_n -= 1;
}

enum { PLAYER_HAS_OVERRIDE = 1 << 0 };

#define has_input(seat, bit) \
  ((seat->inputs & bit) && !(seat->released_inputs & bit))

void PlayerSeat_get_movement_directions(PlayerSeat* self, Direction dirs[2]) {
  dirs[0] = dirs[1] = DIRECTION_NONE;
  if ((has_input(self, PLAYER_INPUT_UP) &&
       has_input(self, PLAYER_INPUT_DOWN)) ||
      (has_input(self, PLAYER_INPUT_LEFT) &&
       has_input(self, PLAYER_INPUT_RIGHT))) {
    return;
  }
  if (has_input(self, PLAYER_INPUT_UP)) {
    dirs[0] = DIRECTION_UP;
  }
  if (has_input(self, PLAYER_INPUT_RIGHT)) {
    dirs[1] = DIRECTION_RIGHT;
  }
  if (has_input(self, PLAYER_INPUT_DOWN)) {
    dirs[0] = DIRECTION_DOWN;
  }
  if (has_input(self, PLAYER_INPUT_LEFT)) {
    dirs[1] = DIRECTION_LEFT;
  }
}

uint16_t Actor_get_position_xy(Actor* self) {
  return (uint16_t)self->position.x + ((uint16_t)self->position.y << 8);
}

Inventory* Actor_get_inventory_ptr(Actor* self) {
  return &self->inventory;
}

void Player_do_decision(Actor* self, Level* level) {
  bool was_bonked = self->bonked;
  if (Level_is_movement_subtick(level))
    self->bonked = false;
  PlayerSeat* seat = Level_find_player_seat(level, self);
  seat->released_inputs = 0;
#define Player_set_input(bit) \
  seat->released_inputs = seat->released_inputs | bit;
  bool can_move = seat != NULL && (self->sliding_state == SLIDING_NONE ||
                                   (self->sliding_state == SLIDING_WEAK &&
                                    (self->custom_data & PLAYER_HAS_OVERRIDE)));
  if (seat && Level_is_movement_subtick(level)) {
    if (level->players_left > level->players_n &&
        has_input(seat, PLAYER_INPUT_SWITCH_PLAYERS)) {
      seat->actor = Level_find_next_player(level, self);
      Player_set_input(PLAYER_INPUT_SWITCH_PLAYERS);
    }
  }
  bool bonked = false;
  Direction dirs[2];
  if (seat != NULL) {
    PlayerSeat_get_movement_directions(seat, dirs);
  }

  self->move_decision = DIRECTION_NONE;
  if (!can_move || (dirs[0] == DIRECTION_NONE && dirs[1] == DIRECTION_NONE)) {
    // We either cannot move or we didn't input anything. If we're sliding,
    // start moving in our current direction (and get override powers if we're
    // weak-sliding)
    if (self->sliding_state != SLIDING_NONE) {
      self->move_decision = self->direction;
      if (self->sliding_state == SLIDING_WEAK &&
          Level_is_movement_subtick(level)) {
        self->custom_data |= PLAYER_HAS_OVERRIDE;
      }
    }
  } else {
    // TODO: Report simul movement glitch
    bool bonked = false;
    if (dirs[0] == DIRECTION_NONE || dirs[1] == DIRECTION_NONE) {
      Direction chosen_dir = dirs[0] == DIRECTION_NONE ? dirs[1] : dirs[0];
      bonked = !Actor_check_collision(self, level, chosen_dir);
      self->move_decision = chosen_dir;
    } else {
      bool can_horiz = Actor_check_collision(self, level, dirs[0]);
      bool can_vert = Actor_check_collision(self, level, dirs[1]);
      if (can_horiz && !can_vert) {
        self->move_decision = dirs[0];
      } else if (!can_horiz && can_vert) {
        self->move_decision = dirs[1];
      } else {
        bonked = !can_horiz;
        if (bonked) {
          // If both dirs are blocked, always prefer horizontal movement (this
          // is the Steam slap)
          self->move_decision = dirs[0];
        } else {
          // Prefer current direction, and use horiz if neither matches
          if (dirs[0] == self->direction) {
            self->move_decision = dirs[0];
          } else if (dirs[1] == self->direction) {
            self->move_decision = dirs[1];
          } else {
            self->move_decision = dirs[0];
          }
        }
      }
      self->custom_data &= ~PLAYER_HAS_OVERRIDE;
      self->custom_data |= bonked && self->sliding_state == SLIDING_WEAK
                               ? PLAYER_HAS_OVERRIDE
                               : 0;
      Cell* cell = Level_get_cell(level, self->position);
      // TODO: FF boots
      if (bonked && !(cell->terrain.type->flags & ACTOR_FLAGS_FORCE_FLOOR)) {
        self->bonked = true;
      }
    }
  }
}
