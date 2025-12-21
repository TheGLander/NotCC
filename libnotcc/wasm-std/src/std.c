#include <assert.h>
#include <math.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

extern unsigned long __builtin_wasm_memory_grow(int mem_idx,
                                                unsigned long delta);
extern unsigned long __builtin_wasm_memory_size(int mem_idx);
[[noreturn]] extern void __builtin_trap();

void _wasmstd_assert(_Bool assertion) {
  if (!assertion)
    __builtin_trap();
}
[[noreturn]] void abort() {
  __builtin_trap();
}

extern size_t __heap_base;

static uintptr_t sbrk_end = (uintptr_t)&__heap_base;

#define SBRK_ALIGNMENT (__alignof__(max_align_t))
typedef long int ssize_t;

// `resize_heap` and `sbrk` partially adapted from Emscripten
#define WASM_PAGE_SIZE 65536

static int resize_heap(size_t size) {
  size_t old_size = __builtin_wasm_memory_size(0) * WASM_PAGE_SIZE;
  if (size < old_size)
    return 1;
  ssize_t diff = (size - old_size + WASM_PAGE_SIZE - 1) / WASM_PAGE_SIZE;
  size_t result = __builtin_wasm_memory_grow(0, diff);
  // Its seems v8 has a bug in memory.grow that causes it to return
  // (uint32_t)-1 even with memory64:
  // https://bugs.chromium.org/p/v8/issues/detail?id=13948
  if (result != (uint32_t)-1 && result != (size_t)-1) {
    return 1;
  }
  return 0;
}

void* sbrk(intptr_t increment_) {
  uintptr_t increment = (uintptr_t)increment_;
  increment = (increment + (SBRK_ALIGNMENT - 1)) & ~(SBRK_ALIGNMENT - 1);
  int res = resize_heap(sbrk_end + increment);
  if (!res)
    return (void*)-1;
  void* old_sbrk_end = (void*)sbrk_end;
  sbrk_end += increment;
  return old_sbrk_end;
}

void* memset(void* dest, int ch, size_t count) {
  for (; count > 0; count -= 1) {
    ((unsigned char*)dest)[count - 1] = (unsigned char)ch;
  }
  return dest;
}
void* memcpy(void* __restrict dest, const void* __restrict src, size_t count) {
  for (; count > 0; count -= 1) {
    ((unsigned char*)dest)[count - 1] = ((unsigned char*)src)[count - 1];
  }
  return dest;
}

size_t strlen(const char* str) {
  size_t len = 0;
  while (str[len] != 0)
    len += 1;
  return len;
}
size_t strnlen(const char* str, size_t max_size) {
  size_t len = 0;
  while (len < max_size && str[len] != 0)
    len += 1;
  return len;
}

char* strdup(const char* str) {
  size_t len = strlen(str) + 1;
  char* new_str = malloc(len * sizeof(char));
  memcpy(new_str, str, len);
  return new_str;
};

void* memmove(void* dest, const void* src, size_t count) {
  if (src < dest)
    return memcpy(dest, src, count);
  for (; count > 0; count -= 1) {
    *(char*)dest++ = *(char*)src++;
  };

  return dest;
}

int isspace(int c) {
  return c == 0x20 || (c >= 0x09 && c <= 0xd);
}

long atol(const char* str) {
  // 1. Discard whitespace
  while (isspace(*str))
    str += 1;
  // 2. Consume sign
  long sign = +1;
  if (*str == '+') {
    str += 1;
  } else if (*str == '-') {
    str += 1;
    sign = -1;
  }
  // 3. Consume numbers
  long val = 0;
  while (1) {
    char ch = *str;
    if (!(ch >= '0' && ch <= '9'))
      break;
    val *= 10;
    val += ch - '0';
    str += 1;
  }
  return val * sign;
}

int memcmp(const void* rptr1, const void* rptr2, size_t num) {
  const uint8_t* ptr1 = rptr1;
  const uint8_t* ptr2 = rptr2;
  while (num > 0) {
    if (*ptr1 > *ptr2)
      return 1;
    else if (*ptr1 < *ptr2)
      return -1;
    num -= 1;
    ptr1 += 1;
    ptr2 += 1;
  }
  return 0;
}

float fabsf(float v) {
  if (v < 0.)
    return -v;
  return v;
}

static inline void qsort_merge_arrs(void* to,
                                    const void* from,
                                    size_t left_idx,
                                    size_t right_idx,
                                    size_t right_end_idx,
                                    size_t size,
                                    int (*comp)(const void*, const void*)) {
  const size_t left_end_idx = right_idx;
  for (size_t to_idx = left_idx; to_idx < right_end_idx; to_idx += 1) {
    const void* left_item = &from[left_idx * size];
    const void* right_item = &from[right_idx * size];
    void* to_item = &to[to_idx * size];
    if (left_idx == left_end_idx ||
        (right_idx != right_end_idx && comp(left_item, right_item) > 0)) {
      memcpy(to_item, right_item, size);
      right_idx += 1;
    } else {
      memcpy(to_item, left_item, size);
      left_idx += 1;
    }
  }
}
// Lol
#define min(a, b) ((a) < (b) ? (a) : (b))
// Merge sort
void qsort(void* ptr,
           size_t count,
           size_t size,
           int (*comp)(const void*, const void*)) {
  char temp_arr[count * size];
  void* from_arr = ptr;
  void* to_arr = temp_arr;
  for (size_t width = 1; width < count; width *= 2) {
    for (size_t pos = 0; pos < count; pos += 2 * width) {
      qsort_merge_arrs(to_arr, from_arr, pos, min(pos + width, count),
                       min(pos + width * 2, count), size, comp);
    }
    void* tmp_ptr = from_arr;
    from_arr = to_arr;
    to_arr = tmp_ptr;
  }
  if (from_arr != ptr) {
    memcpy(ptr, from_arr, count * size);
  }
}
