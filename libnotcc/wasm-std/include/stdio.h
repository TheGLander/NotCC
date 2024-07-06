#include <stdarg.h>
#include <stddef.h>
extern int snprintf(char* __restrict __s,
                    size_t __maxlen,
                    const char* __restrict __format,
                    ...) __attribute__((__format__(__printf__, 3, 4)));

extern int vsnprintf(char* __restrict __s,
                     size_t __maxlen,
                     const char* __restrict __format,
                     va_list __arg)
    __attribute__((__format__(__printf__, 3, 0)));
