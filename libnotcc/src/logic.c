#include "logic.h"
#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "accessors/define.h"
#include "assert.h"
#include "misc.h"
#include "tiles.h"
DEFINE_VECTOR(PlayerSeat);
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

static TileType const* const CANONICAL_ITEMS[] = {
    NULL,
    &FORCE_BOOTS_tile,
    &ICE_BOOTS_tile,
    &FIRE_BOOTS_tile,
    &WATER_BOOTS_tile,
    &DYNAMITE_tile,
    &HELMET_tile,
    &DIRT_BOOTS_tile,
    &LIGHTNING_BOLT_tile,
    &BOWLING_BALL_tile,
    &TELEPORT_YELLOW_tile,
    &RR_SIGN_tile,
    &STEEL_FOIL_tile,
    &SECRET_EYE_tile,
    &BRIBE_tile,
    &SPEED_BOOTS_tile,
    &HOOK_tile,
};

void Inventory_set_items(Inventory* self,
                         ItemIndex item1,
                         ItemIndex item2,
                         ItemIndex item3,
                         ItemIndex item4) {
  self->counters = (Uint8_16){};
  ItemIndex items_to_set[] = {item1, item2, item3, item4};
  for (size_t idx = 0; idx < lengthof(items_to_set); idx += 1) {
    ItemIndex item = items_to_set[idx];
    *Inventory_get_item_by_idx(self, idx) = CANONICAL_ITEMS[item];
    if (item != 0) {
      Inventory_increment_counter(self, item);
    }
  }
};

ItemIndex TileType_get_item_index(TileType const* tile) {
  return tile == NULL ? 0 : tile->item_index;
};

size_t Position_to_offset(Position pos, size_t pitch) {
  return pos.x + pos.y * pitch;
}
Position Position_from_offset(size_t offset, size_t pitch) {
  return (Position){offset % pitch, offset / pitch};
}

_libnotcc_accessors_LastPlayerInfo;

LastPlayerInfo* Level_get_last_won_player_info_ptr(Level* self) {
  return &self->last_won_player_info;
}

Inventory* LastPlayerInfo_get_inventory_ptr(LastPlayerInfo* self) {
  return &self->inventory;
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
  for_vector(CharPtr*, hint_ptr, &self->hints) {
    free(*hint_ptr);
  }
  Vector_CharPtr_uninit(&self->hints);
  free(self->c2g_command);
}

