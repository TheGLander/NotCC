#include <stdlib.h>
extern void* memmove(void* dest, const void* src, size_t count);
extern size_t strlen(const char* str);
extern size_t strnlen(const char* str, size_t max_size);
extern char* strdup(const char* str);
extern char* strndup(const char* str, size_t max_size);
extern int memcmp(const void* __s1, const void* __s2, size_t __n);
extern void* memset(void* dest, int ch, size_t count);
extern void* memcpy(void* __restrict dest,
                    const void* __restrict src,
                    size_t count);
