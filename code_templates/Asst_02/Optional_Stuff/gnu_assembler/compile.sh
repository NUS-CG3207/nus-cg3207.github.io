#!/bin/sh


echo "=== Compilation ==========================="
/bin/clang $1 -target riscv64 -march=rv32im \
     -fno-addrsig \
    -Os \
    -S -o /tmp/code.s

# cat /tmp/code.s


echo "=== Assembling ==========================="
./assemble.sh /tmp/code.s