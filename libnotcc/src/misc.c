#include "misc.h"
#include <stdarg.h>
#include <stdlib.h>
char* stringf(const char* msg, ...) {
  va_list list1;
  va_list list2;
  va_start(list1, msg);
  va_copy(list2, list1);
  int string_size = vsnprintf(NULL, 0, msg, list1) + 1;
  va_end(list1);
  char* formatted_msg = malloc(string_size);
  vsnprintf(formatted_msg, string_size, msg, list2);
  va_end(list2);
  return formatted_msg;
};
