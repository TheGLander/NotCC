#include "logic.h"
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "accessors/define.h"
#include "assert.h"
#include "misc.h"
#include "tiles.h"

_libnotcc_accessors_Inventory;
void Inventory_increment_counter(Inventory* self, uint8_t iidx) {
  if (self->counters.val[iidx - 1] == 255) {
    self->counters.val[iidx - 1] = 0;
  } else {
    self->counters.val[iidx - 1] += 1;
  }
}
void Inventory_decrement_counter(Inventory* self, uint8_t iidx) {
  if (self->counters.val[iidx - 1] == 0) {
    self->counters.val[iidx - 1] = 255;
  } else {
    self->counters.val[iidx - 1] -= 1;
  }
}
const TileType* Inventory_remove_item(Inventory* self, uint8_t idx) {
  const TileType* item = NULL;
  if (idx <= 0) {
    if (idx == 0) {
      item = self->item1;
    }
    self->item1 = self->item2;
  }
  if (idx <= 1) {
    if (idx == 1) {
      item = self->item2;
    }
    self->item2 = self->item3;
  }
  if (idx <= 2) {
    if (idx == 2) {
      item = self->item3;
    }
    self->item3 = self->item4;
  }
  if (idx == 3) {
    item = self->item4;
  }
  self->item4 = NULL;
  return item;
}
const TileType** Inventory_get_rightmost_item(Inventory* self) {
  if (self->item4)
    return &self->item4;
  if (self->item3)
    return &self->item3;
  if (self->item2)
    return &self->item2;
  if (self->item1)
    return &self->item1;
  return NULL;
}
const TileType* Inventory_shift_right(Inventory* self) {
  const TileType* item = self->item4;
  self->item4 = self->item3;
  self->item3 = self->item2;
  self->item2 = self->item1;
  self->item1 = NULL;
  return item;
}
const TileType** Inventory_get_item_by_idx(Inventory* self, uint8_t idx) {
  if (idx == 0)
    return &self->item1;
  if (idx == 1)
    return &self->item2;
  if (idx == 2)
    return &self->item3;
  if (idx == 3)
    return &self->item4;
  assert(idx < 4);
  return NULL;
}

size_t Position_to_offset(Position pos, size_t pitch) {
  return pos.x + pos.y * pitch;
}
Position Position_from_offset(size_t offset, size_t pitch) {
  return (Position){offset % pitch, offset / pitch};
}

_libnotcc_accessors_LevelMetadata;

void LevelMetadata_init(LevelMetadata* self) {
  *self = (LevelMetadata){.rng_blob_4pat = true,
                          .player_n = 1,
                          .camera_width = 10,
                          .camera_height = 10};
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
  new_meta.title = strdupz(self->title);
  new_meta.author = strdupz(self->author);
  new_meta.default_hint = strdupz(self->default_hint);
  new_meta.hints = xmalloc(sizeof(char*) * new_meta.hints_n);
  for (uint32_t idx = 0; idx < new_meta.hints_n; idx += 1) {
    new_meta.hints[idx] = strdupz(self->hints[idx]);
  }
  return new_meta;
}

_libnotcc_accessors_Level;

Position Level_get_neighbor(Level* self, Position pos, Direction dir) {
  uint8_t pitch = self->width;
  size_t position_offset = Position_to_offset(pos, pitch);
  if (dir == DIRECTION_UP)
    position_offset -= pitch;
  if (dir == DIRECTION_RIGHT)
    position_offset += 1;
  if (dir == DIRECTION_DOWN)
    position_offset += pitch;
  if (dir == DIRECTION_LEFT)
    position_offset -= 1;
  return Position_from_offset(position_offset, pitch);
}

bool Level_check_position_inbounds(Level* self,
                                   Position pos,
                                   Direction dir,
                                   bool wrap) {
  if (dir == DIRECTION_UP && pos.y == 0)
    return false;
  if (!wrap && dir == DIRECTION_RIGHT && pos.x == self->width - 1)
    return false;
  if (dir == DIRECTION_RIGHT && pos.x == self->width - 1 &&
      pos.y == self->height - 1)
    return false;
  if (dir == DIRECTION_DOWN && pos.y == self->height - 1)
    return false;
  if (!wrap && dir == DIRECTION_LEFT && pos.x == 0)
    return false;
  if (dir == DIRECTION_LEFT && pos.x == 0 && pos.y == 0)
    return false;
  return true;
}

