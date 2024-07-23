#include <stdbool.h>
void _wasmstd_assert(_Bool assertion);
#ifdef NDEBUG
#define assert(...)
#else
#define assert _wasmstd_assert
#endif
#define static_assert _Static_assert
