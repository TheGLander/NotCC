#define NULL ((void*)0)
// typedef unsigned int size_t;
typedef __SIZE_TYPE__ size_t;

extern void* malloc(size_t size);
extern void* calloc(size_t num, size_t size);
extern void* realloc(void* ptr, size_t size);
extern void free(void* ptr);
extern long atol(const char* str);
[[noreturn]] extern void abort();
