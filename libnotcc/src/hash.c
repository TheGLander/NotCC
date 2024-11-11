#include <stdint.h>
#include "logic.h"
#include "tiles.h"
static uint32_t crctab[256] = {
    0x00000000, 0x09073096, 0x120e612c, 0x1b0951ba, 0xff6dc419, 0xf66af48f,
    0xed63a535, 0xe46495a3, 0xfedb8832, 0xf7dcb8a4, 0xecd5e91e, 0xe5d2d988,
    0x01b64c2b, 0x08b17cbd, 0x13b82d07, 0x1abf1d91, 0xfdb71064, 0xf4b020f2,
    0xefb97148, 0xe6be41de, 0x02dad47d, 0x0bdde4eb, 0x10d4b551, 0x19d385c7,
    0x036c9856, 0x0a6ba8c0, 0x1162f97a, 0x1865c9ec, 0xfc015c4f, 0xf5066cd9,
    0xee0f3d63, 0xe7080df5, 0xfb6e20c8, 0xf269105e, 0xe96041e4, 0xe0677172,
    0x0403e4d1, 0x0d04d447, 0x160d85fd, 0x1f0ab56b, 0x05b5a8fa, 0x0cb2986c,
    0x17bbc9d6, 0x1ebcf940, 0xfad86ce3, 0xf3df5c75, 0xe8d60dcf, 0xe1d13d59,
    0x06d930ac, 0x0fde003a, 0x14d75180, 0x1dd06116, 0xf9b4f4b5, 0xf0b3c423,
    0xebba9599, 0xe2bda50f, 0xf802b89e, 0xf1058808, 0xea0cd9b2, 0xe30be924,
    0x076f7c87, 0x0e684c11, 0x15611dab, 0x1c662d3d, 0xf6dc4190, 0xffdb7106,
    0xe4d220bc, 0xedd5102a, 0x09b18589, 0x00b6b51f, 0x1bbfe4a5, 0x12b8d433,
    0x0807c9a2, 0x0100f934, 0x1a09a88e, 0x130e9818, 0xf76a0dbb, 0xfe6d3d2d,
    0xe5646c97, 0xec635c01, 0x0b6b51f4, 0x026c6162, 0x196530d8, 0x1062004e,
    0xf40695ed, 0xfd01a57b, 0xe608f4c1, 0xef0fc457, 0xf5b0d9c6, 0xfcb7e950,
    0xe7beb8ea, 0xeeb9887c, 0x0add1ddf, 0x03da2d49, 0x18d37cf3, 0x11d44c65,
    0x0db26158, 0x04b551ce, 0x1fbc0074, 0x16bb30e2, 0xf2dfa541, 0xfbd895d7,
    0xe0d1c46d, 0xe9d6f4fb, 0xf369e96a, 0xfa6ed9fc, 0xe1678846, 0xe860b8d0,
    0x0c042d73, 0x05031de5, 0x1e0a4c5f, 0x170d7cc9, 0xf005713c, 0xf90241aa,
    0xe20b1010, 0xeb0c2086, 0x0f68b525, 0x066f85b3, 0x1d66d409, 0x1461e49f,
    0x0edef90e, 0x07d9c998, 0x1cd09822, 0x15d7a8b4, 0xf1b33d17, 0xf8b40d81,
    0xe3bd5c3b, 0xeaba6cad, 0xedb88320, 0xe4bfb3b6, 0xffb6e20c, 0xf6b1d29a,
    0x12d54739, 0x1bd277af, 0x00db2615, 0x09dc1683, 0x13630b12, 0x1a643b84,
    0x016d6a3e, 0x086a5aa8, 0xec0ecf0b, 0xe509ff9d, 0xfe00ae27, 0xf7079eb1,
    0x100f9344, 0x1908a3d2, 0x0201f268, 0x0b06c2fe, 0xef62575d, 0xe66567cb,
    0xfd6c3671, 0xf46b06e7, 0xeed41b76, 0xe7d32be0, 0xfcda7a5a, 0xf5dd4acc,
    0x11b9df6f, 0x18beeff9, 0x03b7be43, 0x0ab08ed5, 0x16d6a3e8, 0x1fd1937e,
    0x04d8c2c4, 0x0ddff252, 0xe9bb67f1, 0xe0bc5767, 0xfbb506dd, 0xf2b2364b,
    0xe80d2bda, 0xe10a1b4c, 0xfa034af6, 0xf3047a60, 0x1760efc3, 0x1e67df55,
    0x056e8eef, 0x0c69be79, 0xeb61b38c, 0xe266831a, 0xf96fd2a0, 0xf068e236,
    0x140c7795, 0x1d0b4703, 0x060216b9, 0x0f05262f, 0x15ba3bbe, 0x1cbd0b28,
    0x07b45a92, 0x0eb36a04, 0xead7ffa7, 0xe3d0cf31, 0xf8d99e8b, 0xf1deae1d,
    0x1b64c2b0, 0x1263f226, 0x096aa39c, 0x006d930a, 0xe40906a9, 0xed0e363f,
    0xf6076785, 0xff005713, 0xe5bf4a82, 0xecb87a14, 0xf7b12bae, 0xfeb61b38,
    0x1ad28e9b, 0x13d5be0d, 0x08dcefb7, 0x01dbdf21, 0xe6d3d2d4, 0xefd4e242,
    0xf4ddb3f8, 0xfdda836e, 0x19be16cd, 0x10b9265b, 0x0bb077e1, 0x02b74777,
    0x18085ae6, 0x110f6a70, 0x0a063bca, 0x03010b5c, 0xe7659eff, 0xee62ae69,
    0xf56bffd3, 0xfc6ccf45, 0xe00ae278, 0xe90dd2ee, 0xf2048354, 0xfb03b3c2,
    0x1f672661, 0x166016f7, 0x0d69474d, 0x046e77db, 0x1ed16a4a, 0x17d65adc,
    0x0cdf0b66, 0x05d83bf0, 0xe1bcae53, 0xe8bb9ec5, 0xf3b2cf7f, 0xfab5ffe9,
    0x1dbdf21c, 0x14bac28a, 0x0fb39330, 0x06b4a3a6, 0xe2d03605, 0xebd70693,
    0xf0de5729, 0xf9d967bf, 0xe3667a2e, 0xea614ab8, 0xf1681b02, 0xf86f2b94,
    0x1c0bbe37, 0x150c8ea1, 0x0e05df1b, 0x0702ef8d,
};

