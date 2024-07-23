#include "logic.h"

enum ActorFlags {
  ACTOR_FLAGS_BASIC_MONSTER = 1 << 0,
  ACTOR_FLAGS_AVOIDS_FIRE = 1 << 1,
  ACTOR_FLAGS_CANOPIABLE = 1 << 2,
  ACTOR_FLAGS_CHIP = 1 << 3,
  ACTOR_FLAGS_MELINDA = 1 << 4,
  ACTOR_FLAGS_PLAYER = ACTOR_FLAGS_CHIP | ACTOR_FLAGS_MELINDA,
  ACTOR_FLAGS_PICKS_UP_ITEMS = 1 << 5,
  ACTOR_FLAGS_IGNORES_ITEMS = 1 << 6,
  ACTOR_FLAGS_REAL_PLAYER = 1 << 7,
  ACTOR_FLAGS_FORCE_FLOOR = 1 << 8,
  ACTOR_FLAGS_BLOCK = 1 << 9,
  ACTOR_FLAGS_GHOST = 1 << 10,
  ACTOR_FLAGS_TNT_IMMUNE = 1 << 11,
  ACTOR_FLAGS_IS_ITEM = 1 << 12,
  ACTOR_FLAGS_AVOIDS_GRAVEL = 1 << 13,
  ACTOR_FLAGS_CAN_PUSH = 1 << 14,
  ACTOR_FLAGS_ANIMATION = 1 << 15,
  ACTOR_FLAGS_KILLS_PLAYER = 1 << 16,
  ACTOR_FLAGS_REVEALS_HIDDEN = 1 << 17,
  ACTOR_FLAGS_NOT_GHOST = ~ACTOR_FLAGS_GHOST
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

extern const TileType FLOOR_tile;
extern const TileType WALL_tile;
extern const ActorType CHIP_actor;
extern const ActorType CENTIPEDE_actor;
extern const TileType EXIT_tile;
extern const TileType LIGHTNING_tile;
extern const ActorType SPLASH_actor;
extern const ActorType EXPLOSION_actor;

extern const TileType ICE_tile;
extern const TileType ICE_CORNER_tile;
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
