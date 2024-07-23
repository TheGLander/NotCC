#include "c2m.h"
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "logic.h"
#include "tiles.h"

static uint16_t read_uint16_le(uint8_t* data) {
  return data[0] + (data[1] << 8);
}
static uint32_t read_uint32_le(uint8_t* data) {
  return data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
}

typedef struct SectionData {
  void* data;
  uint32_t len;
} SectionData;

static bool parse_section_internal(void** data,
                                   const char* section_name,
                                   SectionData* section_data) {
  if (section_name != NULL && memcmp(*data, section_name, 4))
    return false;
  *data += 4;
  section_data->len = *(uint32_t*)*data;
  *data += 4;
  section_data->data = *data;
  *data += section_data->len;

  return true;
}

DEFINE_RESULT(char);

static SectionData unpack_section(SectionData section) {
  uint8_t* data = section.data;
  uint16_t new_length = read_uint16_le(data);
  data += 2;
  size_t data_processed = 0;
  uint8_t* new_data = xmalloc(new_length);
  uint8_t* og_new_data = new_data;
  size_t new_data_processed = 0;

  while (data_processed + 1 < section.len && new_data_processed < new_length) {
    uint8_t len = *data;
    data += 1;
    data_processed += 1;
    if (len < 0x80) {
      memcpy(new_data, data, len);
      data += len;
      data_processed += len;
      new_data += len;
      new_data_processed += len;
    } else {
      len -= 0x80;
      uint8_t offset = *data;
      // In case `offset` is 0
      *new_data = 0;
      for (uint8_t pos = 0; pos < len; pos += 1) {
        new_data[pos] = new_data[pos - offset];
      }
      data += 1;
      data_processed += 1;
      new_data += len;
      new_data_processed += len;
    }
  }
  memset(new_data, 0, new_data_processed - new_length);

  SectionData new_section;
  new_data -= new_data_processed;
  new_section.data = new_data;
  new_section.len = new_length;
  return new_section;
}

static void parse_optn(LevelMetadata* meta, SectionData* section) {
  uint8_t* data = section->data;
  size_t len = section->len;
  if (len < 2)
    return;
  meta->timer = read_uint16_le(data);
  if (len < 3)
    return;
  data += 2;
  if (*data == 1) {
    meta->camera_width = 9;
    meta->camera_height = 9;
  } else {
    meta->camera_width = 10;
    meta->camera_height = 10;
  }
  meta->player_n = *data == 2 ? 2 : 1;
  if (len < 23)
    return;
  data += 20;
  meta->wires_hidden = *data != 0;
  if (len < 24)
    return;
  data += 1;
  meta->cc1_boots = *data != 0;
  if (len < 25)
    return;
  data += 1;
  // The user will have to pick a random number themselves
  meta->rng_blob_deterministic = *data == 0;
  meta->rng_blob_4pat = *data == 1;
}

static void parse_note(LevelMetadata* meta, SectionData* section) {
  const char* str = section->data;
  if (str[section->len - 1] != '\0' || strlen(str) != (section->len - 1))
    return;
#define str_left() (section->len - (ptrdiff_t)(str - (char*)section->data))
#define assert_not_at_end() \
  if (*str == '\0')         \
    return;
  while (*str != '\0') {
    if (str_left() > 6 && !memcmp(str, "[CLUE]", 6)) {
      str += 6;
      // [CLUE] sections are parsed weirdly. For example:
      // ```
      // [CLUE]a
      // b[c
      // [CLUE]
      // ha
      // ```
      // will result in only one hint, "b"
      // Evertyhing between the [CLUE] and next newline (\r, not \n!) is
      // discarded, and the section can only be terminated by a [
      while (*str != '\r') {
        assert_not_at_end();
        str += 1;
      }
      str += 1;
      assert_not_at_end();
      if (*str == '\n')
        str += 1;
      const char* clue_start = str;
      while (*str != '[') {
        assert_not_at_end();
        str += 1;
      }
      size_t clue_size = str - clue_start + 1;
      char* clue_str = xmalloc(clue_size);
      memcpy(clue_str, clue_start, clue_size - 1);
      clue_str[clue_size - 1] = 0;
      meta->hints_n += 1;
      meta->hints = xrealloc(meta->hints, meta->hints_n * sizeof(char*));
      meta->hints[meta->hints_n - 1] = clue_str;
    } else if (str_left() > 5 && !memcmp(str, "[COM]", 5)) {
      str += 5;
      // `7 level =[COM]1 keys =[COM]ktools flags = 1 tools =`
      // will execute everything after the first [COM]
      if (meta->c2g_command != NULL)
        continue;
      meta->c2g_command = strdupz(str);
    } else if (str_left() > 9 && !memcmp(str, "[JETLIFE]", 9)) {
      str += 9;
      meta->jetlife_interval = atol(str);
    } else {
      str += 1;
    }
  };
}
#undef str_left
#undef assert_not_at_end

