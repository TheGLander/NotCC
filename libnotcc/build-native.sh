#!/usr/bin/env bash
if [ "$1" == "debug" ]; then
 args=-DCMAKE_BUILD_TYPE=Debug
elif [ "$1" == "release" ];then
 args=-DCMAKE_BUILD_TYPE=Release
fi
set -e 
rm -rf native-build
mkdir native-build
cmake -S . -B native-build $args
cmake --build native-build
