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
#endif