#define remap_cc2_input(val)                          \
  (((val & 0x01) ? PLAYER_INPUT_DROP_ITEM : 0) |      \
   ((val & 0x02) ? PLAYER_INPUT_DOWN : 0) |           \
   ((val & 0x04) ? PLAYER_INPUT_LEFT : 0) |           \
   ((val & 0x08) ? PLAYER_INPUT_RIGHT : 0) |          \
   ((val & 0x10) ? PLAYER_INPUT_UP : 0) |             \
   ((val & 0x20) ? PLAYER_INPUT_SWITCH_PLAYERS : 0) | \
   ((val & 0x40) ? PLAYER_INPUT_CYCLE_ITEMS : 0))

static void parse_rpl(Level* level, SectionData* section) {
  const uint8_t* data = section->data;
#define data_left() (section->len - (ptrdiff_t)(data - (uint8_t*)section->data))
  Replay* replay = xmalloc(sizeof(Replay));
  replay->rff_direction = dir_from_cc2(data[1] % 4);
  replay->rng_blob = data[2];
  data += 4;
  // Convert input/length pairs into a simple one-input-per-tick array
  size_t len = 0;
  size_t alloc_size = 100;
  PlayerInputs* inputs_buf = xmalloc(alloc_size);
#define check_realloc()                            \
  if (len >= alloc_size) {                         \
    alloc_size = alloc_size * 3 / 2;               \
    inputs_buf = xrealloc(inputs_buf, alloc_size); \
  }

  // We only need one input every tick, not subtick, so mimic how `Level_tick`
  // tracks the subtick to only record movement subtick inputs
  int8_t subtick = -1;
  while (data_left() >= 2) {
    PlayerInputs input = remap_cc2_input(*data);
    uint8_t input_len = data[1];
    data += 2;
    while (input_len > 0) {
      input_len -= 1;
      subtick += 1;
      subtick %= 3;
      if (subtick == 2) {
        inputs_buf[len] = input;
        len += 1;
        check_realloc();
      }
    }
  }
  inputs_buf = xrealloc(inputs_buf, len);
  replay->inputs = inputs_buf;
  replay->replay_length = len;
  level->builtin_replay = replay;
};
#undef data_left
#undef check_realloc

typedef struct C2MDef {
  enum { BASIC, BASIC_READ_MOD, ACTOR, SPECIAL } def_type;
  const void* ptr;
  uint64_t preset_custom;
} C2MDef;

enum { TERRAIN_MOD8, TERRAIN_MOD16, TERRAIN_MOD32, FRAME_BLOCK, THIN_WALL };

