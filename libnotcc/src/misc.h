#include <stdlib.h>
#include <string.h>
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

#if defined(__has_builtin) &&                           \
    __has_builtin(__builtin_expect_with_probability) && \
    __has_builtin(__builtin_expect)
#define compiler_expect_prob(a, b, prob) \
  __builtin_expect_with_probability(a, b, prob)
#define compiler_expect(a, b) __builtin_expect(a, b)
#else
#define compiler_expect_prob(a, b, prob) (a)
#define compiler_expect(a, b) (a)
#endif

#define lengthof(arr) (sizeof(arr) / sizeof(arr[0]))

char* strdupz(const char* str) attr_malloc;
char* strndupz(const char* str, size_t max_size) attr_malloc;
void* xmalloc(size_t size) attr_malloc attr_alloc_size((1));
void* xrealloc(void* old_ptr, size_t size) attr_alloc_size((2));

#define DEFINE_VECTOR(T) DEFINE_VECTOR_W_MOD(T, )
#define DEFINE_VECTOR_STATIC(T)    \
  DECLARE_VECTOR_W_MOD(T, static); \
  DEFINE_VECTOR_W_MOD(T, static);

#define DEFINE_VECTOR_W_MOD(T, MOD)                                         \
  size_t _libnotcc_bind_##T##_size() {                                      \
    return sizeof(T);                                                       \
  };                                                                        \
  MOD Vector_##T Vector_##T##_init(size_t init_capacity) {                  \
    T* items = xmalloc(init_capacity * sizeof(T));                          \
    return (Vector_##T){                                                    \
        .length = 0, .capacity = init_capacity, .items = items};            \
  };                                                                        \
  MOD void Vector_##T##_uninit(Vector_##T* self) {                          \
    free(self->items);                                                      \
  };                                                                        \
  MOD Vector_##T Vector_##T##_clone(const Vector_##T* self) {               \
    Vector_##T new_self = {.length = self->length,                          \
                           .capacity = self->capacity};                     \
    new_self.items = xmalloc(new_self.capacity * sizeof(T));                \
    if (self->items != NULL) {                                              \
      memcpy(new_self.items, self->items, new_self.capacity * sizeof(T));   \
    }                                                                       \
    return new_self;                                                        \
  };                                                                        \
  MOD void Vector_##T##_push(Vector_##T* self, T item) {                    \
    if (self->length == self->capacity) {                                   \
      size_t new_capacity = self->capacity == 0 ? 3 : self->capacity * 2;   \
      self->items = xrealloc(self->items, sizeof(T) * new_capacity);        \
      self->capacity = new_capacity;                                        \
    }                                                                       \
    self->items[self->length] = item;                                       \
    self->length += 1;                                                      \
  };                                                                        \
  MOD T Vector_##T##_pop(Vector_##T* self) {                                \
    if (self->length == 0)                                                  \
      abort();                                                              \
    T item = self->items[self->length - 1];                                 \
    self->length -= 1;                                                      \
    return item;                                                            \
  };                                                                        \
  MOD T* Vector_##T##_get_ptr(const Vector_##T* self, size_t idx) {         \
    if (idx >= self->length)                                                \
      abort();                                                              \
    return &self->items[idx];                                               \
  };                                                                        \
  MOD T Vector_##T##_get(const Vector_##T* self, size_t idx) {              \
    return *Vector_##T##_get_ptr(self, idx);                                \
  };                                                                        \
  MOD void Vector_##T##_set(Vector_##T* self, size_t idx, T item) {         \
    if (idx >= self->length)                                                \
      abort();                                                              \
    self->items[idx] = item;                                                \
  };                                                                        \
  MOD void Vector_##T##_shrink_to_fit(Vector_##T* self) {                   \
    self->capacity = self->length;                                          \
    self->items = xrealloc(self->items, sizeof(T) * self->capacity);        \
  };                                                                        \
  MOD void Vector_##T##_sort(Vector_##T* self,                              \
                             int (*comp)(const void*, const void*)) {       \
    if (self->length < 2 || self->items == NULL)                            \
      return;                                                               \
    qsort(self->items, self->length, sizeof(T), comp);                      \
  };                                                                        \
  MOD T* Vector_##T##_search(const Vector_##T* self,                        \
                             bool (*match)(void*, const T*), void* ctx) {   \
    for_vector(T*, item, self) {                                            \
      if (match(ctx, item))                                                 \
        return item;                                                        \
    };                                                                      \
    return NULL;                                                            \
  };                                                                        \
  MOD T* Vector_##T##_binary_search(                                        \
      const Vector_##T* self, int8_t (*comp)(void*, const T*), void* ctx) { \
    if (self->items == NULL)                                                \
      return NULL;                                                          \
    size_t left_idx = 0;                                                    \
    size_t right_idx = self->length;                                        \
    while (left_idx != right_idx) {                                         \
      size_t item_idx = (left_idx + right_idx) / 2;                         \
      int8_t comp_res = comp(ctx, &self->items[item_idx]);                  \
      if (comp_res == 0)                                                    \
        return &self->items[item_idx];                                      \
      if (comp_res < 0) {                                                   \
        left_idx = item_idx + 1;                                            \
      } else {                                                              \
        right_idx = item_idx;                                               \
      }                                                                     \
    }                                                                       \
    return NULL;                                                            \
  };

#define for_vector(type_ptr, var, vec)                                \
  for (type_ptr var = (vec)->items == NULL ? NULL : &(vec)->items[0]; \
       var != NULL && var - &(vec)->items[0] < (vec)->length; var += 1)
