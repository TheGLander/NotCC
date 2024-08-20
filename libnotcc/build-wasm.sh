#!/usr/bin/env bash
if [ "$1" == "debug" ]; then
 args=-DCMAKE_BUILD_TYPE=Debug
elif [ "$1" == "release" ];then
 args=-DCMAKE_BUILD_TYPE=Release
elif [ "$1" == "optdebug" ]; then
 args=-DCMAKE_BUILD_TYPE=RelWithDebInfo
fi
set -e 
rm -rf build
mkdir build
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE=./wasm32.cmake $args
cmake --build build

./wasm-sourcemap.py build/libnotcc.so --dwarfdump $(which llvm-dwarfdump) -s -x -u libnotcc.wasm.map -w build/libnotcc.so -o build/libnotcc.so.map
