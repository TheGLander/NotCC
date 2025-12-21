#include "misc.h"
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
// `sprintf` but just measures and returns a string by itself
char* stringf(const char* msg, ...) {
  va_list list1;
  va_list list2;
  va_start(list1, msg);
  va_copy(list2, list1);
  int string_size = vsnprintf(NULL, 0, msg, list1) + 1;
  va_end(list1);
  char* formatted_msg = xmalloc(string_size);
  vsnprintf(formatted_msg, string_size, msg, list2);
  va_end(list2);
  return formatted_msg;
};
// Same as `strdup`, but handles NULL
char* strdupz(const char* str) {
  if (str == NULL)
    return NULL;
  size_t len = strlen(str);
  char* new_str = xmalloc(len + 1);
  memcpy(new_str, str, len + 1);
  return new_str;
}
// Same as `strndup`, but handles NULL
char* strndupz(const char* str, size_t max_size) {
  if (str == NULL)
    return NULL;
  size_t len = strnlen(str, max_size);
  char* new_str = xmalloc(len + 1);
  memcpy(new_str, str, len);
  new_str[len] = 0;
  return new_str;
}

// `strdupz` but interprets the input as Latin-1 and outputs UTF-8
char* strdupz_latin1_to_utf8(char const* str) {
  if (str == NULL)
    return NULL;
  size_t new_len = 0;
  // UTF-8 uses 1 byte to encode codepoints <=127 and 2 for >127
  for (char const* cur_char = str; *cur_char != '\0'; cur_char += 1) {
    new_len += (unsigned char)*cur_char > 127 ? 2 : 1;
  }
  char* new_str = xmalloc(new_len + 1);
  size_t new_idx = 0;
  for (char const* cur_char = str; *cur_char != '\0'; cur_char += 1) {
    unsigned char the_char = (unsigned char)*cur_char;
    if (the_char > 127) {
      // UTF-8 2-byte encoding: 110abcde 10fghiij
      new_str[new_idx] = 0b11000000 | (the_char >> 6);
      new_str[new_idx + 1] = 0b10000000 | (the_char & 0b00111111);
      new_idx += 2;
    } else {
      // UTF-8 1-byte encoding: 0abcdefg
      new_str[new_idx] = the_char;
      new_idx += 1;
    }
  }
  new_str[new_idx] = '\0';
  return new_str;
}

// `malloc`, but aborts on failure
void* xmalloc(size_t size) {
  void* ptr = malloc(size);
  if (ptr == NULL && size != 0) {
    abort();
  }
  return ptr;
}
// `realloc`, but aborts on failure and handles zero size correctly
void* xrealloc(void* old_ptr, size_t size) {
  if (size == 0) {
    if (old_ptr != NULL) {
      free(old_ptr);
    }
    return NULL;
  }
  void* ptr = realloc(old_ptr, size);
  if (ptr == NULL) {
    abort();
  }
  return ptr;
}

// Vector_any Vector_any_init(size_t capacity, size_t item_size) {
//   void* items = xmalloc(capacity * item_size);
//   return (Vector_any){.capacity = capacity, .length = 0, .items = items};
// }
// void Vector_any_uninit(Vector_any* self) {
//  free(self->items);
// }
size_t Vector_any_get_length(const Vector_any* self) {
  return self->length;
}
void* Vector_any_get_ptr(const Vector_any* self, size_t item_size, size_t idx) {
  return &self->items[idx * item_size];
};
// void Vector_any_shrink_to_fit(Vector_any* self, size_t item_size) {
//   self->capacity = self->length;
//   self->items = xrealloc(self->items, item_size * self->capacity);
// };
// void Vector_any_sort(Vector_any* self,
//                      size_t item_size,
//                      int (*comp)(const void*, const void*)) {
//   qsort(self->items, self->length, item_size, comp);
// };
// void* Vector_any_search(const Vector_any* self,
//                         size_t item_size,
//                         bool (*match)(void*, const void*),
//                         void* ctx) {
//   for (size_t idx = 0; idx < self->length; idx += 1) {
//     void* item = self->items + idx * item_size;
//     if (match(ctx, item))
//       return item;
//   };
//   return NULL;
// };
// void* Vector_any_binary_search(const Vector_any* self,
//                                size_t item_size,
//                                int8_t (*comp)(void*, const void*),
//                                void* ctx) {
//   size_t left_idx = 0;
//   size_t right_idx = self->length;
//   while (left_idx != right_idx) {
//     size_t item_idx = (left_idx + right_idx) / 2;
//     void* item = self->items + item_idx * item_size;
//     int8_t comp_res = comp(ctx, item);
//     if (comp_res == 0)
//       return item;
//     if (comp_res < 0) {
//       left_idx = item_idx + 1;
//     } else {
//       right_idx = item_idx;
//     }
//   }
//   return NULL;
// };
