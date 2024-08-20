#ifndef _libnotcc_misc_h
#define _libnotcc_misc_h
#include <stdbool.h>
#include <stdio.h>

#define DEFINE_RESULT(T)      \
  typedef struct Result_##T { \
    bool success;             \
    union {                   \
      T value;                \
      char* error;            \
    };                        \
  } Result_##T;

typedef struct Result_void {
  bool success;
  char* error;
} Result_void;

// raw throw -- please only use with manually allocated strings or for
// forwarding other error strings
#define res_throwr(msg)  \
  do {                   \
    res.success = false; \
    res.error = msg;     \
    return res;          \
  } while (false);

// static string throw
#define res_throws(msg) res_throwr(strdup(msg))
char* stringf(const char* msg, ...)
    __attribute__((__format__(__printf__, 1, 2)));

// printf-formatted throw
#define res_throwf(msg, ...) res_throwr(stringf(msg, __VA_ARGS__));

// perr-style throw
#define res_throwe(msg, ...) \
  res_throwf(msg ": %s" __VA_OPT__(, ) __VA_ARGS__, strerror(errno));
#define res_return(...)                  \
  do {                                   \
    res.success = true;                  \
    __VA_OPT__(res.value = __VA_ARGS__;) \
    return res;                          \
  } while (false);

#define DECLARE_VECTOR(T) DECLARE_VECTOR_W_MOD(T, )
#define DECLARE_VECTOR_W_MOD(T, MOD)                                  \
  typedef struct Vector_##T {                                         \
    size_t length;                                                    \
    size_t capacity;                                                  \
    T* items;                                                         \
  } Vector_##T;                                                       \
  MOD Vector_##T Vector_##T##_init(size_t init_capacity);             \
  MOD void Vector_##T##_uninit(Vector_##T* self);                     \
  MOD Vector_##T Vector_##T##_clone(const Vector_##T* self);          \
  MOD void Vector_##T##_push(Vector_##T* self, T item);               \
  MOD T Vector_##T##_pop(Vector_##T* self);                           \
  MOD T* Vector_##T##_get_ptr(const Vector_##T* self, size_t idx);    \
  MOD T Vector_##T##_get(const Vector_##T* self, size_t idx);         \
  MOD void Vector_##T##_set(Vector_##T* self, size_t idx, T item);    \
  MOD void Vector_##T##_shrink_to_fit(Vector_##T* self);              \
  MOD void Vector_##T##_sort(Vector_##T* self,                        \
                             int comp(const void*, const void*));     \
  MOD T* Vector_##T##_search(const Vector_##T* self,                  \
                             bool match(void*, const T*), void* ctx); \
  MOD T* Vector_##T##_binary_search(const Vector_##T* self,           \
                                    int8_t comp(void*, const T*), void* ctx);
typedef struct Vector_any {
  size_t length;
  size_t capacity;
  void* items;
} Vector_any;
size_t Vector_any_get_length(const Vector_any* self);
void* Vector_any_get_ptr(const Vector_any* self, size_t size, size_t idx);
#endif
