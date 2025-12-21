#include "logic.h"
#include "misc.h"
#include "tiles.h"

DEFINE_VECTOR(WireNetworkMember);
DEFINE_VECTOR(WireNetwork);
DEFINE_VECTOR(Position);

static bool match_pos(void* target_pos_v, const Position* pos) {
  Position* target_pos = target_pos_v;
  return pos->x == target_pos->x && pos->y == target_pos->y;
}
static bool match_member_pos(void* target_pos_v,
                             const WireNetworkMember* member) {
  return match_pos(target_pos_v, &member->pos);
}

WireNetworkMember* Vector_WireNetworkMember_get_member(
    Vector_WireNetworkMember* self,
    Position pos) {
  WireNetworkMember* memb =
      Vector_WireNetworkMember_search(self, match_member_pos, (void*)&pos);
  if (memb)
    return memb;
  Vector_WireNetworkMember_push(self,
                                (WireNetworkMember){.pos = pos, .wires = 0});
  return &self->items[self->length - 1];
}
typedef struct ToTrace {
  Position pos;
  Direction dir;
  bool allow_tunnel;
} ToTrace;

uint8_t BasicTile_get_wire_tunnels(const BasicTile* self) {
  return self->type == &FLOOR_tile ? (self->custom_data & 0xf0) >> 4 : 0;
}
static inline uint8_t dir_to_wire(Direction dir) {
  return 1 << dir_to_cc2(dir);
}

uint8_t BasicTile_get_connected_wires(const BasicTile* self,
                                      Direction checking_from,
                                      bool allow_tunnels) {
  WireType wire_type = self->type->wire_type;
  uint8_t wires = self->custom_data & 0xf;
  uint8_t wire_tunnels = BasicTile_get_wire_tunnels(self);
  uint8_t exposed_wires = allow_tunnels ? wires : wires & ~wire_tunnels;
  uint8_t connecting_wire = dir_to_wire(checking_from);
  if (wire_type == WIRES_NONE)
    return 0;
  if (wire_type == WIRES_READ)
    return connecting_wire;
  if (!(exposed_wires & connecting_wire))
    return 0;
  if (wire_type == WIRES_UNCONNECTED)
    return connecting_wire;
  if (wire_type == WIRES_CROSS && wires != 0xf)
    return wires;
  if (wire_type == WIRES_ALWAYS_CROSS ||
      (wire_type == WIRES_CROSS && wires == 0xf))
    return (connecting_wire & 0b0101 ? 0b0101 : 0b1010) & wires;
  if (wire_type == WIRES_EVERYWHERE)
    return wires;
  // Shouldn't ever happen
  return 0;
}

Position Level_find_matching_wire_tunnel(Level* self,
                                         Position init_pos,
                                         Direction init_dir) {
  uint8_t nested_level = 0;
  uint8_t open_tunnel = dir_to_wire(init_dir);
  uint8_t close_tunnel = dir_to_wire(back(init_dir));
  Position pos = init_pos;
  while (Level_check_position_inbounds(self, pos, init_dir, false)) {
    pos = Level_get_neighbor(self, pos, init_dir);
    const BasicTile* terrain = &Level_get_cell(self, pos)->terrain;
    uint8_t tunnels = BasicTile_get_wire_tunnels(terrain);
    if (tunnels & close_tunnel) {
      if (nested_level == 0)
        return pos;
      nested_level -= 1;
    }
    if (tunnels & open_tunnel) {
      nested_level += 1;
    }
  }
  return (Position){255, 255};
}

DEFINE_VECTOR_STATIC(ToTrace);

int8_t compare_pos_in_reading_order(const Position* left,
                                    const Position* right) {
  if (left->y > right->y)
    return 1;
  if (left->y < right->y)
    return -1;
  if (left->x > right->x)
    return 1;
  if (left->x < right->x)
    return -1;
  return 0;
}

int8_t compare_wire_membs_in_reading_order(const void* target_pos_v,
                                           const WireNetworkMember* memb) {
  Position target_pos = *(Position*)target_pos_v;
  Position pos = memb->pos;
  if (pos.y > target_pos.y)
    return 1;
  else if (pos.y < target_pos.y)
    return -1;
  if (pos.x > target_pos.x)
    return 1;
  else if (pos.x < target_pos.x)
    return -1;
  return 0;
}
static int compare_membs_in_reading_order_qsort(const void* left_v,
                                                const void* right_v) {
  return compare_wire_membs_in_reading_order((const WireNetworkMember*)right_v,
                                             left_v);
}

