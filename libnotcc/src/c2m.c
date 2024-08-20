#include "c2m.h"
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "logic.h"
#include "tiles.h"

DEFINE_VECTOR(CharPtr);
DEFINE_VECTOR(PlayerInputs);

static uint16_t read_uint16_le(uint8_t* data) {
  return data[0] + (data[1] << 8);
}
static uint32_t read_uint32_le(uint8_t* data) {
  return data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
}

typedef struct SectionData {
  char name[4];
  void* data;
  uint32_t len;
} SectionData;

DEFINE_RESULT(SectionData);

static Result_SectionData unpack_section(SectionData section) {
  Result_SectionData res;
#define new_section (res.value)
  if (section.len < 2)
    res_throws("Packed data too short");
  memcpy(new_section.name, section.name, 4);

  size_t data_left = section.len;
  uint8_t* data = section.data;

  uint16_t new_length = read_uint16_le(data);
  data += 2;
  new_section.len = new_length;

  size_t new_data_left = new_length;
  uint8_t* new_data = xmalloc(new_length);
  new_section.data = new_data;

  while (data_left > 0 && new_data_left > 0) {
    uint8_t len = *data;
    data += 1;
    data_left -= 1;
    if (len < 0x80) {
      if (len > data_left) {
        free(new_data);
        res_throws("Non-reference block spans beyond end of packed data");
      }
      if (len > new_data_left) {
        free(new_data);
        res_throws("Compressed data larger than specified");
      }
      uint8_t bytes_to_copy = len;
      memcpy(new_data, data, len);
      data += len;
      data_left -= len;
      new_data += len;
      new_data_left -= len;
    } else {
      len -= 0x80;
      if (new_data_left == 0) {
        free(new_data);
        res_throws("Reference block spans beyond end of packed data");
      }

      if (len > new_data_left) {
        free(new_data);
        res_throws("Compressed data larger than specified");
      }
      uint8_t offset = *data;
      // XXX: What if `offset` is 0?
      for (uint8_t pos = 0; pos < len; pos += 1) {
        new_data[pos] = new_data[pos - offset];
      }
      data += 1;
      data_left -= 1;
      new_data += len;
      new_data_left -= len;
    }
  }
  memset(new_data, 0, new_data_left);

  res_return(new_section);
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
      Vector_CharPtr_push(&meta->hints, clue_str);
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
  Vector_CharPtr_shrink_to_fit(&meta->hints);
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
  size_t data_left = section->len;
  Replay* replay = xmalloc(sizeof(Replay));
  replay->rff_direction = dir_from_cc2(data[1] % 4);
  replay->rng_blob = data[2];
  data += 3;
  data_left -= 3;
  // Convert input/length pairs into a simple one-input-per-tick array
  Vector_PlayerInputs inputs_buf = Vector_PlayerInputs_init(500);

  // We only need one input every tick, not subtick, so mimic how `Level_tick`
  // tracks the subtick to only record movement subtick inputs
  int8_t subtick = -1;
  PlayerInputs input = 0;
  while (data_left >= 2) {
    uint8_t input_len = data[0];
    if (input_len == 0xff)
      break;
    while (input_len > 0) {
      input_len -= 1;
      subtick += 1;
      subtick %= 3;
      if (subtick == 2) {
        Vector_PlayerInputs_push(&inputs_buf, input);
      }
    }
    input = remap_cc2_input(data[1]);
    data += 2;
    data_left -= 2;
  }
  // Hold the last input until the end of time
  Vector_PlayerInputs_push(&inputs_buf, input);
  Vector_PlayerInputs_shrink_to_fit(&inputs_buf);
  replay->inputs = inputs_buf;
  level->builtin_replay = replay;
};
#undef data_left
#undef check_realloc

typedef struct C2MDef {
  enum { BASIC, BASIC_READ_MOD, ACTOR, SPECIAL } def_type;
  const void* ptr;
  uint64_t preset_custom;
} C2MDef;

