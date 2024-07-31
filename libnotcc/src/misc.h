#include "../include/misc.h"

#if defined(__has_attribute) && __has_attribute(__malloc__)
#define attr_malloc __attribute__((__malloc__))
#else
#define attr_malloc
#endif
#if defined(__has_attribute) && __has_attribute(__alloc_size__)
#define attr_alloc_size(params) __attribute__((__alloc_size__ params))
#else
#define attr_alloc_size
#endif
#define lengthof(arr) (sizeof(arr) / sizeof(arr[0]))

char* strdupz(const char* str) attr_malloc;
char* strndupz(const char* str, size_t max_size) attr_malloc;
void* xmalloc(size_t size) attr_malloc attr_alloc_size((1));
void* xrealloc(void* old_ptr, size_t size) attr_alloc_size((2));