WireNetwork Level_trace_wires_in_dir(Level* self,
                                     Position init_pos,
                                     Direction init_dir,
                                     Vector_Position* wire_consumers) {
  WireNetwork network = {};
  Vector_ToTrace to_trace_vec = Vector_ToTrace_init(4);
  Vector_ToTrace_push(&to_trace_vec, (ToTrace){init_pos, back(init_dir), true});
  bool initial_trace = true;
  while (to_trace_vec.length > 0) {
    ToTrace tracing = Vector_ToTrace_pop(&to_trace_vec);
    Cell* cell = Level_get_cell(self, tracing.pos);
    const BasicTile* terrain = &cell->terrain;
    uint8_t wires = BasicTile_get_connected_wires(terrain, back(tracing.dir),
                                                  tracing.allow_tunnel);
    if (wires == 0) {
      if (initial_trace) {
        Vector_ToTrace_uninit(&to_trace_vec);
        return network;
      }
      continue;
    }
    // HACK: If we're WIRES_READ, don't actually create a network unless the
    // neighbor is a real (read: non-WIRES_READ) wired thing
    if (initial_trace && terrain->type->wire_type == WIRES_READ) {
      bool failed_to_exist = false;
      if (!Level_check_position_inbounds(self, tracing.pos, back(tracing.dir),
                                         true)) {
        failed_to_exist = true;
      } else {
        Position neigh_pos =
            Level_get_neighbor(self, tracing.pos, back(tracing.dir));
        Cell* neigh_cell = Level_get_cell(self, neigh_pos);
        BasicTile* neigh = &neigh_cell->terrain;
        if (neigh->type->wire_type == WIRES_NONE ||
            neigh->type->wire_type == WIRES_READ ||
            !BasicTile_get_connected_wires(neigh, tracing.dir, false)) {
          failed_to_exist = true;
        }
      }
      if (failed_to_exist) {
        Vector_ToTrace_uninit(&to_trace_vec);
        return network;
      }
    }
    initial_trace = false;
    cell->is_wired = true;

    WireNetworkMember* memb =
        Vector_WireNetworkMember_get_member(&network.members, tracing.pos);
    memb->wires |= wires;

    if (terrain->type->give_power) {
      WireNetworkMember* emit_memb =
          Vector_WireNetworkMember_get_member(&network.emitters, tracing.pos);
      emit_memb->wires |= wires;
    }

    if ((terrain->type->on_wire_high || terrain->type->on_wire_low ||
         terrain->type->receive_power) &&
        wire_consumers &&
        !Vector_Position_search(wire_consumers, match_pos,
                                (void*)&tracing.pos)) {
      Vector_Position_push(wire_consumers, tracing.pos);
    }

    uint8_t tunnels = BasicTile_get_wire_tunnels(terrain);
    for (Direction dir = DIRECTION_UP; dir <= DIRECTION_LEFT; dir += 1) {
      uint8_t dir_wire = dir_to_wire(dir);
      if (!(dir_wire & wires))
        continue;
      bool is_tunnel = dir_wire & tunnels;
      bool has_neighbor = false;
      Position neigh;
      if (is_tunnel) {
        neigh = Level_find_matching_wire_tunnel(self, tracing.pos, dir);
        has_neighbor = neigh.x != 255;
      } else {
        has_neighbor =
            Level_check_position_inbounds(self, tracing.pos, dir, true);
        if (has_neighbor) {
          neigh = Level_get_neighbor(self, tracing.pos, dir);
        }
      }
      if (!has_neighbor)
        continue;
      WireNetworkMember* neigh_memb = Vector_WireNetworkMember_search(
          &network.members, match_member_pos, (void*)&neigh);
      if (neigh_memb && (neigh_memb->wires & dir_to_wire(back(dir))))
        continue;
      Vector_ToTrace_push(&to_trace_vec, (ToTrace){neigh, dir, is_tunnel});
    }
  }
  Vector_ToTrace_uninit(&to_trace_vec);
  Vector_WireNetworkMember_shrink_to_fit(&network.members);
  Vector_WireNetworkMember_sort(&network.members,
                                compare_membs_in_reading_order_qsort);
  Vector_WireNetworkMember_shrink_to_fit(&network.emitters);
  return network;
}

