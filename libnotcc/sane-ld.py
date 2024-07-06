#!/usr/bin/env python3

# `clang` passes absolutely insane arguments to `wasm-ld` for some reason I cannot figure out
# This is a shim which throws away all the nonsense arguments and adds some `wasm-ld`-specific options
# NOTE: Probably only works on my machine?

from sys import argv, stderr, stdin, stdout
from subprocess import run
from typing import List

last_was_lc = False

real_args: List[str] = []
for arg in argv[1:]:
    if last_was_lc:
        last_was_lc = False
        continue
    if arg in ("-lc", "-L/lib", "crt1-reactor.o", "crt1.o", "-shared") or arg.startswith("/lib") or arg.startswith("/usr/lib/clang"):
        last_was_lc = arg == "-lc"
        continue
    real_args.append(arg)

real_args.append("--no-entry")
real_args.append("--export-all")
# real_args.append("--import-undefined")
proc = run(["wasm-ld", *real_args], stdin=stdin, stdout=stdout, stderr=stderr)
exit(proc.returncode)