static const C2MDef c2m_tiles[] = {
    {BASIC, NULL},
    {BASIC_READ_MOD, &FLOOR_tile},
    {BASIC, &WALL_tile},
    {BASIC, &ICE_tile},
    {BASIC, &ICE_CORNER_tile, DIRECTION_DOWN},
    {BASIC, &ICE_CORNER_tile, DIRECTION_LEFT},
    {BASIC, &ICE_CORNER_tile, DIRECTION_UP},
    {BASIC, &ICE_CORNER_tile, DIRECTION_RIGHT},
    {BASIC_READ_MOD, &WATER_tile},
    {BASIC_READ_MOD, &FIRE_tile},
    {BASIC, &FORCE_FLOOR_tile, DIRECTION_UP},
    {BASIC, &FORCE_FLOOR_tile, DIRECTION_RIGHT},
    {BASIC, &FORCE_FLOOR_tile, DIRECTION_DOWN},
    {BASIC, &FORCE_FLOOR_tile, DIRECTION_LEFT},
    {BASIC, &TOGGLE_WALL_tile, true},
    {BASIC, &TOGGLE_WALL_tile, false},
    {BASIC_READ_MOD, 0},  // Red Tp
    {BASIC_READ_MOD, &TELEPORT_BLUE_tile},
    {BASIC, 0},  // Yellow tp
    {BASIC, 0},  // Green tp
    {BASIC, &EXIT_tile},
    {BASIC_READ_MOD, &SLIME_tile},
    {ACTOR, &CHIP_actor},
    {ACTOR, &DIRT_BLOCK_actor},
    {ACTOR, &WALKER_actor},
    {ACTOR, &GLIDER_actor},
    {ACTOR, 0},  // Ice block
    {BASIC, &THIN_WALL_tile, 4},
    {BASIC, &THIN_WALL_tile, 2},
    {BASIC, &THIN_WALL_tile, 6},
    {BASIC, &GRAVEL_tile},
    {BASIC, &BUTTON_GREEN_tile},
    {BASIC, &BUTTON_BLUE_tile},
    {ACTOR, &BLUE_TANK_actor},
    {BASIC_READ_MOD, &DOOR_RED_tile},
    {BASIC_READ_MOD, &DOOR_BLUE_tile},
    {BASIC_READ_MOD, &DOOR_YELLOW_tile},
    {BASIC_READ_MOD, &DOOR_GREEN_tile},
    {BASIC, &KEY_RED_tile},
    {BASIC, &KEY_BLUE_tile},
    {BASIC, &KEY_YELLOW_tile},
    {BASIC, &KEY_GREEN_tile},
    {BASIC, &ECHIP_tile},
    {BASIC, &ECHIP_tile, 1},
    {BASIC_READ_MOD, &ECHIP_GATE_tile},
    {BASIC, &POPUP_WALL_tile},
    {BASIC, &APPEARING_WALL_tile},
    {BASIC, &INVISIBLE_WALL_tile},
    {BASIC, &BLUE_WALL_tile, BLUE_WALL_REAL},
    {BASIC_READ_MOD, &BLUE_WALL_tile},
    {BASIC_READ_MOD, &DIRT_tile},
    {ACTOR, &ANT_actor},
    {ACTOR, &CENTIPEDE_actor},
    {ACTOR, &BALL_actor},
    {ACTOR, &BLOB_actor},
    {ACTOR, &TEETH_RED_actor},
    {ACTOR, &FIREBALL_actor},
    {BASIC, &BUTTON_RED_tile},
    {BASIC, &BUTTON_BROWN_tile},
    {BASIC, &ICE_BOOTS_tile},
    {BASIC, &FORCE_BOOTS_tile},
    {BASIC, &FIRE_BOOTS_tile},
    {BASIC, &WATER_BOOTS_tile},
    {BASIC, &THIEF_TOOL_tile},
    {BASIC, &BOMB_tile},
    {BASIC, &TRAP_tile,
     1},  // Open trap, trap's LSD of custom_data signifies if open
    {BASIC, &TRAP_tile},
    {BASIC, &CLONE_MACHINE_tile},  // XXX: CC1 Clone machine, is anything //
                                   // different between it and the normal kind?
    {BASIC_READ_MOD, &CLONE_MACHINE_tile},
    {BASIC, &HINT_tile},
    {BASIC, &FORCE_FLOOR_RANDOM_tile},
    {BASIC, 0},  // Gray button
    {BASIC, 0},  // Swivel
    {BASIC, 0},  // Swivel
    {BASIC, 0},  // Swivel
    {BASIC, 0},  // Swivel
    {BASIC, 0},  // Time bonus
    {BASIC, 0},  // Stopwatch
    {BASIC, 0},  // Transmog
    {BASIC, 0},  // RR track
    {BASIC, 0},  // Steel wall
    {BASIC, 0},  // Dynamite
    {BASIC, 0},  // Helmet
    {BASIC, 0},  // Illegal actor: Direction (Mr. 53)
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Unused
    {ACTOR, 0},  // Melinda
    {ACTOR, 0},  // Blue teeth
    {ACTOR, &EXPLOSION_actor},
    {BASIC, 0},  // Dirt boots
    {BASIC, 0},  // No-Melinda sign
    {BASIC, 0},  // No-Chip sign
    {BASIC, 0},  // Logic gate
    {BASIC, 0},  // Illegal actor: Wire
    {BASIC, 0},  // Pink button
    {BASIC, 0},  // Flame jet OFF
    {BASIC, 0},  // Flame jet ON
    {BASIC, 0},  // Orange button
    {BASIC, 0},  // Lightning bolt
    {BASIC, 0},  // Yellow tank
    {BASIC, 0},  // Yellow button
    {BASIC, 0},  // Mirror Chip
    {BASIC, 0},  // Mirror Melinda
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Bowling ball item
    {BASIC, 0},  // Rover
    {BASIC, 0},  // Time penalty
    {BASIC, 0},  // Custom floor
    {BASIC, 0},  // Unused
    {SPECIAL, NULL, THIN_WALL},
    {BASIC, 0},                      // Unused
    {BASIC, 0},                      // RR sign
    {BASIC, 0},                      // Custom wall
    {BASIC, 0},                      // Letter tile
    {BASIC, 0},                      // Pulse wall (floor)
    {BASIC, 0},                      // Pulse wall  (wall)
    {BASIC, 0},                      // Unused
    {BASIC, 0},                      // Unused
    {SPECIAL, NULL, TERRAIN_MOD8},   // 8 modifier
    {SPECIAL, NULL, TERRAIN_MOD16},  // 16 modifier
    {SPECIAL, NULL, TERRAIN_MOD32},  // 32 modifier
    {ACTOR, 0},                      // Illegal actor: Unwire
    {BASIC, 0},                      // 10pts flag
    {BASIC, 0},                      // 100pts flag
    {BASIC, 0},                      // 1000pts flag
    {BASIC, &GREEN_WALL_tile, true},
    {BASIC, &GREEN_WALL_tile, false},
    {BASIC, 0},  // No sign
    {BASIC, 0},  // 2x pts flag
    {BASIC, 0},  // Frame block
    {BASIC, 0},  // Floor mimic
    {BASIC, 0},  // Green bomb
    {BASIC, 0},  // Green chip
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Black button
    {BASIC, 0},  // ON switch
    {BASIC, 0},  // OFF switch
    {BASIC, &THIEF_KEY_tile},
    {BASIC, 0},  // Ghost
    {BASIC, 0},  // Steel foil
    {BASIC, 0},  // Turtle
    {BASIC, 0},  // Secret eye
    {BASIC, 0},  // Bribe
    {BASIC, 0},  // Hook
};