bool match_member_wire(void* target_memb_v, const WireNetworkMember* memb) {
  WireNetworkMember* target_memb = target_memb_v;
  return match_pos(&target_memb->pos, &memb->pos) &&
         (memb->wires & target_memb->wires);
}
bool match_network_member_wire(void* target_memb_v,
                               const WireNetwork* network) {
  return !!Vector_WireNetworkMember_search(&network->members, match_member_wire,
                                           target_memb_v);
}

static int compare_pos_in_reverse_reading_order(const void* left_v,
                                                const void* right_v) {
  const Position* left = left_v;
  const Position* right = right_v;
  return -compare_pos_in_reading_order(left, right);
}

void Level_init_wires(Level* self) {
  self->wire_consumers = Vector_Position_init(30);
  self->wire_networks = Vector_WireNetwork_init(5);
  for (uint8_t y = 0; y < self->height; y += 1) {
    for (uint8_t x = 0; x < self->width; x += 1) {
      const BasicTile* terrain =
          &Level_get_cell(self, (Position){x, y})->terrain;
      if (terrain->type->wire_type == WIRES_NONE)
        continue;
      for (Direction dir = DIRECTION_UP; dir <= DIRECTION_LEFT; dir += 1) {
        WireNetworkMember target_memb = {.pos = {x, y},
                                         .wires = dir_to_wire(dir)};
        void* existing_network = Vector_WireNetwork_search(
            &self->wire_networks, match_network_member_wire,
            (void*)&target_memb);
        if (existing_network)
          continue;
        WireNetwork network = Level_trace_wires_in_dir(
            self, target_memb.pos, dir, &self->wire_consumers);
        if (network.members.length == 0)
          continue;
        Vector_WireNetwork_push(&self->wire_networks, network);
      }
    }
  }
  Vector_Position_shrink_to_fit(&self->wire_consumers);
  Vector_Position_sort(&self->wire_consumers,
                       compare_pos_in_reverse_reading_order);
  Vector_WireNetwork_shrink_to_fit(&self->wire_networks);
}

void Level_do_wire_notification(Level* self) {
  for_vector(Position*, output_pos, &self->wire_consumers) {
    Cell* cell = Level_get_cell(self, *output_pos);
    BasicTile* terrain = &cell->terrain;
    if (terrain->type->receive_power) {
      terrain->type->receive_power(terrain, self, cell->powered_wires);
    }

    if (terrain->type->on_wire_high && cell->powered_wires &&
        !cell->was_powered) {
      terrain->type->on_wire_high(terrain, self, true);
    }

    if (terrain->type->on_wire_low && !cell->powered_wires &&
        cell->was_powered) {
      terrain->type->on_wire_low(terrain, self, true);
    }
  }
}

static inline void Cell_recalculate_power(Cell* self, Level* level) {
  if (self->terrain.type->give_power) {
    self->_intratick_powering_wires =
        self->terrain.type->give_power(&self->terrain, level);
  } else {
    self->_intratick_powering_wires = 0;
  }
  self->was_powered = self->powered_wires;
  self->powered_wires = 0;
}

void Level_do_wire_propagation(Level* self) {
  bool wire_tick_parity = (1 + self->current_subtick + self->current_tick) % 2;

  for_vector(WireNetwork*, network, &self->wire_networks) {
    bool is_powered = false;
    if (network->force_power_this_subtick) {
      network->force_power_this_subtick = false;
      is_powered = true;
    } else {
      for_vector(WireNetworkMember*, memb, &network->emitters) {
        Cell* cell = Level_get_cell(self, memb->pos);
        if (cell->_intratick_last_wire_tick_parity != wire_tick_parity) {
          cell->_intratick_last_wire_tick_parity = wire_tick_parity;
          Cell_recalculate_power(cell, self);
        }
        if (cell->_intratick_powering_wires & memb->wires) {
          is_powered = true;
          break;
        }
      }
    }
    for_vector(WireNetworkMember*, memb, &network->members) {
      Cell* cell = Level_get_cell(self, memb->pos);
      if (cell->_intratick_last_wire_tick_parity != wire_tick_parity) {
        cell->_intratick_last_wire_tick_parity = wire_tick_parity;
        Cell_recalculate_power(cell, self);
      }
      if (is_powered)
        cell->powered_wires |= memb->wires;
    }
  }
}
