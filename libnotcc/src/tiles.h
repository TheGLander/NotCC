#ifndef _libnotcc_tiles_h
#define _libnotcc_tiles_h
#include "logic.h"

enum ActorFlags {
  ACTOR_FLAGS_BASIC_MONSTER = 1 << 0,
  ACTOR_FLAGS_AVOIDS_FIRE = 1 << 1,
  ACTOR_FLAGS_AVOIDS_CANOPY = 1 << 2,
  ACTOR_FLAGS_CHIP = 1 << 3,
  ACTOR_FLAGS_MELINDA = 1 << 4,
  ACTOR_FLAGS_PLAYER = ACTOR_FLAGS_CHIP | ACTOR_FLAGS_MELINDA,
  ACTOR_FLAGS_PICKS_UP_ITEMS = 1 << 5,
  ACTOR_FLAGS_IGNORES_ITEMS = 1 << 6,
  ACTOR_FLAGS_REAL_PLAYER = 1 << 7,
  ACTOR_FLAGS_FORCE_FLOOR = 1 << 8,
  ACTOR_FLAGS_BLOCK = 1 << 9,
  ACTOR_FLAGS_GHOST = 1 << 10,
  ACTOR_FLAGS_DYNAMITE_IMMUNE = 1 << 11,
  ACTOR_FLAGS_ITEM = 1 << 12,
  ACTOR_FLAGS_AVOIDS_GRAVEL = 1 << 13,
  ACTOR_FLAGS_CAN_PUSH = 1 << 14,
  ACTOR_FLAGS_ANIMATION = 1 << 15,
  ACTOR_FLAGS_KILLS_PLAYER = 1 << 16,
  ACTOR_FLAGS_REVEALS_HIDDEN = 1 << 17,
  ACTOR_FLAGS_AVOIDS_TURTLE = 1 << 18,
  ACTOR_FLAGS_DECIDES_EVERY_SUBTICK = 1 << 19,
  ACTOR_FLAGS_ICE = 1 << 20,
};

enum ItemIndex {
  ITEM_INDEX_FORCE_BOOTS = 1,
  ITEM_INDEX_ICE_BOOTS = 2,
  ITEM_INDEX_FIRE_BOOTS = 3,
  ITEM_INDEX_WATER_BOOTS = 4,
  ITEM_INDEX_DYNAMITE = 5,
  ITEM_INDEX_HELMET = 6,
  ITEM_INDEX_DIRT_BOOTS = 7,
  ITEM_INDEX_LIGHTNING_BOLT = 8,
  ITEM_INDEX_BOWLING_BALL = 9,
  ITEM_INDEX_YELLOW_TP = 10,
  ITEM_INDEX_RR_SIGN = 11,
  ITEM_INDEX_STEEL_FOIL = 12,
  ITEM_INDEX_SECRET_EYE = 13,
  ITEM_INDEX_BRIBE = 14,
  ITEM_INDEX_SPEED_BOOTS = 15,
  ITEM_INDEX_HOOK = 16
};

enum {
  PLAYER_HAS_OVERRIDE = 1,
  PLAYER_IS_VISUALLY_BONKING = 2,
  PLAYER_WAS_ON_ICE = 4
};

extern const TileType FLOOR_tile;
extern const TileType WALL_tile;
extern const ActorType CHIP_actor;
extern const ActorType MELINDA_actor;
extern const ActorType CENTIPEDE_actor;
extern const TileType EXIT_tile;
extern const TileType LIGHTNING_tile;
extern const ActorType SPLASH_actor;
extern const ActorType EXPLOSION_actor;