Cell* Level_get_cell(Level* self, Position pos) {
  uint16_t position_offset = Position_to_offset(pos, self->width);
  if (position_offset >= self->width * self->height)
    return NULL;
  return self->map + position_offset;
}

void Level_init_basic(Level* self) {
  // Basic
  *self = (Level){
      .current_subtick = -1, .rng_blob = 0x55, .rff_direction = DIRECTION_UP};
  LevelMetadata_init(&self->metadata);
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
  for (size_t idx = 0; idx < self->actors_allocated_n; idx += 1) {
    free(self->actors[idx]);
  }
  free(self->actors);
  free(self->map);
  LevelMetadata_uninit(&self->metadata);
  if (self->builtin_replay) {
    free(self->builtin_replay->inputs);
    free(self->builtin_replay);
  }
  free(self->player_seats);
}
size_t Level_total_size(const Level* self) {
  return sizeof(Level) +
         self->actors_allocated_n * (sizeof(Actor) + sizeof(Actor*)) +
         self->width * self->height * sizeof(Cell) +
         self->players_n * sizeof(PlayerSeat);
}
uint8_t Level_rng(Level* self) {
  int16_t n = (self->rng1 >> 2) - self->rng1;
  if (!(self->rng1 & 0x02))
    n -= 1;
  self->rng1 = (self->rng1 >> 1) | (self->rng2 & 0x80);
  self->rng2 = (self->rng2 << 1) | (n & 0x1);
  return self->rng1 ^ self->rng2;
}
uint8_t Level_blobmod(Level* self) {
  if (self->metadata.rng_blob_4pat) {
    self->rng_blob = (self->rng_blob + 1) % 4;
  } else {
    uint16_t mod = self->rng_blob * 2;
    if (mod < 255)
      mod ^= 0x1d;
    self->rng_blob = mod & 0xff;
  }
  return self->rng_blob;
}

void Level_realloc_actors(Level* self) {
  if (self->actors_allocated_n == 0) {
    free(self->actors);
    self->actors = NULL;
    return;
  }
  self->actors =
      xrealloc(self->actors, self->actors_allocated_n * sizeof(Actor*));
}

void Level_compact_actor_array(Level* self) {
  if (self->actors_allocated_n == self->actors_n)
    return;
  Actor** actors = self->actors;
  Actor** actors_free = self->actors;
  uint32_t actors_seen = 0;
  while (actors_seen < self->actors_allocated_n) {
    if ((*actors)->type == NULL) {
      free(*actors);
      actors += 1;
      actors_seen += 1;
      continue;
    }
    if (actors != actors_free) {
      *actors_free = *actors;
    }
    actors_free += 1;
    actors += 1;
    actors_seen += 1;
  }
  self->actors_allocated_n = self->actors_n;
  Level_realloc_actors(self);
}

Actor* Level_find_next_player(Level* self, Actor* player) {
  Actor** player_actors_ptr = self->actors;
  while (*player_actors_ptr != player) {
    player_actors_ptr += 1;
  }
  Actor** search_position = player_actors_ptr - 1;
  // Search between `player` and start of actor list
  while (search_position >= self->actors) {
    if (has_flag(*search_position, ACTOR_FLAGS_REAL_PLAYER) &&
        Level_find_player_seat(self, *search_position) == NULL) {
      return *search_position;
    }
    search_position -= 1;
  }
  // Search between end of actor list and `player`
  search_position = &self->actors[self->actors_allocated_n - 1];
  while (search_position > player_actors_ptr) {
    if ((has_flag(*search_position, ACTOR_FLAGS_REAL_PLAYER)) &&
        Level_find_player_seat(self, *search_position) == NULL) {
      return *search_position;
    }
    search_position -= 1;
  }
  return NULL;
}

PlayerSeat* Level_find_player_seat(Level* self, const Actor* player) {
  for (uint32_t idx = 0; idx < self->players_n; idx += 1) {
    if (self->player_seats[idx].actor == player) {
      return &self->player_seats[idx];
    }
  }
  return NULL;
}

PlayerSeat* Level_get_player_seat_n(Level* self, size_t idx) {
  return &self->player_seats[idx];
}

