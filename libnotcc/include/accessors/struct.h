#undef _libnotcc_accessor
#undef _libnotcc_accessor_bits

#define _libnotcc_accessor(stru, prop, type) type prop;
#define _libnotcc_accessor_bits(stru, prop, type, bits) type prop : bits;