enum {
  TERRAIN_MOD8,
  TERRAIN_MOD16,
  TERRAIN_MOD32,
  FRAME_BLOCK,
  THIN_WALL,
  POWER_BUTTON_ON,
  POWER_BUTTON_OFF,
  LOGIC_GATE
};

static const C2MDef c2m_tiles[] = {
    // 0x00
    {BASIC, &FLOOR_tile},
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
    // 0x10
    {BASIC_READ_MOD, &TELEPORT_RED_tile},
    {BASIC_READ_MOD, &TELEPORT_BLUE_tile},
    {BASIC, &TELEPORT_YELLOW_tile},
    {BASIC, &TELEPORT_GREEN_tile},
    {BASIC, &EXIT_tile},
    {BASIC_READ_MOD, &SLIME_tile},
    {ACTOR, &CHIP_actor},
    {ACTOR, &DIRT_BLOCK_actor},
    {ACTOR, &WALKER_actor},
    {ACTOR, &GLIDER_actor},
    {ACTOR, &ICE_BLOCK_actor},
    {BASIC, &THIN_WALL_tile, 0b0100},
    {BASIC, &THIN_WALL_tile, 0b0010},
    {BASIC, &THIN_WALL_tile, 0b0110},
    {BASIC, &GRAVEL_tile},
    {BASIC, &BUTTON_GREEN_tile},
    // 0x20
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
    {BASIC, &ECHIP_tile, false},  // Required chip
    {BASIC, &ECHIP_tile, true},   // Extra chip
    {BASIC_READ_MOD, &ECHIP_GATE_tile},
    {BASIC, &POPUP_WALL_tile},
    {BASIC, &APPEARING_WALL_tile},
    {BASIC, &INVISIBLE_WALL_tile},
    // 0x30
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
    // 0x40
    {BASIC, &BOMB_tile},
    {BASIC, &TRAP_tile,
     1},  // Open trap, trap's LSD of custom_data signifies if open
    {BASIC, &TRAP_tile},
    {BASIC, &CLONE_MACHINE_tile},  // XXX: CC1 Clone machine, is anything //
                                   // different between it and the normal kind?
    {BASIC_READ_MOD, &CLONE_MACHINE_tile},
    {BASIC, &HINT_tile},
    {BASIC, &FORCE_FLOOR_RANDOM_tile},
    {BASIC, &BUTTON_GRAY_tile},
    {BASIC, &SWIVEL_tile, DIRECTION_DOWN},
    {BASIC, &SWIVEL_tile, DIRECTION_LEFT},
    {BASIC, &SWIVEL_tile, DIRECTION_UP},
    {BASIC, &SWIVEL_tile, DIRECTION_RIGHT},
    {BASIC, &TIME_BONUS_tile},
    {BASIC, &STOPWATCH_tile},
    {BASIC_READ_MOD, &TRANSMOGRIFIER_tile},
    {BASIC_READ_MOD, &RAILROAD_tile},
    // 0x50
    {BASIC_READ_MOD, &STEEL_WALL_tile},
    {BASIC, &DYNAMITE_tile},
    {BASIC, &HELMET_tile},
    {ACTOR, 0},  // Illegal actor: Direction (Mr. 53)
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Unused
    {ACTOR, &MELINDA_actor},
    {ACTOR, &TEETH_BLUE_actor},
    {ACTOR, &EXPLOSION_actor},
    {BASIC, &DIRT_BOOTS_tile},
    {BASIC, &NO_MELINDA_SIGN_tile},
    {BASIC, &NO_CHIP_SIGN_tile},
    {SPECIAL, NULL, LOGIC_GATE},
    {ACTOR, 0},  // Illegal actor: Wire
    {BASIC_READ_MOD, &BUTTON_PURPLE_tile},
    {BASIC, &FLAME_JET_tile, false},
    // 0x60
    {BASIC, &FLAME_JET_tile, true},
    {BASIC, &BUTTON_ORANGE_tile},
    {BASIC, &LIGHTNING_BOLT_tile},
    {ACTOR, &YELLOW_TANK_actor},
    {BASIC, &BUTTON_YELLOW_tile},
    {ACTOR, &MIRROR_CHIP_actor},
    {ACTOR, &MIRROR_MELINDA_actor},
    {BASIC, 0},  // Unused
    {BASIC, &BOWLING_BALL_tile},
    {ACTOR, &ROVER_actor},
    {BASIC, &TIME_PENALTY_tile},
    {BASIC_READ_MOD, &CUSTOM_FLOOR_tile},
    {BASIC, 0},  // Unused
    {SPECIAL, NULL, THIN_WALL},
    {BASIC, 0},  // Unused
    {BASIC, &RR_SIGN_tile},
    // 0x70
    {BASIC_READ_MOD, &CUSTOM_WALL_tile},
    {BASIC_READ_MOD, &LETTER_FLOOR_tile},
    {BASIC, &HOLD_WALL_tile, false},
    {BASIC, &HOLD_WALL_tile, true},
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Unused
    {SPECIAL, NULL, TERRAIN_MOD8},
    {SPECIAL, NULL, TERRAIN_MOD16},
    {SPECIAL, NULL, TERRAIN_MOD32},
    {ACTOR, 0},  // Illegal actor: Unwire
    {BASIC, &BONUS_FLAG_tile, 10},
    {BASIC, &BONUS_FLAG_tile, 100},
    {BASIC, &BONUS_FLAG_tile, 1000},
    {BASIC, &GREEN_WALL_tile, true},
    {BASIC, &GREEN_WALL_tile, false},
    {BASIC, &NO_SIGN_tile},
    // 0x80
    {BASIC, &BONUS_FLAG_tile, 0x8002},  // 2x pts flag
    {SPECIAL, NULL, FRAME_BLOCK},
    {ACTOR, &FLOOR_MIMIC_actor},
    {BASIC, &GREEN_BOMB_tile, false},
    {BASIC, &GREEN_BOMB_tile, true},
    {BASIC, 0},  // Unused
    {BASIC, 0},  // Unused
    {SPECIAL, &BUTTON_BLACK_tile, POWER_BUTTON_ON},
    {SPECIAL, &TOGGLE_SWITCH_tile, POWER_BUTTON_OFF},
    {SPECIAL, &TOGGLE_SWITCH_tile, POWER_BUTTON_ON},
    {BASIC, &THIEF_KEY_tile},
    {ACTOR, &GHOST_actor},
    {BASIC, &STEEL_FOIL_tile},
    {BASIC, &TURTLE_tile},
    {BASIC, &SECRET_EYE_tile},
    {BASIC, &BRIBE_tile},
    // 0x90
    {BASIC, &SPEED_BOOTS_tile},
    {BASIC, 0},  // Unused
    {BASIC, &HOOK_tile},
};

