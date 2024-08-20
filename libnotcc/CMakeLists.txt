cmake_minimum_required(VERSION 3.5)

project(notcc LANGUAGES C)

set(notcc_src)
list(APPEND notcc_src
  src/logic.c
  src/tiles.c
  src/c2m.c
  src/hash.c
  src/misc.c
  src/wires.c
)

if ("${CMAKE_SYSTEM_NAME}" STREQUAL "WebAssembly")
  add_compile_definitions(PAGE_SIZE=4096)
  list(APPEND notcc_src
    wasm-std/src/emmalloc.c
    wasm-std/src/std.c
    wasm-std/src/printf.c
  )
else()
add_executable(notcc-cli ${notcc_src} src/main-cli.c)
endif()

add_library(notcc SHARED ${notcc_src})