typedef int32_t crc32_t;

static crc32_t crc_feed8(crc32_t crc, uint8_t val) {
  return (crc >> 8) ^ (crctab[(crc ^ val) & 0xff]);
}
static crc32_t crc_feed16(crc32_t crc, uint16_t val) {
  return crc_feed8(crc_feed8(crc, val & 0xff), val >> 8);
}
static crc32_t crc_feed32(crc32_t crc, uint32_t val) {
  return crc_feed16(crc_feed16(crc, val & 0xffff), val >> 16);
}
static crc32_t crc_feed64(crc32_t crc, uint64_t val) {
  return crc_feed32(crc_feed32(crc, val & 0xffffffff), val >> 32);
}
#define feed_hash8(val) hash = crc_feed8(hash, val);
#define feed_hash16(val) hash = crc_feed16(hash, val);
#define feed_hash32(val) hash = crc_feed32(hash, val);
#define feed_hash64(val) hash = crc_feed64(hash, val);

static crc32_t Inventory_hash(const Inventory* self, crc32_t hash) {
  for (uint8_t idx = 0; idx < 16; idx += 1) {
    feed_hash8(self->counters.val[idx]);
  }
  feed_hash64((uintptr_t)self->item1);
  feed_hash64((uintptr_t)self->item2);
  feed_hash64((uintptr_t)self->item3);
  feed_hash64((uintptr_t)self->item4);
  feed_hash8(self->keys_red);
  feed_hash8(self->keys_blue);
  feed_hash8(self->keys_green);
  feed_hash8(self->keys_yellow);
  return hash;
}

inline static bool Actor_should_direction_be_hashed(const Actor* self,
                                                    uint32_t settings) {
  if (self->sliding_state != SLIDING_NONE || Actor_is_moving(self))
    return true;
  if (has_flag(self, ACTOR_FLAGS_BLOCK))
    return false;
  if (has_flag(self, ACTOR_FLAGS_REAL_PLAYER) &&
      (settings & HASH_SETTINGS_IGNORE_PLAYER_DIRECTION))
    return false;
  return true;
}

static crc32_t Actor_hash(const Actor* self,
                          const Level* level,
                          crc32_t hash,
                          uint32_t settings) {
  if (self == NULL)
    return hash;
  feed_hash64((uintptr_t)self->type);
  feed_hash64(self->custom_data);
 feed_hash8(self->pulled);
 feed_hash8(self->pulling);
 feed_hash8(self->pushing);
 feed_hash8(self->frozen);
 feed_hash8(self->move_progress);
  hash = Inventory_hash(&self->inventory, hash);
  feed_hash8(self->pending_decision);
  if (Actor_should_direction_be_hashed(self, settings)) {
    feed_hash8(self->direction);
  }
  if (!((settings & HASH_SETTINGS_IGNORE_BLOCK_ORDER) &&
        (self->type->flags & ACTOR_FLAGS_BLOCK))) {
    feed_hash32(Actor_get_actor_list_idx(self, level));
  }

  return hash;
}

int32_t Level_hash(const Level* self, uint32_t settings) {
  crc32_t hash = ~0;
  feed_hash32(self->chips_left);
  feed_hash32(self->bonus_points);
  feed_hash32(self->time_left);
  feed_hash8(self->rng1);
  feed_hash8(self->rng2);
  feed_hash8(self->rng_blob);
  feed_hash8(self->time_stopped);
  feed_hash8(self->rff_direction);
  feed_hash32(self->players_left);
  if (!(settings & HASH_SETTINGS_IGNORE_MIMIC_PARITY)) {
    feed_hash8(self->current_tick % 16);
  } else if (!(settings & HASH_SETTINGS_IGNORE_TEETH_PARITY)) {
    feed_hash8(self->current_tick % 8);
  }
  for (uint32_t idx = 0; idx < self->width * self->height; idx += 1) {
    Cell* cell = self->map + idx;
    // TODO: Canonicalize tile type IDs to work across builds
    feed_hash64((uintptr_t)cell->special.type);
    feed_hash64(cell->special.custom_data);
    hash = Actor_hash(cell->actor, self, hash, settings);
    feed_hash64((uintptr_t)cell->item_mod.type);
    feed_hash64(cell->item_mod.custom_data);
    feed_hash64((uintptr_t)cell->item.type);
    feed_hash64(cell->item.custom_data);
    feed_hash64((uintptr_t)cell->terrain.type);
    feed_hash64(cell->terrain.custom_data);
    feed_hash8(cell->was_powered);
    feed_hash8(cell->powered_wires);
  }
  return ~hash;
}