static const uint64_t logic_gate_custom_data[] = {
    // 0x0
    LOGIC_GATE_NOT_UP,
    LOGIC_GATE_NOT_RIGHT,
    LOGIC_GATE_NOT_DOWN,
    LOGIC_GATE_NOT_LEFT,
    LOGIC_GATE_AND_UP,
    LOGIC_GATE_AND_RIGHT,
    LOGIC_GATE_AND_DOWN,
    LOGIC_GATE_AND_LEFT,
    LOGIC_GATE_OR_UP,
    LOGIC_GATE_OR_RIGHT,
    LOGIC_GATE_OR_DOWN,
    LOGIC_GATE_OR_LEFT,
    LOGIC_GATE_XOR_UP,
    LOGIC_GATE_XOR_RIGHT,
    LOGIC_GATE_XOR_DOWN,
    LOGIC_GATE_XOR_LEFT,
    // 0x10
    LOGIC_GATE_LATCH_UP,
    LOGIC_GATE_LATCH_RIGHT,
    LOGIC_GATE_LATCH_DOWN,
    LOGIC_GATE_LATCH_LEFT,
    LOGIC_GATE_NAND_UP,
    LOGIC_GATE_NAND_RIGHT,
    LOGIC_GATE_NAND_DOWN,
    LOGIC_GATE_NAND_LEFT,
};

