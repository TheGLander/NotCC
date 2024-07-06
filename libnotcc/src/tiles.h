#include "logic.h"

enum ActorFlags {
  ACTOR_FLAGS_BASIC_MONSTER = 1 << 0,
  ACTOR_FLAGS_FIRE_SENSIBLE = 1 << 1,
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
  ACTOR_FLAGS_NOT_GHOST = ~ACTOR_FLAGS_GHOST
};

extern const TileType FLOOR_tile;
extern const TileType WALL_tile;
extern const ActorType CHIP_actor;
extern const ActorType CENTIPEDE_actor;
extern const TileType EXIT_tile;
extern const TileType LIGHTNING_tile;

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
extern const TileType BLUE_TANK_actor;
extern const TileType ANT_actor;
extern const TileType ECHIP_tile;
extern const TileType ECHIP_GATE_tile;
extern const TileType HINT_tile;
extern const TileType DIRT_tile;
