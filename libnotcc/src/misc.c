#include "misc.h"
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
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
char* strdupz(const char* str) {
  if (str == NULL)
    return NULL;
  size_t len = strlen(str);
  char* new_str = xmalloc(len + 1);
  memcpy(new_str, str, len + 1);
  return new_str;
}
void* xmalloc(size_t size) {
  void* ptr = malloc(size);
  if (ptr == NULL && size != 0) {
    abort();
  }
  return ptr;
}
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
