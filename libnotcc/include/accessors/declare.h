#undef _libnotcc_accessor
#undef _libnotcc_accessor_bits

#define _libnotcc_accessor(stru, prop, type) \
  type stru##_get_##prop(stru* self);        \
  void stru##_set_##prop(stru* self, type val);

#define _libnotcc_accessor_bits(stru, prop, type, bits) \
  _libnotcc_accessor(stru, prop, type)
