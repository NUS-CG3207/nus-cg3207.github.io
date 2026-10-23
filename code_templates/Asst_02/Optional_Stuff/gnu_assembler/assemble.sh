#!/bin/sh

# Need to run this first
# sudo apt install binutils-riscv64-unknown-elf
ASM_FILE=$1 #"code.s"
DATA_MEM_PATH="./AA_DMEM.mem"
INSTR_MEM_PATH="./AA_IROM.mem"

riscv64-unknown-elf-as $ASM_FILE -march=rv32ima_zifencei_zicsr -o /tmp/a.out
riscv64-unknown-elf-ld /tmp/a.out -T cg3207.ld -b elf32-littleriscv -o /tmp/a.linked.out
echo "=== Data ==========================="
riscv64-unknown-elf-objcopy -j .data -O binary /tmp/a.linked.out /tmp/output.hex
xxd -e /tmp/output.hex  | cut -c 10-48 > $DATA_MEM_PATH 
echo "=== Text ==========================="
riscv64-unknown-elf-objcopy -j .text -O binary /tmp/a.linked.out /tmp/output.hex
xxd -e /tmp/output.hex  | cut -c 10-48 > $INSTR_MEM_PATH
echo "=== Assembly ==========================="
# https://stackoverflow.com/questions/56960126/riscv-objdump-how-to-set-to-print-x0-x31-register-names-instead-of-abi-names
riscv64-unknown-elf-objdump -M numeric -s -S /tmp/a.linked.out


