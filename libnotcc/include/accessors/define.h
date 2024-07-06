#undef _libnotcc_accessor
#define _libnotcc_accessor(stru, prop, type)     \
  type stru##_get_##prop(stru* self) {           \
    return self->prop;                           \
  };                                             \
  void stru##_set_##prop(stru* self, type val) { \
    self->prop = val;                            \
  };