static Result_char parse_map(Level* level, SectionData* section) {
  Result_char res;
  uint8_t* data = section->data;
  uint16_t tiles_placed = 0;
  uint8_t width = 0;
#define assert_data_avail(...)                                               \
  if (data - (uint8_t*)section->data __VA_OPT__(-1 +) __VA_ARGS__ >=         \
      section->len)                                                          \
    res_throwf("Ran out of map data on tile (%d, %d)", tiles_placed % width, \
               tiles_placed / width);
  assert_data_avail();
  width = *data;
  data += 1;
  assert_data_avail();
  uint8_t height = *data;
  data += 1;
  level->width = width;
  level->height = height;
  Cell* cells = calloc(width * height, sizeof(Cell));
  level->map = cells;
  uint32_t mod = 0;
  Cell* cell = cells;
  uint32_t hint_idx = 0;
  while (tiles_placed < width * height) {
    assert_data_avail();
    uint8_t tile_id = *data;
    data += 1;
    if (tile_id >= sizeof(c2m_tiles) / sizeof(C2MDef)) {
      res_throwf("Out-of-range tile %x", tile_id);
    }
    C2MDef def = c2m_tiles[tile_id];
    if (def.def_type != SPECIAL && def.ptr == NULL) {
      res_throwf("Unimplemented tile %x", tile_id);
    }
    if (def.def_type == SPECIAL) {
      if (def.preset_custom == TERRAIN_MOD8) {
        assert_data_avail();
        mod = *data;
        data += 1;
      } else if (def.preset_custom == TERRAIN_MOD16) {
        assert_data_avail(2);
        mod = read_uint16_le(data);
        data += 2;
      } else if (def.preset_custom == TERRAIN_MOD32) {
        assert_data_avail(4);
        mod = read_uint32_le(data);
        data += 4;
      } else if (def.preset_custom == THIN_WALL) {
        BasicTile* tile = Cell_get_layer(cell, LAYER_SPECIAL);
        tile->type = &THIN_WALL_tile;
        assert_data_avail();
        tile->custom_data = *data;
        data += 1;
      }
    } else if (def.def_type == BASIC || def.def_type == BASIC_READ_MOD) {
      const TileType* type = def.ptr;
      BasicTile* tile = Cell_get_layer(cell, type->layer);
      tile->type = type;
      tile->custom_data =
          def.def_type == BASIC_READ_MOD ? mod : def.preset_custom;
      if (type == &ECHIP_tile && def.preset_custom == 0) {
        level->chips_left += 1;
      }
      if (type == &HINT_tile) {
        tile->custom_data = hint_idx;
        hint_idx += 1;
      }
      if (type->layer == LAYER_TERRAIN) {
        tiles_placed += 1;
        cell += 1;
        mod = 0;
      }
    } else if (def.def_type == ACTOR) {
      const ActorType* type = def.ptr;
      Position pos = {tiles_placed % width, tiles_placed / width};
      assert_data_avail();
      Actor* actor = Actor_new(level, type, pos, dir_from_cc2(*data % 4));
      data += 1;
      if (type->flags & ACTOR_FLAGS_REAL_PLAYER) {
        if (level->players_left < level->players_n) {
          PlayerSeat* seat = &level->player_seats[level->players_left];
          seat->actor = actor;
        }
        level->players_left += 1;
      }
    }
  }
  Level_initialize_tiles(level);
  res_return(0);
}

