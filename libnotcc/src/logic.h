#ifndef _libnotcc_logic_h
#include "../include/logic.h"
#include "accessors/struct.h"

#define right(dir) ((dir) % 4 + 1)
#define back(dir) (((dir) + 1) % 4 + 1)
#define left(dir) (((dir) + 2) % 4 + 1)
#define turn_of(from, to)     \
  (right((from)) == (to)  ? 1 \
   : left((from)) == (to) ? 3 \
   : back((from)) == (to) ? 2 \
                          : 0)
#define right_n(dir, n) (((dir) + (n) - 1) % 4 + 1)
#define dir_from_cc2(dir) ((dir) + 1)
#define dir_to_cc2(dir) ((dir) - 1)
#define mirror_vert(dir)                        \
  ((dir) == DIRECTION_LEFT    ? DIRECTION_RIGHT \
   : (dir) == DIRECTION_RIGHT ? DIRECTION_LEFT  \
                              : (dir))
#define has_flag(actor, flag) \
  ((actor) && (actor)->type && ((actor)->type->flags & (flag)))

typedef struct Inventory {
  _libnotcc_accessors_Inventory
} Inventory;

#define has_item_generic(inv, itype)                                 \
  (inv.item1 == itype || inv.item2 == itype || inv.item3 == itype || \
   inv.item4 == itype)
#define has_item_counter(inv, index) (inv.counters.val[index - 1] > 0)

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

typedef struct LastPlayerInfo {
  _libnotcc_accessors_LastPlayerInfo
} LastPlayerInfo;

enum {
  POWERED_WIRE_UP = 0x1,
  POWERED_WIRE_RIGHT = 0x2,
  POWERED_WIRE_DOWN = 0x4,
  POWERED_WIRE_LEFT = 0x8,
  POWERED_WIRE_ANY = 0xf,
  POWERED_WIRE_WAS_POWERED = 0x10,
};

typedef struct Cell {
  BasicTile special;
  Actor* actor;
  BasicTile item_mod;
  BasicTile item;
  BasicTile terrain;
  uint8_t powered_wires : 4;
  uint8_t _intratick_powering_wires : 4;
  bool _intratick_last_wire_tick_parity : 1;
  bool was_powered : 1;
  bool is_wired : 1;
} Cell;

typedef struct Level {
  Cell* map;
  _libnotcc_accessors_Level
} Level;

typedef struct Replay {
  _libnotcc_accessors_Replay
} Replay;

typedef struct Glitch {
  _libnotcc_accessors_Glitch
} Glitch;
#endif