Level* Level_clone(const Level* self) {
  Level* new_level = xmalloc(sizeof(Level));
  // Copy over all fields and modify the ones that aren't trivially copied
  memcpy(new_level, self, sizeof(Level));
  // `map`
  size_t map_size = self->width * self->height * sizeof(Cell);
  new_level->map = xmalloc(map_size);
  memcpy(new_level->map, self->map, map_size);
  // `player_seats`
  size_t seats_size = self->players_n * sizeof(PlayerSeat);
  new_level->player_seats = xmalloc(seats_size);
  memcpy(new_level->player_seats, self->player_seats, seats_size);
  // `actors`
  new_level->actors = xmalloc(self->actors_allocated_n * sizeof(Actor*));
  for (size_t idx = 0; idx < new_level->actors_allocated_n; idx += 1) {
    const Actor* old_actor = self->actors[idx];
    Actor* actor = xmalloc(sizeof(Actor));
    memcpy(actor, old_actor, sizeof(Actor));
    new_level->actors[idx] = actor;
    Cell* cell = Level_get_cell(new_level, old_actor->position);
    // Not guaranteed to be true, actor could be despawned
    if (cell->actor == old_actor) {
      cell->actor = actor;
    }
    if (has_flag(old_actor, ACTOR_FLAGS_REAL_PLAYER)) {
      PlayerSeat* seat = Level_find_player_seat(new_level, old_actor);
      if (seat) {
        seat->actor = actor;
      }
    }
  }
  new_level->metadata = LevelMetadata_clone(&self->metadata);
  return new_level;
}

Cell* Level_get_cell_xy(Level* self, uint8_t x, uint8_t y) {
  return &self->map[Position_to_offset((Position){x, y}, self->width)];
}

LevelMetadata* Level_get_metadata_ptr(Level* self) {
  return &self->metadata;
}
Position Level_pos_from_cell(const Level* self, const Cell* cell) {
  assert(&self->map[0] <= cell &&
         cell <= &self->map[self->width * self->height - 1]);
  size_t idx = cell - self->map;
  return (Position){.x = idx % self->width, .y = idx / self->width};
}
Cell* Level_search_reading_order(Level* self,
                                 Cell* base,
                                 bool reverse,
                                 bool (*match_func)(void* ctx,
                                                    Level* level,
                                                    Cell* cell),
                                 void* ctx) {
  int8_t direction = reverse ? -1 : 1;
  size_t base_idx =
      Position_to_offset(Level_pos_from_cell(self, base), self->width);
  size_t tiles_n = self->width * self->height;
  ptrdiff_t idx = base_idx + direction;
  while (0 <= idx && idx < tiles_n) {
    Cell* cell = &self->map[idx];
    if (match_func(ctx, self, cell))
      return cell;
    idx += direction;
  }
  idx = reverse ? tiles_n - 1 : 0;
  while (idx != base_idx) {
    Cell* cell = &self->map[idx];
    if (match_func(ctx, self, cell))
      return cell;
    idx += direction;
  }
  return NULL;
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
  if (has_flag(other, self->type->impedes_mask))
    return true;
  if (self->type->impedes && self->type->impedes(self, level, other, direction))
    return true;
  return false;
}
void BasicTile_erase(BasicTile* self) {
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
  Actor* self = xmalloc(sizeof(Actor));
  level->actors_n += 1;
  level->actors_allocated_n += 1;
  Level_realloc_actors(level);
  level->actors[level->actors_allocated_n - 1] = self;
  *self = (Actor){.type = type, .position = position, .direction = direction};
  Cell* cell = Level_get_cell(level, position);
  cell->actor = self;
  if (self->type->init)
    self->type->init(self, level);
  // TODO warn about despawn
  // TODO notify other layers?
  return self;
}

#define NOTIFY_ALL_LAYERS(cell, func, ...)                                 \
  if (cell->special.type && cell->special.type->func)                      \
    cell->special.type->func(&cell->special __VA_OPT__(, ) __VA_ARGS__);   \
  if (cell->item_mod.type && cell->item_mod.type->func)                    \
    cell->item_mod.type->func(&cell->item_mod __VA_OPT__(, ) __VA_ARGS__); \
  if (cell->item.type && cell->item.type->func)                            \
    cell->item.type->func(&cell->item __VA_OPT__(, ) __VA_ARGS__);         \
  if (cell->terrain.type && cell->terrain.type->func)                      \
    cell->terrain.type->func(&cell->terrain __VA_OPT__(, ) __VA_ARGS__);

void Actor_do_idle(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, on_idle, level, self);
}

bool Level_is_movement_subtick(Level* level) {
  return level->current_subtick == 2;
}