extern const TileType ICE_tile;
extern const TileType ICE_CORNER_tile;
enum { THIN_WALL_HAS_CANOPY = 0x10 };
extern const TileType THIN_WALL_tile;
extern const TileType WATER_tile;
extern const TileType FIRE_tile;
extern const TileType FORCE_FLOOR_tile;
extern const TileType TOGGLE_WALL_tile;
extern const TileType TELEPORT_RED_tile;
extern const TileType TELEPORT_BLUE_tile;
extern const TileType TELEPORT_GREEN_tile;
extern const TileType TELEPORT_YELLOW_tile;
extern const TileType SLIME_tile;
extern const ActorType DIRT_BLOCK_actor;
extern const ActorType WALKER_actor;
extern const ActorType BLOB_actor;
extern const ActorType TEETH_RED_actor;
extern const ActorType TEETH_BLUE_actor;
extern const ActorType FLOOR_MIMIC_actor;
extern const ActorType GLIDER_actor;
extern const ActorType ICE_BLOCK_actor;
extern const TileType GRAVEL_tile;
extern const TileType BUTTON_GREEN_tile;
extern const TileType BUTTON_BLUE_tile;
extern const TileType DOOR_RED_tile;
extern const TileType DOOR_BLUE_tile;
extern const TileType DOOR_YELLOW_tile;
extern const TileType DOOR_GREEN_tile;
extern const TileType KEY_RED_tile;
extern const TileType KEY_BLUE_tile;
extern const TileType KEY_YELLOW_tile;
extern const TileType KEY_GREEN_tile;
enum { BLUE_TANK_ROTATE = 8 };
extern const ActorType BLUE_TANK_actor;
extern const ActorType ANT_actor;
extern const TileType ECHIP_tile;
extern const TileType ECHIP_GATE_tile;
extern const TileType HINT_tile;
extern const TileType DIRT_tile;
extern const TileType ICE_BOOTS_tile;
extern const TileType FORCE_BOOTS_tile;
extern const TileType FIRE_BOOTS_tile;
extern const TileType WATER_BOOTS_tile;
extern const TileType DIRT_BOOTS_tile;
extern const ActorType FIREBALL_actor;
extern const ActorType BALL_actor;
extern const TileType BUTTON_BROWN_tile;
extern const TileType BUTTON_RED_tile;
extern const TileType CLONE_MACHINE_tile;
extern const TileType TRAP_tile;
extern const TileType BOMB_tile;
extern const TileType POPUP_WALL_tile;
enum { BLUE_WALL_REAL = 0x10000 };
extern const TileType BLUE_WALL_tile;
extern const TileType GREEN_WALL_tile;
extern const TileType INVISIBLE_WALL_tile;
extern const TileType APPEARING_WALL_tile;
extern const TileType THIEF_TOOL_tile;
extern const TileType THIEF_KEY_tile;
extern const TileType FORCE_FLOOR_RANDOM_tile;
extern const TileType BONUS_FLAG_tile;
extern const TileType TURTLE_tile;
extern const TileType CUSTOM_WALL_tile;
extern const TileType CUSTOM_FLOOR_tile;
extern const TileType NO_SIGN_tile;
extern const TileType LETTER_FLOOR_tile;
extern const TileType SWIVEL_tile;
extern const TileType GREEN_BOMB_tile;
extern const TileType FLAME_JET_tile;
extern const TileType BUTTON_ORANGE_tile;
extern const TileType DYNAMITE_tile;
extern const ActorType DYNAMITE_LIT_actor;
extern const TileType STEEL_WALL_tile;
extern const TileType STEEL_FOIL_tile;
extern const TileType RR_SIGN_tile;
extern const TileType HELMET_tile;
extern const TileType BRIBE_tile;
extern const TileType SPEED_BOOTS_tile;
extern const TileType SECRET_EYE_tile;
extern const TileType NO_CHIP_SIGN_tile;
extern const TileType NO_MELINDA_SIGN_tile;
extern const ActorType YELLOW_TANK_actor;
extern const TileType BUTTON_YELLOW_tile;
extern const TileType TRANSMOGRIFIER_tile;
extern const ActorType FRAME_BLOCK_actor;
extern const TileType TIME_BONUS_tile;
extern const TileType TIME_PENALTY_tile;
extern const TileType STOPWATCH_tile;
extern const ActorType ROVER_actor;
extern const ActorType MIRROR_CHIP_actor;
extern const ActorType MIRROR_MELINDA_actor;
extern const TileType BOWLING_BALL_tile;
extern const ActorType BOWLING_BALL_ROLLING_actor;
extern const TileType HOOK_tile;
extern const TileType LIGHTNING_BOLT_tile;
extern const ActorType GHOST_actor;
enum {
  RAILROAD_TRACK_UR = 0x01,
  RAILROAD_TRACK_RD = 0x02,
  RAILROAD_TRACK_DL = 0x04,
  RAILROAD_TRACK_LU = 0x08,
  RAILROAD_TRACK_LR = 0x10,
  RAILROAD_TRACK_UD = 0x20,
  RAILROAD_TRACK_MASK = 0x3f,
  RAILROAD_TRACK_SWITCH = 0x40,
  RAILROAD_ACTIVE_TRACK_MASK = 0xf00,
  RAILROAD_ENTERED_DIR_MASK = 0xf000,
};
extern const TileType RAILROAD_tile;
extern const TileType BUTTON_PURPLE_tile;
extern const TileType BUTTON_BLACK_tile;
extern const TileType BUTTON_GRAY_tile;
extern const TileType HOLD_WALL_tile;
extern const TileType TOGGLE_SWITCH_tile;
#define LGT(a, b) 0b##a##b
enum LogicGateTypes {
  LOGIC_GATE_NOT_UP = LGT(0, 0101),
  LOGIC_GATE_NOT_RIGHT = LGT(0, 1010),
  LOGIC_GATE_NOT_DOWN = LGT(1, 0101),
  LOGIC_GATE_NOT_LEFT = LGT(1, 1010),

