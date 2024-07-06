#include "c2m.h"
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "logic.h"
#include "tiles.h"

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
  uint16_t new_length = *(uint16_t*)data;
  data += 2;
  size_t data_processed = 0;
  uint8_t* new_data = malloc(new_length);
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
  meta->timer = *(uint16_t*)data;
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
      char* clue_str = malloc(clue_size);
      memcpy(clue_str, clue_start, clue_size - 1);
      clue_str[clue_size - 1] = 0;
      meta->hints_n += 1;
      meta->hints = realloc(meta->hints, meta->hints_n * sizeof(char*));
      meta->hints[meta->hints_n - 1] = clue_str;
    } else if (str_left() > 5 && !memcmp(str, "[COM]", 5)) {
      str += 5;
      // `7 level =[COM]1 keys =[COM]ktools flags = 1 tools =`
      // will execute everything after the first [COM]
      if (meta->c2g_command != NULL)
        continue;
      meta->c2g_command = strdup(str);
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
  Replay* replay = malloc(sizeof(Replay));
  replay->rff_direction = dir_from_cc2(*(data + 1) % 4);
  replay->rng_blob = *(data + 2);
  data += 4;
  // Convert input/length pairs into a simple one-input-per-tick array
  size_t len = 0;
  size_t alloc_size = 100;
  PlayerInputs* inputs_buf = malloc(alloc_size);
#define check_realloc()                           \
  if (len >= alloc_size) {                        \
    alloc_size = alloc_size * 3 / 2;              \
    inputs_buf = realloc(inputs_buf, alloc_size); \
  }

  // We only need one input every tick, not subtick, so mimic how `Level_tick`
  // tracks the subtick to only record movement subtick inputs
  int8_t subtick = -1;
  while (data_left() >= 2) {
    PlayerInputs input = remap_cc2_input(*data);
    uint8_t input_len = *(data + 1);
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
  inputs_buf = realloc(inputs_buf, len);
  replay->inputs = inputs_buf;
  replay->replay_length = len;
  level->builtin_replay = replay;
};
#undef data_left
#undef check_realloc

typedef struct C2MDef {
  enum { BASIC, BASIC_PRESET, ACTOR } def_type;
  const void* ptr;
  uint64_t preset_custom;
} C2MDef;

static const C2MDef c2m_tiles[] = {
    {BASIC, NULL},
    {BASIC, &FLOOR_tile},
    {BASIC, &WALL_tile},
    {BASIC, &ICE_tile},
    {BASIC_PRESET, &ICE_CORNER_tile, DIRECTION_DOWN},
    {BASIC_PRESET, &ICE_CORNER_tile, DIRECTION_LEFT},
    {BASIC_PRESET, &ICE_CORNER_tile, DIRECTION_UP},
    {BASIC_PRESET, &ICE_CORNER_tile, DIRECTION_RIGHT},
    {BASIC, &WATER_tile},
    {BASIC, &FIRE_tile},
    {BASIC_PRESET, &FORCE_FLOOR_tile, DIRECTION_UP},
    {BASIC_PRESET, &FORCE_FLOOR_tile, DIRECTION_RIGHT},
    {BASIC_PRESET, &FORCE_FLOOR_tile, DIRECTION_DOWN},
    {BASIC_PRESET, &FORCE_FLOOR_tile, DIRECTION_LEFT},
    {BASIC_PRESET, &TOGGLE_WALL_tile, true},
    {BASIC_PRESET, &TOGGLE_WALL_tile, false},
    {BASIC, &TELEPORT_RED_tile},
    {BASIC, &TELEPORT_BLUE_tile},
    {BASIC, &TELEPORT_YELLOW_tile},
    {BASIC, &TELEPORT_GREEN_tile},
    {BASIC, &EXIT_tile},
    {BASIC, &SLIME_tile},
    {ACTOR, &CHIP_actor},
    {ACTOR, &DIRT_BLOCK_actor},
    // {ACTOR, &WALKER_actor},
    // {ACTOR, &GLIDER_actor},
    // {ACTOR, &ICE_BLOCK_actor},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC_PRESET, &THIN_WALL_tile, 4},
    {BASIC_PRESET, &THIN_WALL_tile, 2},
    {BASIC_PRESET, &THIN_WALL_tile, 6},
    {BASIC, &GRAVEL_tile},
    {BASIC, &BUTTON_GREEN_tile},
    {BASIC, &BUTTON_BLUE_tile},
    // {ACTOR, &BLUE_TANK_actor},
    {BASIC, 0},
    {BASIC, &DOOR_RED_tile},
    {BASIC, &DOOR_BLUE_tile},
    {BASIC, &DOOR_YELLOW_tile},
    {BASIC, &DOOR_GREEN_tile},
    {BASIC, &KEY_RED_tile},
    {BASIC, &KEY_BLUE_tile},
    {BASIC, &KEY_YELLOW_tile},
    {BASIC, &KEY_GREEN_tile},
    {BASIC, &ECHIP_tile},
    {BASIC_PRESET, &ECHIP_tile, 1},
    {BASIC, &ECHIP_GATE_tile},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, &DIRT_tile},
    {BASIC, &ANT_actor},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, 0},
    {BASIC, &HINT_tile}};

