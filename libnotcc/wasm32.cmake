# the name of the target operating system
set(CMAKE_SYSTEM_NAME WebAssembly)

if (CMAKE_TOOLCHAIN_FILE)
endif()

# which compilers to use for C and C++
set(CMAKE_C_COMPILER clang -target wasm32 --sysroot=${CMAKE_CURRENT_LIST_DIR}/wasm-std)
add_link_options(-fuse-ld=${CMAKE_CURRENT_LIST_DIR}/sane-ld.py)

# adjust the default behavior of the FIND_XXX() commands:
# search programs in the host environment
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NONE)

# search headers and libraries in the target environment
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