typedef union C2MInternalUnion {
  Level* level;
  LevelMetadata* meta;
} C2MInternalUnion;

static Result_char parse_c2m_internal(void* data,
                                      size_t data_len,
                                      C2MInternalUnion uni,
                                      bool meta_only) {
  Result_char res;
  SectionData section;

  LevelMetadata* meta = meta_only ? uni.meta : &uni.level->metadata;
  Level* level = meta_only ? NULL : uni.level;

#define parse_section(sect) parse_section_internal(&data, sect, &section)

  void* og_data = data;
  if (!parse_section("CC2M"))
    res_throws("Missing CC2M header");
  // TODO: Care about this?
  uint64_t c2m_version = atol(section.data);

  while (true) {
    if (data - og_data >= data_len) {
      res_throws("C2M doesn't have END section");
    }
    if (parse_section("TITL")) {
      meta->title = strdupz(section.data);
    } else if (parse_section("AUTH")) {
      meta->author = strdupz(section.data);
    } else if (parse_section("CLUE")) {
      meta->default_hint = strdupz(section.data);
    } else if (parse_section("NOTE")) {
      parse_note(meta, &section);
    } else if (parse_section("OPTN")) {
      parse_optn(meta, &section);
      if (!meta_only) {
        level->players_n = level->metadata.player_n;
        level->time_left = level->metadata.timer * 60;
        Level_init_players(level, level->metadata.player_n);
      }
    } else if (parse_section("END ")) {
      break;
    } else if (meta_only) {
      parse_section(NULL);
    } else if (parse_section("PACK")) {
      section = unpack_section(section);
      Result_char res2 = parse_map(level, &section);
      free(section.data);
      if (!res2.success) {
        res_throw(res2.error);
      }
    } else if (parse_section("MAP ")) {
      Result_char res2 = parse_map(level, &section);
      free(section.data);
      if (!res2.success) {
        res_throw(res2.error);
      }
    } else if (parse_section("PRPL")) {
      section = unpack_section(section);
      parse_rpl(level, &section);
      free(section.data);
    } else if (parse_section("REPL")) {
      parse_rpl(level, &section);
    } else {
      parse_section(NULL);
    }
  }

  res_return(0);
}

Result_LevelPtr parse_c2m(void* data, size_t data_len) {
  Result_LevelPtr res;
  Level* level = xmalloc(sizeof(Level));
  Level_init_basic(level);
  Result_char int_res =
      parse_c2m_internal(data, data_len, (C2MInternalUnion)level, false);
  if (!int_res.success) {
    Level_uninit(level);
    free(level);
    res_throw(int_res.error);
  }
  res_return(level);
};
Result_LevelMetadataPtr parse_c2m_meta(void* data, size_t data_len) {
  Result_LevelMetadataPtr res;
  LevelMetadata* meta = xmalloc(sizeof(LevelMetadata));
  LevelMetadata_init(meta);
  Result_char int_res =
      parse_c2m_internal(data, data_len, (C2MInternalUnion)meta, true);
  if (!int_res.success) {
    LevelMetadata_uninit(meta);
    free(meta);
    res_throw(int_res.error);
  }
  res_return(meta);
};