void Level_apply_blue_button(Level* self) {
  for (size_t idx = 0; idx < self->actors_allocated_n; idx += 1) {
    Actor* actor = self->actors[idx];
    if (actor->type != &BLUE_TANK_actor)
      continue;
    if (actor->custom_data & BLUE_TANK_ROTATE) {
      actor->custom_data &= ~BLUE_TANK_ROTATE;
    } else {
      actor->custom_data |= BLUE_TANK_ROTATE;
    }
  }
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
  for (int32_t idx = self->actors_allocated_n - 1; idx >= 0; idx -= 1) {
    Actor* actor = self->actors[idx];
    if (actor->type == NULL)
      continue;
    Actor_do_decision(actor, self);
  }
  for (int32_t idx = self->actors_allocated_n - 1; idx >= 0; idx -= 1) {
    Actor* actor = self->actors[idx];
    if (actor->type == NULL || has_flag(actor, ACTOR_FLAGS_ANIMATION))
      continue;
    if (Actor_is_moving(actor)) {
      Actor_do_cooldown(actor, self);
    } else {
      Actor_do_decided_move(actor, self);
    }
    if (!Actor_is_moving(actor)) {
      Actor_do_idle(actor, self);
    }
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
  // Do post-tick global state cleanup
  if (self->green_button_pressed) {
    self->toggle_wall_inverted = !self->toggle_wall_inverted;
    self->green_button_pressed = false;
  }
  if (self->blue_button_pressed) {
    Level_apply_blue_button(self);
    self->blue_button_pressed = false;
  }
  // TODO: Jetlife

  Level_compact_actor_array(self);
}

void Level_initialize_tiles(Level* self) {
  size_t tiles_n = self->width * self->height;
  for (size_t idx = 0; idx < tiles_n; idx += 1) {
    Cell* cell = &self->map[idx];
    // XXX: Both ActorType and TileType having an `init` which are called at
    // different times in the level lifecycle is confusing, maybe rename one of
    // them?
    NOTIFY_ALL_LAYERS(cell, init, self, cell);
  }
}

_libnotcc_accessors_Replay;

void Animation_do_decision(Actor* self, Level* level) {
  self->custom_data -= 1;
  if (self->custom_data == 0) {
    Actor_erase(self, level);
  }
}

void Actor_do_decision(Actor* self, Level* level) {
  if (has_flag(self, ACTOR_FLAGS_ANIMATION)) {
    Animation_do_decision(self, level);
    return;
  }
  if (Actor_is_moving(self) || self->frozen)
    return;
  if (has_flag(self, ACTOR_FLAGS_REAL_PLAYER)) {
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
    self->move_decision = self->direction;
    return;
  }
  if (!Level_is_movement_subtick(level))
    return;
  self->move_decision = DIRECTION_NONE;
  Direction directions[4] = {DIRECTION_NONE, DIRECTION_NONE, DIRECTION_NONE,
                             DIRECTION_NONE};
  if (self->type->decide_movement) {
    self->type->decide_movement(self, level, directions);
  }
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
  uint8_t move_speed =
      self->type->move_duration == 0 ? 12 : self->type->move_duration;
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
  self->sliding_state = SLIDING_NONE;
  self->move_progress = 1;
  self->move_length = Actor_get_move_speed(self, level, new_cell);
  old_cell->actor = NULL;
  NOTIFY_ALL_LAYERS(old_cell, actor_left, level, self, direction);

  if (new_cell->actor) {
    // TODO Report despawn
  }
  new_cell->actor = self;
  NOTIFY_ALL_LAYERS(new_cell, actor_joined, level, self, direction);

  self->position = new_pos;

  return true;
}

void Actor_enter_tile(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, actor_completely_joined, level, self);
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
  if (has_flag(self, ACTOR_FLAGS_ANIMATION))
    return false;
  assert(direction != DIRECTION_NONE);
  Cell* this_cell = Level_get_cell(level, self->position);
#define CHECK_REDIRECT(layer)                                                  \
  if (this_cell->layer.type && this_cell->layer.type->redirect_exit) {         \
    direction = this_cell->layer.type->redirect_exit(&this_cell->layer, level, \
                                                     self, direction);         \
    if (direction == DIRECTION_NONE)                                           \
      return false;                                                            \
  }
  CHECK_REDIRECT(special);
  CHECK_REDIRECT(item_mod);
  CHECK_REDIRECT(item);
  CHECK_REDIRECT(terrain);

  if (!Level_check_position_inbounds(level, self->position, direction, false)) {
    // TODO Report bowlingball edge collision
    return false;
  }
  Position new_pos = Level_get_neighbor(level, self->position, direction);
  Cell* cell = Level_get_cell(level, new_pos);
  // if `cell->actor != self`, we're a despawned actor trying to move
#define CHECK_LAYER(layer)                                     \
  if (cell->layer.type &&                                      \
      BasicTile_impedes(&cell->layer, level, self, direction)) \
    return false;
  CHECK_LAYER(special);
  CHECK_LAYER(item_mod);
  CHECK_LAYER(terrain);
  if (cell->actor) {
    Actor* other = cell->actor;
    if (other->type && other->type->on_bumped_by)
      other->type->on_bumped_by(other, level, self);
    if (other->type && self->type && self->type->on_bump_actor)
      self->type->on_bump_actor(self, level, other);
    if (self->type && other->type && has_flag(self, ACTOR_FLAGS_CAN_PUSH) &&
        other->type->can_be_pushed &&
        other->type->can_be_pushed(other, level, self, direction)) {
      if (!Actor_push_to(other, level, direction))
        return false;
    } else if (other->type)
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
#undef CHECK_REDIRECT
#undef CHECK_LAYER
}

void Actor_transform_into(Actor* self, const ActorType* new_type) {
  self->type = new_type;
}

void Actor_destroy(Actor* self, Level* level, const ActorType* anim_type) {
  if (has_flag(self, ACTOR_FLAGS_REAL_PLAYER)) {
    level->game_state = GAMESTATE_DEAD;
    PlayerSeat* seat = Level_find_player_seat(level, self);
    if (seat) {
      seat->actor = NULL;
    }
  }
  Actor_transform_into(self, anim_type);
  if (anim_type != NULL && self->type->init) {
    // XXX: I don't know, shouldn't transformed actors always be reinitalized as
    // the new actor type?
    self->type->init(self, level);
  }
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, actor_destroyed, level);
}