  LOGIC_GATE_SPECIFIER_OR = 0b000,
  LOGIC_GATE_OR_UP = LGT(000, 1011),
  LOGIC_GATE_OR_RIGHT = LGT(000, 0111),
  LOGIC_GATE_OR_DOWN = LGT(000, 1110),
  LOGIC_GATE_OR_LEFT = LGT(000, 1101),

  LOGIC_GATE_SPECIFIER_AND = 0b001,
  LOGIC_GATE_AND_UP = LGT(001, 1011),
  LOGIC_GATE_AND_RIGHT = LGT(001, 0111),
  LOGIC_GATE_AND_DOWN = LGT(001, 1110),
  LOGIC_GATE_AND_LEFT = LGT(001, 1101),

  LOGIC_GATE_SPECIFIER_NAND = 0b010,
  LOGIC_GATE_NAND_UP = LGT(010, 1011),
  LOGIC_GATE_NAND_RIGHT = LGT(010, 0111),
  LOGIC_GATE_NAND_DOWN = LGT(010, 1110),
  LOGIC_GATE_NAND_LEFT = LGT(010, 1101),

  LOGIC_GATE_SPECIFIER_XOR = 0b011,
  LOGIC_GATE_XOR_UP = LGT(011, 1011),
  LOGIC_GATE_XOR_RIGHT = LGT(011, 0111),
  LOGIC_GATE_XOR_DOWN = LGT(011, 1110),
  LOGIC_GATE_XOR_LEFT = LGT(011, 1101),

  LOGIC_GATE_SPECIFIER_LATCH = 0b100,
  LOGIC_GATE_LATCH_UP = LGT(100, 1011),
  LOGIC_GATE_LATCH_RIGHT = LGT(100, 0111),
  LOGIC_GATE_LATCH_DOWN = LGT(100, 1110),
  LOGIC_GATE_LATCH_LEFT = LGT(100, 1101),

  LOGIC_GATE_SPECIFIER_LATCH_MIRROR = 0b101,
  LOGIC_GATE_LATCH_MIRROR_UP = LGT(101, 1011),
  LOGIC_GATE_LATCH_MIRROR_RIGHT = LGT(101, 0111),
  LOGIC_GATE_LATCH_MIRROR_DOWN = LGT(101, 1110),
  LOGIC_GATE_LATCH_MIRROR_LEFT = LGT(101, 1101),

  LOGIC_GATE_SPECIFIER_BITMASK = 0b01110000,

  LOGIC_GATE_COUNTER_0 = LGT(0000, 1111),
  LOGIC_GATE_COUNTER_1 = LGT(0001, 1111),
  LOGIC_GATE_COUNTER_2 = LGT(0010, 1111),
  LOGIC_GATE_COUNTER_3 = LGT(0011, 1111),
  LOGIC_GATE_COUNTER_4 = LGT(0100, 1111),
  LOGIC_GATE_COUNTER_5 = LGT(0101, 1111),
  LOGIC_GATE_COUNTER_6 = LGT(0110, 1111),
  LOGIC_GATE_COUNTER_7 = LGT(0111, 1111),
  LOGIC_GATE_COUNTER_8 = LGT(1000, 1111),
  LOGIC_GATE_COUNTER_9 = LGT(1001, 1111),
};
#undef LGT
extern const TileType LOGIC_GATE_tile;
#endif
