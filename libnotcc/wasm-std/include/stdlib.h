#define NULL ((void*)0)
// typedef unsigned int size_t;
typedef __SIZE_TYPE__ size_t;
#define SIZE_MAX (4294967295UL)

extern void* malloc(size_t size);
extern void* calloc(size_t num, size_t size);
extern void* realloc(void* ptr, size_t size);
extern void free(void* ptr);
extern long atol(const char* str);
[[noreturn]] extern void abort();
extern void qsort(void* ptr,
                  size_t count,
                  size_t size,
                  int (*comp)(const void*, const void*));
