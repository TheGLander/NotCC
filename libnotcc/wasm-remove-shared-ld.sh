#!/usr/bin/env sh
# Strip the `-shared` argument since we don't want a shared library, but CMake doesn't have the concept of a non-shared non-archived library, so tell it we're making a shared library, but actually tell the linker to not do that
arguments=( $@ )
exec wasm-ld ${arguments[@]/-shared}