void Actor_erase(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  // TODO: Record despawn glitch
  cell->actor = NULL;
  // The allocation for the actor itself will be freed in
  // `Level_compact_actor_array`
  self->type = NULL;
  level->actors_n -= 1;
}

enum { PLAYER_HAS_OVERRIDE = 1 << 0 };

#define has_input(seat, bit) \
  ((seat->inputs & bit) != 0 && (seat->released_inputs & bit) == 0)

void PlayerSeat_get_movement_directions(PlayerSeat* self, Direction dirs[2]) {
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
  if (seat != NULL) {
    seat->released_inputs = 0;
  }
#define release_input(bit) seat->released_inputs = seat->released_inputs | bit;

  bool can_move = seat != NULL && Level_is_movement_subtick(level) &&
                  (self->sliding_state == SLIDING_NONE ||
                   (self->sliding_state == SLIDING_WEAK &&
                    (self->custom_data & PLAYER_HAS_OVERRIDE) != 0));
  if (seat && Level_is_movement_subtick(level)) {
    if (level->players_left > level->players_n &&
        has_input(seat, PLAYER_INPUT_SWITCH_PLAYERS)) {
      seat->actor = Level_find_next_player(level, self);
      release_input(PLAYER_INPUT_SWITCH_PLAYERS);
    }
    if (has_input(seat, PLAYER_INPUT_CYCLE_ITEMS)) {
      const TileType** last_item_ptr =
          Inventory_get_rightmost_item(&self->inventory);
      const TileType* last_item = *last_item_ptr;
      *last_item_ptr = NULL;
      Inventory_shift_right(&self->inventory);
      self->inventory.item1 = last_item;
      release_input(PLAYER_INPUT_CYCLE_ITEMS);
    }
    if (!level->metadata.cc1_boots && has_input(seat, PLAYER_INPUT_DROP_ITEM)) {
      Actor_drop_item(self, level);
      release_input(PLAYER_INPUT_DROP_ITEM);
    }
  }
  bool bonked = false;
  // `dirs[0]` is the vertical direction (if set), `dirs[1]` is the horizontal
  // dir (if set)
  Direction dirs[2] = {DIRECTION_NONE, DIRECTION_NONE};
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
      bool can_vert = Actor_check_collision(self, level, dirs[0]);
      bool can_horiz = Actor_check_collision(self, level, dirs[1]);
      if (can_horiz && !can_vert) {
        self->move_decision = dirs[1];
      } else if (!can_horiz && can_vert) {
        self->move_decision = dirs[0];
      } else {
        bonked = !can_horiz;
        if (bonked) {
          // If both dirs are blocked, always prefer horizontal movement
          self->move_decision = dirs[1];
        } else {
          // Use vert if it's the current direction, horiz otherwise (this is
          // what's called a Steam slap)
          if (dirs[0] == self->direction) {
            self->move_decision = dirs[0];
          } else {
            self->move_decision = dirs[1];
          }
        }
      }
    }
    self->custom_data &= ~PLAYER_HAS_OVERRIDE;
    self->custom_data |=
        bonked && self->sliding_state == SLIDING_WEAK ? PLAYER_HAS_OVERRIDE : 0;
    Cell* cell = Level_get_cell(level, self->position);
    // TODO: FF boots
    if (bonked && !(cell->terrain.type->flags & ACTOR_FLAGS_FORCE_FLOOR)) {
      self->bonked = true;
    }
  }
 #undef release_input
}

