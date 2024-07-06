#ifndef _libnotcc_logic_h
#include "../include/logic.h"
#include "accessors/struct.h"

#define right(dir) (dir) % 4 + 1
#define back(dir) (dir + 1) % 4 + 1
#define left(dir) (dir + 2) % 4 + 1
#define dir_from_cc2(dir) dir + 1

typedef struct Inventory {
  _libnotcc_accessors_Inventory
} Inventory;

#define has_item(inv, itype)                                         \
  (inv.item1 == itype || inv.item2 == itype || inv.item3 == itype || \
   inv.item4 == itype)

typedef struct Actor {
  _libnotcc_accessors_Actor
} Actor;

typedef struct BasicTile {
  _libnotcc_accessors_BasicTile
} BasicTile;

typedef struct PlayerSeat {
  _libnotcc_accessors_PlayerSeat
} PlayerSeat;

typedef struct LevelMetadata {
  _libnotcc_accessors_LevelMetadata
} LevelMetadata;

typedef struct Cell {
  BasicTile special;
  Actor* actor;
  BasicTile item_mod;
  BasicTile item;
  BasicTile terrain;
} Cell;

typedef struct Level {
  Cell* map;
  _libnotcc_accessors_Level
} Level;

typedef struct Replay {
  _libnotcc_accessors_Replay
} Replay;
#endif