static const uint64_t logic_gate_counter_data[] = {
    LOGIC_GATE_COUNTER_0, LOGIC_GATE_COUNTER_1, LOGIC_GATE_COUNTER_2,
    LOGIC_GATE_COUNTER_3, LOGIC_GATE_COUNTER_4, LOGIC_GATE_COUNTER_5,
    LOGIC_GATE_COUNTER_6, LOGIC_GATE_COUNTER_7, LOGIC_GATE_COUNTER_8,
    LOGIC_GATE_COUNTER_9,
};

static const uint64_t logic_gate_latch_mirror_data[] = {
    LOGIC_GATE_LATCH_MIRROR_UP, LOGIC_GATE_LATCH_MIRROR_RIGHT,
    LOGIC_GATE_LATCH_MIRROR_DOWN, LOGIC_GATE_LATCH_MIRROR_LEFT};

static Result_void parse_map(Level* level, SectionData* section) {
  Result_void res;
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
    if (tile_id >= lengthof(c2m_tiles)) {
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
      } else if (def.preset_custom == FRAME_BLOCK) {
        Position pos = {tiles_placed % width, tiles_placed / width};
        assert_data_avail(2);
        Actor* actor =
            Actor_new(level, &FRAME_BLOCK_actor, pos, dir_from_cc2(*data));
        actor->custom_data = data[1];
        data += 2;
      } else if (def.preset_custom == POWER_BUTTON_ON) {
        BasicTile* tile = Cell_get_layer(cell, LAYER_TERRAIN);
        tile->type = def.ptr;
        tile->custom_data = mod | 0x30;
        tiles_placed += 1;
        cell += 1;
        mod = 0;
      } else if (def.preset_custom == POWER_BUTTON_OFF) {
        BasicTile* tile = Cell_get_layer(cell, LAYER_TERRAIN);
        tile->type = def.ptr;
        tile->custom_data = mod & ~0x30;
        tiles_placed += 1;
        cell += 1;
        mod = 0;
      } else if (def.preset_custom == LOGIC_GATE) {
        BasicTile* tile = Cell_get_layer(cell, LAYER_TERRAIN);
        tile->type = &LOGIC_GATE_tile;
        if (mod < 0x18) {
          tile->custom_data = logic_gate_custom_data[mod];
        } else if (mod >= 0x1e && mod <= 0x27) {
          tile->custom_data = logic_gate_counter_data[mod - 0x1e];
        } else if (mod >= 0x40 && mod <= 0x43) {
          tile->custom_data = logic_gate_latch_mirror_data[mod - 0x40];
        } else {
          // TODO: Voodoo tile
          tile->type = &FLOOR_tile;
        }
        tiles_placed += 1;
        cell += 1;
        mod = 0;

      } else {
        res_throws("Internal: invalid custom preset type");
      }
    } else if (def.def_type == BASIC || def.def_type == BASIC_READ_MOD) {
      const TileType* type = def.ptr;
      BasicTile* tile = Cell_get_layer(cell, type->layer);
      tile->type = type;
      tile->custom_data =
          def.def_type == BASIC_READ_MOD ? mod : def.preset_custom;
      if ((type == &ECHIP_tile && def.preset_custom == 0) ||
          (type == &GREEN_BOMB_tile)) {
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
        if (level->players_left < level->player_seats.length) {
          PlayerSeat* seat = &level->player_seats.items[level->players_left];
          seat->actor = actor;
        }
        level->players_left += 1;
      }
    }
  }
  Level_init_wires(level);
  Level_initialize_tiles(level);
  res_return();
}

typedef union C2MInternalUnion {
  Level* level;
  LevelMetadata* meta;
} C2MInternalUnion;

