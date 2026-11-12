# Background

## Recap: architecture vs microarchitecture

The **architecture**, or **instruction set architecture (ISA)**, is the contract
between hardware and software. It tells a programmer (or a compiler) everything
needed to write a correct program, and says nothing about how the hardware
achieves it. It specifies:

- the instructions and what each one does;
- where operands can come from: registers, memory, or constants (immediates)
  embedded in the instruction;
- how each instruction is encoded as a pattern of bits.

A program can be written in two equivalent forms:

- *Machine code*: the binary encoding that the processor fetches and executes.
- *Assembly language*: a textual notation for the same instructions, using
  mnemonics such as `add` and register names such as `x5`.

An **assembler** translates assembly language into machine code. Each assembly
instruction normally becomes exactly one machine instruction. The exceptions are
*pseudo-instructions*, shorthands that the assembler expands into one or more
real instructions. For example, `li` (load immediate) with a large constant
becomes a `lui` followed by an `addi`.

The **microarchitecture** is a particular hardware design that implements an ISA:
its datapath, control unit, pipeline, caches and so on. One ISA can have many
microarchitectures. A small single-cycle core and a high-performance
out-of-order core can run the same RISC-V binary and produce the same results.
They differ only in speed, area and power.

<figure markdown="1">
![Levels of abstraction from application software down to physics, with Architecture highlighted](assets/abstraction-layers.svg){ width="300" }
<figcaption>Levels of abstraction. After Harris and Harris.</figcaption>
</figure>

## RISC-V history

- Began in **2010** at the University of California, Berkeley as a short project.
- The aim was an ISA that anyone could use freely, whether for teaching,
  research or commercial products, with no licence fees or royalties.
- Introduced in **Aug 2014**.
- Transferred to the RISC-V Foundation in **2015**, and then on to RISC-V
  International, a Swiss non-profit entity, in **November 2019**.
- Fast gaining traction — numerous open source as well as commercial
  implementations.
- Software support improving fast.

## Notable products and software

- ESP32-C3, ESP32-C6. ESP32-S series also have ultra-low-power cores which are
  RISC-V based, though the main processors are Xtensa based.
- Raspberry Pi Pico 2, Microchip FPGAs/SoCs.
- Modern Nvidia GPUs and large processor chips include dozens of embedded
  NV-RISCV management cores.
- Many implementations and commercial products —
  [see the list on Wikipedia](https://en.wikipedia.org/wiki/RISC-V#Implementations).
- Many hardware accelerators built around RISC-V cores.
- Mainline support for RISC-V ISA was added to the Linux kernel in **2022**.
- In **July 2023**, RISC-V, in its 64-bit variant called `riscv64`, was included
  as an official architecture by Debian.

## RISC-V features

- As a RISC architecture, the RISC-V ISA is a **load–store architecture** — only
  load/store variants can access memory.
    - No mixing of memory access with data processing or branching.
- Interesting design choices to simplify hardware implementation.
    - Especially the encoding of immediates.
- **Modular design** — the instruction set is designed for a wide range of uses.
- Every instruction in the base set is 32 bits long and stored at an address
  that is a multiple of 4. There are a few base variants, such as RV32I, RV32E
  and RV64I.
- Extensions may add instructions of other lengths, as long as each length is a
  multiple of 16 bits.
- Extensions include multiplication (**M**), floating point (**F**, **D**,
  **Q**), atomics (**A**), compressed instructions (**C** — 16-bit long
  instructions for high code density like ARM Thumb), …

!!! note

    Instruction lengths and word lengths are not necessarily the same.

## RISC-V base instructions

=== "Data Processing (DP)"

    To process data.

    - **register**: `add`, `sub`, `or`, `xor`, `and`, `sll`, `srl`, `sra`,
      `slt`, `sltu`
    - **immediate**: `addi`, `ori`, `xori`, `andi`, `slli`, `srli`, `srai`,
      `slti`, `sltiu`
    - **upper immediate**: `lui` (load upper immediate), `auipc` (add upper
      immediate to pc)

=== "Memory"

    To access memory.

    - **offset mode**: `lw`, `lh`, `lb`, `lhu`, `lbu`, `sw`, `sh`, `sb`
    - No data processing. No pre/post index addressing.

=== "Branch / Jump"

    To change control flow.

    - **Branch** (conditional, no link): `beq`, `bne`, `blt`, `bge`, `bltu`,
      `bgeu`
    - **Jump** (unconditional, with link): `jal`, `jalr`

=== "Others"

    Special purpose instructions.

    - `ecall` (system call), `ebreak` (breakpoint), `fence` (memory barrier)