LevelMetadata LevelMetadata_clone(const LevelMetadata* self) {
  LevelMetadata new_meta;
  memcpy(&new_meta, self, sizeof(LevelMetadata));
  new_meta.title = strdupz(self->title);
  new_meta.author = strdupz(self->author);
  new_meta.default_hint = strdupz(self->default_hint);
  new_meta.hints = Vector_CharPtr_clone(&self->hints);
  for_vector(CharPtr*, hint, &new_meta.hints) {
    *hint = strdupz(*hint);
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

bool Level_check_position_inbounds(const Level* self,
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
  self->player_seats = Vector_PlayerSeat_init(players_n);
  for (size_t idx = 0; idx < players_n; idx += 1) {
    Vector_PlayerSeat_push(&self->player_seats, (PlayerSeat){});
  }
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
    Vector_PlayerInputs_uninit(&self->builtin_replay->inputs);
    free(self->builtin_replay);
  }
  Vector_PlayerSeat_uninit(&self->player_seats);
  for_vector(WireNetwork*, wire_network, &self->wire_networks) {
    Vector_WireNetworkMember_uninit(&wire_network->members);
    Vector_WireNetworkMember_uninit(&wire_network->emitters);
  }
  Vector_WireNetwork_uninit(&self->wire_networks);
  Vector_Position_uninit(&self->wire_consumers);
}
size_t Level_total_size(const Level* self) {
  return sizeof(Level) +
         self->actors_allocated_n * (sizeof(Actor) + sizeof(Actor*)) +
         self->width * self->height * sizeof(Cell) +
         self->player_seats.capacity * sizeof(PlayerSeat);
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
    if ((has_flag(*search_position, ACTOR_FLAGS_REAL_PLAYER)) &&
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
  if (compiler_expect_prob(self->player_seats.length == 1, true, .99)) {
    PlayerSeat* seat = &self->player_seats.items[0];
    return seat->actor == player ? seat : NULL;
  }
  for_vector(PlayerSeat*, seat, &self->player_seats) {
    if (seat->actor == player) {
      return seat;
    }
  }
  return NULL;
}

Vector_PlayerSeat* Level_get_player_seats_ptr(Level* self) {
  return &self->player_seats;
}

Level* Level_clone(const Level* self) {
  Level* new_level = xmalloc(sizeof(Level));
  // Copy over all fields and modify the ones that aren't trivially copied
  memcpy(new_level, self, sizeof(Level));
  // `map`
  size_t map_size = self->width * self->height * sizeof(Cell);
  new_level->map = xmalloc(map_size);
  memcpy(new_level->map, self->map, map_size);
  new_level->player_seats = Vector_PlayerSeat_clone(&self->player_seats);
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
  new_level->wire_consumers = Vector_Position_clone(&self->wire_consumers);
  new_level->wire_networks = Vector_WireNetwork_clone(&self->wire_networks);
  for_vector(WireNetwork*, network, &new_level->wire_networks) {
    network->members = Vector_WireNetworkMember_clone(&network->members);
    network->emitters = Vector_WireNetworkMember_clone(&network->emitters);
  }
  new_level->glitches = Vector_Glitch_clone(&self->glitches);
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

// Lol
#define max(a, b) ((a) > (b) ? (a) : (b))

Cell* Level_search_taxicab(Level* self,
                           Cell* base,
                           bool (*match_func)(void* ctx,
                                              Level* level,
                                              Cell* cell),
                           void* ctx) {
  uint8_t max_dist = max(self->width, self->height) + 1;
  Position base_pos = Level_pos_from_cell(self, base);

  for (uint8_t dist = 1; dist <= max_dist; dist += 1) {
    Cell* found_cell =
        Level_search_taxicab_at_dist(self, base_pos, dist, match_func, ctx);
    if (found_cell)
      return found_cell;
  }
  return NULL;
}

Cell* Level_search_taxicab_at_dist(Level* self,
                                   Position base_pos,
                                   uint8_t dist,
                                   bool (*match_func)(void* ctx,
                                                      Level* level,
                                                      Cell* cell),
                                   void* ctx) {
  int8_t x = base_pos.x + dist;
  int8_t y = base_pos.y;
  // The stages: 1. go UL (cells 1-3) 2. go DL (cells 3-5) 3. go DR (cells
  // 5-7) 4. go UR (cells 7-1) (basically, go counterclockwise starting from
  // the rightmost cell) At `dist`=2, the checked cells will be:

  // # # 3 # #
  // # 4 # 2 #
  // 5 # x # 1
  // # 6 # 8 #
  // # # 7 # #
  for (uint8_t stage = 0; stage < 4; stage += 1) {
    for (uint8_t i = 0; i < dist; i += 1) {
      if (0 <= x && x < self->width && 0 <= y && y < self->height) {
        Cell* cell = Level_get_cell(self, (Position){x, y});
        if (match_func(ctx, self, cell))
          return cell;
      }
      x += stage > 1 ? 1 : -1;
      y += stage == 0 || stage == 3 ? -1 : 1;
    }
  }
  return NULL;
}

static bool jetlife_get_power_state(const BasicTile* tile,
                                    bool tile_before_current) {
  if (tile->type == &FIRE_tile)
    return true;
  if (tile->type == &FLAME_JET_tile) {
    // We use the second bit of flame jet's to specify if this jet was on last
    // subtick We can ignore the bit of all tiles after us (because we haven't
    // gotten to them yet this loop), and we can be sure all previous jets'
    // bit was set this loop (because we already updated them)
    return tile_before_current ? (tile->custom_data & 2)
                               : (tile->custom_data & 1);
  }
  return false;
}

static bool jetlife_power_at_offset(const Level* self,
                                    Position base,
                                    int8_t dx,
                                    int8_t dy) {
  uint8_t x;
  if (dx == 0)
    x = base.x;
  else if (dx == 1)
    x = base.x + 1;
  else if (dx == -1)
    x = base.x + self->width - 1;
  else
    compiler_expect(false, true);
  x %= self->width;
  uint8_t y;
  if (dy == 0)
    y = base.y;
  else if (dy == 1)
    y = base.y + 1;
  else if (dy == -1)
    y = base.y + self->height - 1;
  else
    compiler_expect(false, true);
  y %= self->height;
  Cell* cell = &self->map[y * self->width + x];
  Position pos = {x, y};
  bool is_checked_before_us = compare_pos_in_reading_order(&base, &pos) > 0;
  return jetlife_get_power_state(&cell->terrain, is_checked_before_us);
}

void Level_do_jetlife(Level* self) {
  for (uint8_t y = 0; y < self->height; y += 1) {
    for (uint8_t x = 0; x < self->width; x += 1) {
      Cell* cell = &self->map[y * self->width + x];
      BasicTile* jet = &cell->terrain;
      if (jet->type != &FLAME_JET_tile)
        continue;
      bool was_state = jet->custom_data & 1;
      Position pos = {x, y};
      uint8_t neighbors = 0;
      neighbors += jetlife_power_at_offset(self, pos, -1, -1);
      neighbors += jetlife_power_at_offset(self, pos, -1, 0);
      neighbors += jetlife_power_at_offset(self, pos, -1, 1);
      neighbors += jetlife_power_at_offset(self, pos, 0, -1);
      neighbors += jetlife_power_at_offset(self, pos, 0, 1);
      neighbors += jetlife_power_at_offset(self, pos, 1, -1);
      neighbors += jetlife_power_at_offset(self, pos, 1, 0);
      neighbors += jetlife_power_at_offset(self, pos, 1, 1);
      bool new_state = neighbors == 3 || (neighbors == 2 && was_state);
      jet->custom_data = (was_state << 1) | new_state;
    }
  }
}

_libnotcc_accessors_PlayerSeat;

bool PlayerSeat_has_perspective(const PlayerSeat* self) {
  return has_item_counter(self->actor->inventory, ITEM_INDEX_SECRET_EYE);
}

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
[[clang::always_inline]] void Cell_place_actor(Cell* self,
                                               Level* level,
                                               Actor* actor) {
  assert(actor != NULL);
  if (self->actor != NULL && self->actor != actor) {
    Level_add_glitch(level,
                     (Glitch){.glitch_kind = GLITCH_TYPE_DESPAWN,
                              .location = Level_pos_from_cell(level, self),
                              .specifier = GLITCH_SPECIFIER_DESPAWN_REPLACE});
  }
  self->actor = actor;
}
[[clang::always_inline]] void Cell_remove_actor(Cell* self,
                                                Level* level,
                                                Actor* actor) {
  if (self->actor != NULL && self->actor != actor) {
    Level_add_glitch(level,
                     (Glitch){.glitch_kind = GLITCH_TYPE_DESPAWN,
                              .location = Level_pos_from_cell(level, self),
                              .specifier = GLITCH_SPECIFIER_DESPAWN_REMOVE});
  }

  self->actor = NULL;
}
uint8_t Cell_get_powered_wires(Cell* self) {
  return self->powered_wires;
}
void Cell_set_powered_wires(Cell* self, uint8_t val) {
  self->powered_wires = val;
}
bool Cell_get_is_wired(Cell* self) {
  return self->is_wired;
}
void Cell_set_is_wired(Cell* self, bool val) {
  self->is_wired = val;
}

Vector_PlayerInputs* Replay_get_inputs_ptr(Replay* self) {
  return &self->inputs;
}

[[clang::always_inline]] Cell* BasicTile_get_cell(const BasicTile* tile,
                                                  Layer layer) {
  assert(layer != LAYER_ACTOR);
  size_t offset;
  if (layer == LAYER_SPECIAL)
    offset = offsetof(Cell, special);
  else if (layer == LAYER_ITEM_MOD)
    offset = offsetof(Cell, item_mod);
  else if (layer == LAYER_ITEM)
    offset = offsetof(Cell, item);
  else if (layer == LAYER_TERRAIN)
    offset = offsetof(Cell, terrain);
  else
    return NULL;
  return (Cell*)((void*)tile - offset);
}

_libnotcc_accessors_BasicTile;

bool BasicTile_impedes(BasicTile* self,
                       Level* level,
                       Actor* other,
                       Direction direction) {
  if (self->type->on_bumped_by)
    self->type->on_bumped_by(self, level, other, direction);
  if (has_flag(other, self->type->impedes_mask)) {
    if (other->type->on_bonk)
      other->type->on_bonk(other, level, self);

    return true;
  }
  if (self->type->impedes &&
      self->type->impedes(self, level, other, direction)) {
    if (other->type->on_bonk)
      other->type->on_bonk(other, level, self);

    return true;
  }
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

bool Actor_is_moving(const Actor* actor) {
  return actor->move_progress > 0;
}

bool Actor_is_gone(const Actor* actor) {
  return !actor->type || has_flag(actor, ACTOR_FLAGS_ANIMATION);
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
  Cell_place_actor(cell, level, self);
  if (self->type->init)
    self->type->init(self, level);
  return self;
}

#define NOTIFY_LAYER(_btile, _func, _level, ...) \
  if (_btile.type && _btile.type->_func)         \
    _btile.type->_func(&_btile, _level __VA_OPT__(, ) __VA_ARGS__);

#define NOTIFY_ITEM_LAYER(_cell, _func, _level, ...)                          \
  if (_cell->item.type &&                                                     \
      !(_cell->item_mod.type && _cell->item_mod.type->overrides_item_layer && \
        _cell->item_mod.type->overrides_item_layer(&_cell->item_mod, _level,  \
                                                   &_cell->item)) &&          \
      _cell->item.type->_func)                                                \
    _cell->item.type->_func(&_cell->item, _level __VA_OPT__(, ) __VA_ARGS__);

#define NOTIFY_ALL_LAYERS(_cell, _func, _level, ...)                       \
  NOTIFY_LAYER(_cell->special, _func, _level __VA_OPT__(, ) __VA_ARGS__);  \
  NOTIFY_LAYER(_cell->item_mod, _func, _level __VA_OPT__(, ) __VA_ARGS__); \
  NOTIFY_ITEM_LAYER(_cell, _func, _level __VA_OPT__(, ) __VA_ARGS__);      \
  NOTIFY_LAYER(_cell->terrain, _func, _level __VA_OPT__(, ) __VA_ARGS__);
void Actor_do_idle(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, on_idle, level, self);
}

bool Level_is_movement_subtick(Level const* level) {
  return level->current_subtick == 2;
}

void Level_apply_tank_buttons(Level* self) {
  if (!self->blue_button_pressed &&
      self->yellow_button_pressed == DIRECTION_NONE)
    return;
  for (size_t idx = 0; idx < self->actors_allocated_n; idx += 1) {
    Actor* actor = self->actors[idx];
    if (actor->type == &BLUE_TANK_actor && self->blue_button_pressed) {
      if (actor->custom_data & BLUE_TANK_ROTATE) {
        actor->custom_data &= ~BLUE_TANK_ROTATE;
      } else {
        actor->custom_data |= BLUE_TANK_ROTATE;
      }
    } else if (actor->type == &YELLOW_TANK_actor &&
               self->yellow_button_pressed) {
      actor->custom_data = self->yellow_button_pressed;
    }
  }
  self->blue_button_pressed = false;
  self->yellow_button_pressed = DIRECTION_NONE;
}

void Level_tick(Level* self) {
  // Clear all previously-released inputs
  for_vector(PlayerSeat*, seat, &self->player_seats) {
    seat->released_inputs = 0;
    seat->displayed_hint = NULL;
  }
  // Clean out the SFX. The continuous SFX are re-set each subtick, so there's
  // no point in keeping them
  self->sfx = 0;
  self->current_subtick += 1;
  if (self->current_subtick == 3) {
    self->current_tick += 1;
    self->current_subtick = 0;
  }
  if (self->time_left > 0 && !self->time_stopped) {
    self->time_left -= 1;
  }
  int32_t jetlife_interval = self->metadata.jetlife_interval;
  if (jetlife_interval != 0) {
    uint32_t subticks = self->current_tick * 3 + self->current_subtick;
    // If `jetlife_interval` is negative, it only triggers on the first subtick
    if (subticks == 0 ||
        (jetlife_interval > 0 && subticks % jetlife_interval == 0)) {
      Level_do_jetlife(self);
    }
  }
  Level_do_wire_notification(self);
  for (int32_t idx = self->actors_allocated_n - 1; idx >= 0; idx -= 1) {
    Actor* actor = self->actors[idx];
    if (actor->type == NULL)
      continue;
    Actor_do_decision(actor, self);
  }
  for (int32_t idx = self->actors_allocated_n - 1; idx >= 0; idx -= 1) {
    Actor* actor = self->actors[idx];
    if (Actor_is_gone(actor))
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
  Level_do_wire_propagation(self);
  if (self->players_left == 0 && self->game_state != GAMESTATE_CRASH) {
    if (self->game_state == GAMESTATE_PLAYING && !self->time_stopped &&
        self->time_left > 0) {
      self->time_left -= 1;
    }
    self->game_state = GAMESTATE_WON;
  } else if (self->time_left == 1 && !self->time_stopped &&
             self->game_state != GAMESTATE_CRASH) {
    self->time_left -= 1;
    self->game_state = GAMESTATE_TIMEOUT;
  }
  // Do post-tick global state cleanup
  if (self->green_button_pressed) {
    self->toggle_wall_inverted = !self->toggle_wall_inverted;
    self->green_button_pressed = false;
  }
  Level_apply_tank_buttons(self);
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
  self->pushing = false;
  self->bonked = false;
  if (has_flag(self, ACTOR_FLAGS_ANIMATION)) {
    Animation_do_decision(self, level);
    return;
  }
  if (has_flag(self, ACTOR_FLAGS_REAL_PLAYER)) {
    Player_do_decision(self, level);
    return;
  }
  if (Actor_is_moving(self) || self->frozen)
    return;
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
  self->move_decision = DIRECTION_NONE;
  if (!Level_is_movement_subtick(level) &&
      !has_flag(self, ACTOR_FLAGS_DECIDES_EVERY_SUBTICK))
    return;
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
    self->direction = dir;
    // XXX: Is the `dir` redirected by the collision check before it's set as
    // the decision, or not? I can't come up with a way to check
    if (Actor_check_collision(self, level, &dir)) {
      return;
    }
  }
}

void Actor_do_decided_move(Actor* self, Level* level) {
  if (self->move_decision == DIRECTION_NONE) {
    self->pulled = false;
    return;
  }
  self->pending_decision = DIRECTION_NONE;
  self->pending_move_locked_in = false;
  Actor_move_to(self, level, self->move_decision);
  self->pulled = false;
}

uint8_t Actor_get_move_speed(Actor* self, Level* level, Cell* cell) {
  uint8_t move_speed =
      self->type->move_duration == 0 ? 12 : self->type->move_duration;
  BasicTile* terrain = &cell->terrain;
  if (has_item_counter(self->inventory, ITEM_INDEX_SPEED_BOOTS)) {
    move_speed = move_speed / 2;
  } else if (terrain->type->modify_move_duration) {
    move_speed =
        terrain->type->modify_move_duration(terrain, level, self, move_speed);
  }
  return move_speed;
}

static void notify_actor_left(Actor* self,
                              Level* level,
                              Direction direction,
                              Cell* old_cell) {
  NOTIFY_LAYER(old_cell->special, actor_left, level, self, direction);
  if (old_cell->actor)
    return;
  NOTIFY_LAYER(old_cell->item_mod, actor_left, level, self, direction);
  if (old_cell->actor)
    return;
  NOTIFY_ITEM_LAYER(old_cell, actor_left, level, self, direction);
  if (old_cell->actor)
    return;
  Cell_remove_actor(old_cell, level, self);
  NOTIFY_LAYER(old_cell->terrain, actor_left, level, self, direction);
}

bool Actor_move_to(Actor* self, Level* level, Direction direction) {
  if (Actor_is_moving(self))
    return false;
  if (has_flag(self, ACTOR_FLAGS_ANIMATION) || self->frozen)
    return false;
  bool can_move = Actor_check_collision(self, level, &direction);
  self->direction = direction;
  self->bonked = !can_move;
  if (!can_move)
    return false;
  self->pending_decision = DIRECTION_NONE;
  self->move_decision = DIRECTION_NONE;
  Position new_pos = Level_get_neighbor(level, self->position, direction);
  Cell* old_cell = Level_get_cell(level, self->position);
  Cell* new_cell = Level_get_cell(level, new_pos);
  self->sliding_state = SLIDING_NONE;
  self->move_progress = 1;
  self->move_length = Actor_get_move_speed(self, level, new_cell);
  self->position = new_pos;
  Cell_place_actor(new_cell, level, self);
  // Intentional ordering: don't report actors that are erased that were created
  // *due* to the actor leaving. This is how dynamite always works, so
  // generating a glitch every time a dynamite is dropped would be kinda dumb
  Cell_remove_actor(old_cell, level, self);
  notify_actor_left(self, level, direction, old_cell);

  NOTIFY_ALL_LAYERS(new_cell, actor_joined, level, self, direction);

  return true;
}

void Actor_enter_tile(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  NOTIFY_ALL_LAYERS(cell, actor_completely_joined, level, self);
};

void Actor_do_cooldown(Actor* self, Level* level) {
  self->move_decision = DIRECTION_NONE;
  self->pulled = false;
  self->move_progress += 1;
  if (self->move_progress == self->move_length) {
    if (self->pending_decision != DIRECTION_NONE) {
      self->pending_move_locked_in = true;
    }
    Actor_enter_tile(self, level);
    self->move_progress = 0;
  }
}

bool Actor_push_to(Actor* self, Level* level, Direction direction) {
  // Anti-recursion check
  if (self->is_being_pushed) {
    return false;
  }
  if (self->frozen)
    return false;
  if (self->pending_move_locked_in)
    return false;
  if (self->sliding_state) {
    self->pending_decision = self->move_decision = direction;
    return false;
  }
  self->is_being_pushed = true;
  // I don't think it matters if the `direction` is redirected here
  if (Actor_is_moving(self) ||
      !Actor_check_collision(self, level, &direction)) {
    self->is_being_pushed = false;
    return false;
  }
  Actor_move_to(self, level, direction);
  self->is_being_pushed = false;
  return true;
}

bool Actor_check_collision(Actor* self, Level* level, Direction* direction) {
  assert(direction != DIRECTION_NONE);
  Cell* this_cell = Level_get_cell(level, self->position);
  Direction redir_dir;
#define CHECK_REDIRECT(layer)                                                  \
  if (this_cell->layer.type && this_cell->layer.type->redirect_exit) {         \
    redir_dir = this_cell->layer.type->redirect_exit(&this_cell->layer, level, \
                                                     self, *direction);        \
    if (redir_dir == DIRECTION_NONE) {                                         \
      if (self->type->on_bonk) {                                               \
        self->type->on_bonk(self, level, &this_cell->layer);                   \
      };                                                                       \
      return false;                                                            \
    };                                                                         \
    *direction = redir_dir;                                                    \
  }
  CHECK_REDIRECT(special);
  CHECK_REDIRECT(item_mod);
  CHECK_REDIRECT(item);
  CHECK_REDIRECT(terrain);

  if (!Level_check_position_inbounds(level, self->position, *direction,
                                     false)) {
    if (self->type->on_bonk) {
      self->type->on_bonk(self, level, NULL);
    }
    return false;
  }
  Position new_pos = Level_get_neighbor(level, self->position, *direction);
  Cell* cell = Level_get_cell(level, new_pos);
  // if `cell->actor != self`, we're a despawned actor trying to move
#define CHECK_LAYER(layer)                                      \
  if (cell->layer.type && self->type &&                         \
      BasicTile_impedes(&cell->layer, level, self, *direction)) \
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
        other->type->can_be_pushed(other, level, self, *direction, false)) {
      if (!Actor_push_to(other, level, *direction)) {
        return false;
      } else {
        self->pushing = true;
        // Yes, player mimics emit push SFX too
        if (has_flag(self, ACTOR_FLAGS_PLAYER)) {
          Level_add_sfx(level, SFX_BLOCK_PUSH);
        }
      }
    } else if (other->type)
      return false;
  } else if (cell->item.type) {
    BasicTile* item_mod = &cell->item_mod;
    BasicTile* item = &cell->item;
    if (!item_mod->type || !item_mod->type->overrides_item_layer ||
        !item_mod->type->overrides_item_layer(item_mod, level, item)) {
      if (BasicTile_impedes(item, level, self, *direction)) {
        return false;
      }
    }
  }
  if (has_item_counter(self->inventory, ITEM_INDEX_HOOK)) {
    if (!Level_check_position_inbounds(level, self->position, back(*direction),
                                       true))
      return true;
    Cell* back_tile = Level_get_cell(
        level, Level_get_neighbor(level, self->position, back(*direction)));
    Actor* pulled = back_tile->actor;
    if (!pulled)
      return true;
    bool was_pulled = pulled->pulled;
    pulled->pulled = true;
    self->pulling = true;
    // if (pulled->pending_move_locked_in && was_pulled)
    //   return true;
    if (Actor_is_moving(pulled))
      return false;
    if (!has_flag(pulled, ACTOR_FLAGS_BLOCK) ||
        (pulled->type->can_be_pushed &&
         !pulled->type->can_be_pushed(pulled, level, self, *direction, true)))
      return true;
    pulled->direction = *direction;
    if (pulled->frozen)
      return true;
    pulled->pending_decision = *direction;
    pulled->move_decision = *direction;
  }
  return true;
#undef CHECK_REDIRECT
#undef CHECK_LAYER
}

void Actor_transform_into(Actor* self, const ActorType* new_type) {
  self->type = new_type;
}

void Actor_destroy(Actor* self, Level* level, const ActorType* anim_type) {
  if (has_flag(self, ACTOR_FLAGS_REAL_PLAYER)) {
    if (level->game_state != GAMESTATE_CRASH) {
      level->game_state = GAMESTATE_DEAD;
    }
    Level_add_sfx(level, has_flag(self, ACTOR_FLAGS_MELINDA) ? SFX_MELINDA_DEATH
                                                             : SFX_CHIP_DEATH);
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
  Cell_remove_actor(cell, level, self);
  // The allocation for the actor itself will be freed in
  // `Level_compact_actor_array`
  self->type = NULL;
  level->actors_n -= 1;
}

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

uint32_t Actor_get_actor_list_idx(const Actor* self, const Level* level) {
  for (uint32_t idx = 0; idx < level->actors_allocated_n; idx += 1) {
    if (level->actors[level->actors_allocated_n - idx - 1] == self)
      return idx;
  }
  assert(!"Actor wasn't found in level's actor list");
  return 0;
}

static void Player_calculate_sliding_sfx(Actor* self, Level* level) {
  Cell* cell = Level_get_cell(level, self->position);
  bool is_on_ff = has_flag(&cell->terrain, ACTOR_FLAGS_FORCE_FLOOR) &&
                  !has_item_counter(self->inventory, ITEM_INDEX_FORCE_BOOTS);
  bool is_on_ice = has_flag(&cell->terrain, ACTOR_FLAGS_ICE) &&
                   !has_item_counter(self->inventory, ITEM_INDEX_ICE_BOOTS);
  if (is_on_ff) {
    Level_add_sfx(level, SFX_FORCE_FLOOR_SLIDE);
  }

  if (!Actor_is_moving(self) && !is_on_ice) {
    self->custom_data &= ~PLAYER_WAS_ON_ICE;
  }

  if (self->custom_data & PLAYER_WAS_ON_ICE) {
    Level_add_sfx(level, SFX_ICE_SLIDE);
  }
}

uint8_t PlayerSeat_get_possible_actions(PlayerSeat const* self,
                                        Level const* level) {
  if (!self)
    return 0;
  Actor const* actor = self->actor;
  bool can_move = (actor->sliding_state == SLIDING_NONE ||
                   (actor->sliding_state == SLIDING_WEAK &&
                    (actor->custom_data & PLAYER_HAS_OVERRIDE) != 0));
  // You can't swap players in multiseat if there isn't an extra player,
  // and `players_left` is counted at the start of the level based on the map,
  // so you can't swap to cloned or cross-level despawed players if there's only
  // one "original" player left
  bool can_switch = level->players_left > level->player_seats.length;
  // Cycling shifts all items to the right and moves the rightmost item to the
  // beginning This only does anything if there are any non-rightmost items,
  // thus something in the non-1 slot (emptyness counts as an item for the
  // purposes of cycling)
  bool can_cycle = actor->inventory.item2 || actor->inventory.item3 ||
                   actor->inventory.item4;
  bool can_drop = !level->metadata.cc1_boots && can_move &&
                  (actor->inventory.item1 || can_cycle);
  return can_move * PLAYER_INPUT_DIRECTIONAL |
         can_switch * PLAYER_INPUT_SWITCH_PLAYERS |
         can_cycle * PLAYER_INPUT_CYCLE_ITEMS |
         can_drop * PLAYER_INPUT_DROP_ITEM;
}

void Player_do_decision(Actor* self, Level* level) {
  PlayerSeat* seat = Level_find_player_seat(level, self);
  // It sucks having to do tile-related SFX stuff here, but SFX has to be
  // recalculated each subtick (even when we're moving), so...
  if (seat != NULL) {
    Player_calculate_sliding_sfx(self, level);
  }

  if (Actor_is_moving(self) || self->frozen)
    return;

  uint8_t possible_actions =
      !(seat &&
        // Subtick -1 is effectively a movement subtick
        (level->current_subtick == -1 || Level_is_movement_subtick(level)))
          ? 0
          : PlayerSeat_get_possible_actions(seat, level);

  bool character_switched = false;

#define can_do_action(action) \
  ((possible_actions & action) && has_input(seat, action))

  if (can_do_action(PLAYER_INPUT_SWITCH_PLAYERS)) {
    seat->actor = Level_find_next_player(level, self);
    assert(seat->actor != NULL && seat->actor != self);
    character_switched = true;
    seat->released_inputs |= PLAYER_INPUT_SWITCH_PLAYERS;
  }

  if (can_do_action(PLAYER_INPUT_CYCLE_ITEMS)) {
    const TileType** last_item_ptr =
        Inventory_get_rightmost_item(&self->inventory);
    if (last_item_ptr) {
      const TileType* last_item = *last_item_ptr;
      *last_item_ptr = NULL;
      Inventory_shift_right(&self->inventory);
      self->inventory.item1 = last_item;
    }
    seat->released_inputs |= PLAYER_INPUT_CYCLE_ITEMS;
  }

  if (can_do_action(PLAYER_INPUT_DROP_ITEM)) {
    Actor_drop_item(self, level);
    seat->released_inputs |= PLAYER_INPUT_DROP_ITEM;
  }

#undef can_do_action

  bool bonked = false;
  bool was_bonking = self->custom_data & PLAYER_IS_VISUALLY_BONKING;
  if (Level_is_movement_subtick(level)) {
    self->custom_data &= ~PLAYER_IS_VISUALLY_BONKING;
  }
  // `dirs[0]` is the vertical direction (if set), `dirs[1]` is the horizontal
  // dir (if set)
  Direction dirs[2] = {DIRECTION_NONE, DIRECTION_NONE};
  if (seat != NULL) {
    PlayerSeat_get_movement_directions(seat, dirs);
  }

  self->move_decision = DIRECTION_NONE;
  if (!(possible_actions & PLAYER_INPUT_DIRECTIONAL) ||
      (dirs[0] == DIRECTION_NONE && dirs[1] == DIRECTION_NONE)) {
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
    if (character_switched) {
      Level_add_glitch(
          level,
          (Glitch){.glitch_kind = GLITCH_TYPE_SIMULTANEOUS_CHARACTER_MOVEMENT,
                   .location = self->position});
    }
    Direction checked_dir;
    if (dirs[0] == DIRECTION_NONE || dirs[1] == DIRECTION_NONE) {
      Direction chosen_dir = dirs[0] == DIRECTION_NONE ? dirs[1] : dirs[0];
      checked_dir = chosen_dir;
      bonked = !Actor_check_collision(self, level, &checked_dir);
      self->move_decision = chosen_dir;
    } else {
      checked_dir = dirs[0];
      bool can_vert = Actor_check_collision(self, level, &checked_dir);
      checked_dir = dirs[1];
      bool can_horiz = Actor_check_collision(self, level, &checked_dir);
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

    // Weird quirk: If you're on a force floor, you aren't visually bonking
    Cell* cell = Level_get_cell(level, self->position);
    bool is_on_ff = has_flag(&cell->terrain, ACTOR_FLAGS_FORCE_FLOOR) &&
                    !has_item_counter(self->inventory, ITEM_INDEX_FORCE_BOOTS);
    self->custom_data |=
        (bonked && !is_on_ff) || self->pushing ? PLAYER_IS_VISUALLY_BONKING : 0;
    if (!was_bonking && bonked) {
      Level_add_sfx(level, SFX_PLAYER_BONK);
    }
  }
#undef release_input
}

Direction Player_get_last_decision(Actor* self) {
  if (self->move_decision == DIRECTION_NONE) {
    // We haven't decided yet, so return whatever direction we last had if we
    // are moving or were trying to move
    return Actor_is_moving(self) ||
                   (self->custom_data & PLAYER_IS_VISUALLY_BONKING) ||
                   self->sliding_state
               ? self->direction
               : DIRECTION_NONE;
  }
  return self->move_decision;
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
  if (has_flag(self, ACTOR_FLAGS_PLAYER)) {
    Level_add_sfx(level, SFX_ITEM_PICKUP);
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
  assert(item_layer->type == NULL || item_layer->type == &FLOOR_tile);
  if (item_type == &BOWLING_BALL_tile) {
    // We already emitted a rolling bowling ball, so don't duplicate the item
    return;
  }
  // Dropping an item while despawned crashes the game
  if (cell->actor != self) {
    Level_add_glitch(level,
                     (Glitch){.glitch_kind = GLITCH_TYPE_DROP_BY_DESPAWNED,
                              .location = self->position});
  }
  item_layer->type = item_type;
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
  const TileType* occupant_type = Cell_get_layer(cell, (*self)->layer)->type;
  if ((*self)->layer != layer_to_ignore && occupant_type != NULL &&
      occupant_type != &FLOOR_tile)
    return false;
  // Yes, we have to place the rolling bowling ball *now*, while verifying if
  // the item can be dropped. If we have four items (last is bowling ball), and
  // we try to pick up a fifth item, but emitting the bowling ball fails (due
  // to immediate collision on its way out from the dropper's cell), we *don't
  // pick the item up, even though the failed bowling ball deploy still removes
  // the bowling ball item from the dropper's inventory and thus gives room for
  // the new item*.
  if ((*self) == &BOWLING_BALL_tile) {
    // Temporarily despawn the player to move out the bowling ball actor
    Cell_remove_actor(cell, level, dropper);
    Actor* bowling_ball = Actor_new(level, &BOWLING_BALL_ROLLING_actor,
                                    dropper->position, dropper->direction);
    // HACK: The JustStartedRolling Bit™ (for black buttons, see
    // BUTTON_BLACK_actor_left)
    bowling_ball->custom_data |= 1;
    bool moved = Actor_move_to(bowling_ball, level, bowling_ball->direction);
    bowling_ball->custom_data &= ~1;
    if (!moved) {
      // Use ourselves up, even if failed
      Inventory_decrement_counter(&dropper->inventory, (*self)->item_index);
      *self = NULL;
      // We failed to move. Immediately erase the explosion anim so the dropper
      // doesn't get despawned by it later
      // TODO: This doesn't play an explosion SFX, so I guess we'll have to hack
      // around that, even though a bowling ball colliding usually should make
      // an explosion sound. ughh
      Actor_erase(bowling_ball, level);
      Cell_place_actor(cell, level, dropper);
      return false;
    }
    Cell_place_actor(cell, level, dropper);
  }
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
  if (compiler_expect_prob(self->player_seats.length == 1, true, .99)) {
    return self->player_seats.items[0].actor;
  }
  Actor* player = NULL;
  float best_dist = 0;
  for_vector(PlayerSeat*, seat, &self->player_seats) {
    if (!seat->actor)
      continue;
    PositionF pos = Actor_get_visual_position(seat->actor);
    // Taxicab distance, not Euclidean
    float distance = fabsf(pos.x - from.x) + fabsf(pos.y - from.y);
    if (!player || distance <= best_dist) {
      player = seat->actor;
      best_dist = distance;
    }
  }
  return player;
}

_libnotcc_accessors_Glitch;
uint16_t Glitch_get_location_xy(const Glitch* self) {
  return self->location.y * 0x100 + self->location.x;
}

DEFINE_VECTOR(Glitch);

void Level_add_glitch(Level* self, Glitch glitch) {
  glitch.happens_at = self->current_tick * 3 + self->current_subtick;
  Vector_Glitch_push(&self->glitches, glitch);
  if (Glitch_is_crashing(&glitch)) {
    self->game_state = GAMESTATE_CRASH;
  }
}

bool Glitch_is_crashing(const Glitch* self) {
  return self->glitch_kind == GLITCH_TYPE_DROP_BY_DESPAWNED ||
         self->glitch_kind == GLITCH_TYPE_BLUE_TELEPORT_INFINITE_LOOP;
}

Vector_Glitch* Level_get_glitches_ptr(Level* self) {
  return &self->glitches;
}

void Level_add_sfx(Level* self, uint64_t sfx) {
  self->sfx |= sfx;
}