static Result_SectionData parse_section(uint8_t** data, size_t* data_left) {
  Result_SectionData res;
#define section (res.value)
  if (*data_left < 8)
    res_throws("Section goes beyond end of file");
  *data_left -= 8;
  memcpy(section.name, *data, 4);
  *data += 4;
  section.len = read_uint32_le(*data);
  *data += 4;
  if (*data_left < section.len)
    res_throws("Section goes beyond end of file");
  section.data = *data;
  *data += section.len;
  *data_left -= section.len;

  res_return(section);
#undef section
}

static Result_void parse_c2m_internal(uint8_t* data,
                                      size_t data_len,
                                      C2MInternalUnion uni,
                                      bool meta_only) {
  Result_void res;
  Result_SectionData section_res;
#define section (section_res.value)

  LevelMetadata* meta = meta_only ? uni.meta : &uni.level->metadata;
  Level* level = meta_only ? NULL : uni.level;

  size_t data_left = data_len;

  section_res = parse_section(&data, &data_left);
  if (!section_res.success)
    res_throwr(section_res.error);

  if (memcmp(section.name, "CC2M", 4))
    res_throws("Missing CC2M header");
  // TODO: Care about this?
  uint64_t c2m_version = atol(section.data);

  while (true) {
    if (data_left == 0) {
      res_throws("C2M doesn't have END section");
    }
    section_res = parse_section(&data, &data_left);
    if (!section_res.success)
      res_throwr(section_res.error);
#define match_section(str) !memcmp(section.name, str, 4)
    if (match_section("TITL")) {
      meta->title = strndupz(section.data, section.len);
    } else if (match_section("AUTH")) {
      meta->author = strndupz(section.data, section.len);
    } else if (match_section("CLUE")) {
      meta->default_hint = strndupz(section.data, section.len);
    } else if (match_section("NOTE")) {
      parse_note(meta, &section);
    } else if (match_section("OPTN")) {
      parse_optn(meta, &section);
      if (!meta_only) {
        level->time_left = level->metadata.timer * 60;
        Level_init_players(level, level->metadata.player_n);
      }
    } else if (match_section("END ")) {
      break;
    } else if (meta_only) {
      continue;
    } else if (match_section("PACK")) {
      section_res = unpack_section(section);
      if (!section_res.success)
        res_throwr(section_res.error);
      Result_void res2 = parse_map(level, &section);
      free(section.data);
      if (!res2.success) {
        res_throwr(res2.error);
      }
    } else if (match_section("MAP ")) {
      Result_void res2 = parse_map(level, &section);
      if (!res2.success) {
        res_throwr(res2.error);
      }
    } else if (match_section("PRPL")) {
      section_res = unpack_section(section);
      if (!section_res.success)
        res_throwr(section_res.error);
      parse_rpl(level, &section);
      free(section.data);
    } else if (match_section("REPL")) {
      parse_rpl(level, &section);
    } else {
      // If this is an unknown section, do nothing.
    }
  }

  res_return();
#undef section
#undef match_section
}

Result_LevelPtr parse_c2m(void* data, size_t data_len) {
  assert(data != NULL);
  Result_LevelPtr res;
  Level* level = xmalloc(sizeof(Level));
  Level_init_basic(level);
  Result_void int_res =
      parse_c2m_internal(data, data_len, (C2MInternalUnion)level, false);
  if (!int_res.success) {
    Level_uninit(level);
    free(level);
    res_throwr(int_res.error);
  }
  res_return(level);
};
Result_LevelMetadataPtr parse_c2m_meta(void* data, size_t data_len) {
  assert(data != NULL);
  Result_LevelMetadataPtr res;
  LevelMetadata* meta = xmalloc(sizeof(LevelMetadata));
  LevelMetadata_init(meta);
  Result_void int_res =
      parse_c2m_internal(data, data_len, (C2MInternalUnion)meta, true);
  if (!int_res.success) {
    LevelMetadata_uninit(meta);
    free(meta);
    res_throwr(int_res.error);
  }
  res_return(meta);
};