bool Actor_pickup_item(Actor* self, Level* level, BasicTile* item) {
  if (!TileType_can_be_dropped(&self->inventory.item4, level, self,
                               item->type->layer))
    return false;
  const TileType* dropped_item = Inventory_shift_right(&self->inventory);
  self->inventory.item1 = item->type;
  Inventory_increment_counter(&self->inventory, item->type->item_index);
  BasicTile_erase(item);
  if (dropped_item != NULL) {
    Actor_place_item_on_tile(self, level, dropped_item);
  }
  return true;
}

void Actor_place_item_on_tile(Actor* self,
                              Level* level,
                              const TileType* item_type) {
  Inventory_decrement_counter(&self->inventory, item_type->item_index);
  Cell* cell = Level_get_cell(level, self->position);
  BasicTile* item_layer = Cell_get_layer(cell, item_type->layer);
  // No item despawns here!
  assert(item_layer->type == NULL);
 // TODO: Game should crash if dropping actor is despawned
  item_layer->type = item_type;
  item_layer->custom_data = 0;
}

bool Actor_drop_item(Actor* self, Level* level) {
  const TileType** item_ptr = Inventory_get_rightmost_item(&self->inventory);
  if (item_ptr == NULL || *item_ptr == NULL ||
      !TileType_can_be_dropped(item_ptr, level, self, -1))
    return false;
  const TileType* item = *item_ptr;
  *item_ptr = NULL;
  Actor_place_item_on_tile(self, level, item);
  return true;
}

bool TileType_can_be_dropped(const TileType** self,
                             Level* level,
                             Actor* dropper,
                             int8_t layer_to_ignore) {
  if (*self == NULL)
    return true;
  Cell* cell = Level_get_cell(level, dropper->position);
  if ((*self)->layer != layer_to_ignore &&
      Cell_get_layer(cell, (*self)->layer)->type != NULL)
    return false;
  // TODO: Bowling ball
  return true;
}

PositionF Actor_get_visual_position(const Actor* self) {
  PositionF pos = {.x = self->position.x, .y = self->position.y};
  if (self->move_progress == 0)
    return pos;
  float offset = 1. - (float)self->move_progress / (float)self->move_length;
  if (self->direction == DIRECTION_UP)
    pos.y += offset;
  if (self->direction == DIRECTION_RIGHT)
    pos.x -= offset;
  if (self->direction == DIRECTION_DOWN)
    pos.y -= offset;
  if (self->direction == DIRECTION_LEFT)
    pos.x += offset;
  return pos;
}

Actor* Level_find_closest_player(Level* self, Position from) {
#if defined(__has_builtin) && __has_builtin(__builtin_expect_with_probability)
  if (__builtin_expect_with_probability(self->players_n == 1, true, .99)) {
#else
  if (self->players_n == 1) {
#endif
    return self->player_seats[0].actor;
  }
  Actor* player = NULL;
  float best_dist = 0;
  for (size_t idx = 0; idx < self->players_n; idx += 1) {
    PlayerSeat* seat = &self->player_seats[idx];
    if (!seat->actor)
      continue;
    PositionF pos = Actor_get_visual_position(seat->actor);
    // Taxicab distance, not Euclidean
    float distance = pos.x - from.x + pos.y - from.y;
    if (!player || distance <= best_dist) {
      player = seat->actor;
      best_dist = distance;
    }
  }
  return player;
}