static Result_char parse_map(Level* level, SectionData* section) {
  Result_char res;
  uint8_t* data = section->data;
#define bump_data(n)                                 \
  data += n;                                         \
  if (data - (uint8_t*)section->data > section->len) \
    res_throws("Tile overflow!");
  uint8_t width = *data;
  bump_data(1);
  uint8_t height = *data;
  bump_data(1);
  level->width = width;
  level->height = height;
  Cell* cells = calloc(width * height, sizeof(Cell));
  level->map = cells;
  uint32_t mod;
  uint16_t tiles_placed = 0;
  Cell* cell = cells;
  uint32_t hint_idx = 0;
  while (tiles_placed < width * height) {
    mod = 0;
    uint8_t tile_id = *data;
    bump_data(1);
    if (tile_id >= sizeof(c2m_tiles) / sizeof(C2MDef)) {
      res_throwf("Unimplemented tile %x", tile_id);
    }
    C2MDef def = c2m_tiles[tile_id];
    if (def.ptr == NULL) {
      res_throwf("Unimplemented tile %x", tile_id);
    }
    if (def.def_type == BASIC || def.def_type == BASIC_PRESET) {
      const TileType* type = def.ptr;
      BasicTile* tile = Cell_get_layer(cell, type->layer);
      tile->type = type;
      tile->custom_data = def.def_type == BASIC ? 0 : def.preset_custom;
      if (type == &ECHIP_tile && def.def_type == BASIC) {
        level->chips_left += 1;
      }
      if (type == &HINT_tile) {
        tile->custom_data = hint_idx;
        hint_idx += 1;
      }
      if (type->layer == LAYER_TERRAIN) {
        tiles_placed += 1;
        cell += 1;
      }
    } else if (def.def_type == ACTOR) {
      const ActorType* type = def.ptr;
      Position pos = {tiles_placed % width, tiles_placed / width};
      Actor* actor = Actor_new(level, type, pos, dir_from_cc2(*data % 4));
      if (type->flags & ACTOR_FLAGS_REAL_PLAYER) {
        if (level->players_left < level->players_n) {
          PlayerSeat* seat = level->player_seats + level->players_left;
          seat->actor = actor;
        }
        level->players_left += 1;
      }

      bump_data(1);
    }
  }
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
      Level_uninit(level);
      res_throws("C2M doesn't have END section");
    }
    if (parse_section("TITL")) {
      meta->title = strdup(section.data);
    } else if (parse_section("AUTH")) {
      meta->author = strdup(section.data);
    } else if (parse_section("CLUE")) {
      meta->default_hint = strdup(section.data);
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
        Level_uninit(level);
        res_throw(res2.error);
      }
    } else if (parse_section("MAP ")) {
      Result_char res2 = parse_map(level, &section);
      free(section.data);
      if (!res2.success) {
        Level_uninit(level);
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
  Level* level = malloc(sizeof(Level));
  Level_init_basic(level);
  Result_char int_res =
      parse_c2m_internal(data, data_len, (C2MInternalUnion)level, false);
  if (!int_res.success)
    res_throw(int_res.error);
  res_return(level);
};
Result_LevelMetadataPtr parse_c2m_meta(void* data, size_t data_len) {
  Result_LevelMetadataPtr res;
  LevelMetadata* meta = malloc(sizeof(LevelMetadata));
  LevelMetadata_init(meta);
  Result_char int_res =
      parse_c2m_internal(data, data_len, (C2MInternalUnion)meta, true);
  if (!int_res.success)
    res_throw(int_res.error);
  res_return(meta);
};
