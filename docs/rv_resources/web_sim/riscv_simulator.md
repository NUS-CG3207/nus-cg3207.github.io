# RISC-V Simulator User Guide

<p align="center">
  <a href="../riscv_simulator.html" target="_blank" rel="noopener">
    <img alt="Start the Simulator" src="https://img.shields.io/badge/▶%20Start%20the%20Simulator-2ea44f?style=for-the-badge">
  </a>
</p>

A RISC-V simulator that runs in the browser, with nothing to install.

- **Assembly or C.** RV32I(M) assembly is assembled in the page; C is compiled by
  GCC/Clang through Compiler Explorer.
- **Two engines.** Run on a fast functional model in JS, or on your own Verilog processor,
  simulated with Icarus Verilog. Breakpoints, stepping and the board work the
  same in both.
- **Microarchitecture models** (JS engine): single-cycle, multi-cycle (timing only) and a
  5-stage pipeline. Single-cycle and pipelined are drawn as an animated datapath, and the
  pipeline also as a timeline. Each part of the hazard unit can be switched off, and
  configurable branch prediction can be enabled.
- **Step forward and back**, one machine instruction or one statement (a C statement, or a
  pseudo-instruction like `li`) at a time, or one clock cycle when pipelined, with
  registers, memory and peripherals restored.
- **Max speed or real time**, at a clock you set the way the board's divider does.
- **RTL or post-synthesis.** Your Verilog can be simulated as written, and also as the
  gate-level netlist Yosys synthesises from it, with a lint for constructs that won't
  synthesise.
- **Cross-check** your processor against the JS model, reporting the first point where they
  disagree.
- **Waveform** of your whole design in HDL mode, internal signals included, following the
  stepping.
- **A simulated Nexys 4 board**: LEDs, switches, buttons, 7-segment, UART, OLED and
  accelerometer, modelled on the hardware, UART receive timing included.
- **Export** of `.mem` files for Vivado, plus the Wrapper, testbench and VCD.

Most of these, and the options that shape them, live in **⚙ Settings**. It is worth a look
before you start.

## 1. Writing and debugging programs

- **PC** in the status bar is the *next* instruction. In JS mode **Cycles** comes from the
  selected microarchitecture model; in HDL mode it counts your clock edges.
- Each example sets the Linker's IROM/DMEM sizes from the depths in its header. If a
  program stops part-way, it has probably overflowed the Code segment (likely at `-O0`);
  the status bar after assembling says by how much. Raise the Linker size and the depth in
  your `Wrapper.v` together. A size your board can't hold works here and fails on the FPGA.
- **M extension is off by default.** Without it, C's `*` and `%` become calls to libgcc
  helpers (`__mulsi3`, ...) that are not linked in. Enable it, or raise `-O`, where
  constant multiplies often become shifts and adds.
- `ecall` uses the simulator's RARS syscalls. Your hardware has no trap handler or OS
  behind it, so use MMIO for anything that has to run on the board.
- The text segment is read-only; a store there is ignored.
- Writing a writable MMIO register in the Memory panel acts as a bus write. Writing
  `UART RX` queues a received byte.
- C locals' addresses are inferred from the stack layout, not debug info: best-effort.

## 2. Microarchitecture (JS mode)

*Microarchitecture* in Settings → Simulation picks single-cycle, multi-cycle or 5-stage
pipeline. Switching resets the program.

- **The datapath's values are worked out from the reference design's control logic**,
  independently of the simulator's own execution, so they show what that hardware does.
- The drawings cover RV32I's ALU, jump and branch instructions, `lw` and `sw`. Anything else
  runs, without the drawing. The pipeline runs all of RV32IM: `mul`/`div` take one cycle in
  Execute, and floating point, atomics and `ecall` wait in Decode until the stages ahead have
  drained.
- **Multi-cycle** is a performance model only: each instruction category takes the cycles
  set in its table. There is no drawing for it.
- **Pipelined**, Step and Back move one clock cycle, and the PC shown is PCF, the address
  being fetched. A breakpoint stops once its instruction reaches Execute, where nothing can
  flush it. Statement Stepping runs until the statement's last instruction leaves
  Writeback.
- **Hazard switches**: forwarding to Execute, W→D forwarding, the mem-mem copy, the
  load-use stall and branch flushing. Off means the hardware without it, so the program
  computes what that hardware would: wrong answers, unless the software resolves the hazard
  with enough `nop`s. The load-use stall fires only for a register Decode really reads, not
  for a store's data, which the mem-mem copy covers.
- **Branch prediction** (off by default) adds a BHT to Fetch, indexed by PC[k+1:2], 4–256
  entries, no tags, each holding a predicted PCSrc (last outcome or 2-bit saturating counter)
  and target. Fetch can't tell what it has fetched, so every instruction is predicted and
  instructions sharing an entry disturb each other. A mispredict is caught in Execute and
  flushes D and E.

## 3. Clock and real time

The clock takes `CLK_DIV_BITS` as `TOP_Nexys.vhd` does: 100 MHz ÷ 2^N, so 50 MHz at 1 and
3.13 MHz at the default 5. It also sets the UART's character time.

*Max speed* runs as fast as the browser can. *Real time* keeps to the clock, so a delay loop
takes as long as on the board, and below about 1 kHz you can watch each instruction go by.
The browser keeps up only at modest clocks: around 12.5 MHz single-cycle, around 1.56 MHz
pipelined. Past that, the toolbar shows the fraction of real time reached.

In HDL mode, real time is a replay. Icarus can't be paced, so the run is first simulated at
full speed (see [§5](#how-it-actually-runs)) and the recording is then played back at the
clock.

## 4. Peripherals

See the [peripherals reference](https://nus-cg3207.github.io/rv_resources/peripherals/)
for registers and behaviour. The board is modelled faithfully, quirks included. What
catches people out:

- **Buttons:** a click toggles. Hold `J` `K` `L` for a real press and release, which
  edge-detection code needs.
- **UART RX has no FIFO.** A character arriving before the previous one is read is lost
  (the console reports it; the board doesn't). At 115200 baud a character is 8640 cycles of
  the 100 MHz clock: about 270 CPU cycles at the default `CLK_DIV_BITS`, fewer if you lower
  it. *Paste* and *Typed* arrival send at a fixed rate regardless; *Forgiving* waits for
  each read, for debugging logic before timing.
- **`OLED_STATUS` never reads busy** here, as there is no scan-out. Skip the wait after a
  present and it looks fine here (the console warns) but loses pixels on the board; rely on
  it for pacing and it runs too fast here.

## 5. Running your own Verilog (HDL mode)

Load the file declaring `module Wrapper`, your processor and every submodule in
**Settings → Simulation** in HDL mode. They are compiled in the browser by Icarus Verilog,
not uploaded, and must be reloaded in each new tab. **Prebuilt processor** gives a working
RV32I+M core to compare against.

### How it actually runs

It feels like stepping a live simulation. It isn't. Icarus cannot be paused, so each Run
simulates a fixed number of cycles (*Cycles per Run/Resume*) start to finish and records
them; Step and Back only move through that recording.

- **The page freezes while it simulates.** A larger *Cycles* budget means a longer freeze.
- **Changing an input re-runs the simulation** from reset, with the change applied at the
  cycle you are paused on. You land where you were, after another freeze. Inputs can't
  change during a run.
- Resuming, or stepping past the end of the recording, simulates more cycles.
- Registers and memory are read-only, since what you see is a replay.
- Unwritten registers show `xxxxxxxx`, as on real hardware.
- Step, Back and breakpoints follow the Wrapper's `PC`, the fetch address. In a pipelined
  core that runs ahead of the results and includes fetches that a flush later discards.

### Interfaces

Starting from the
[reference templates](https://github.com/NUS-CG3207/nus-cg3207.github.io/tree/main/docs/code_templates/Asst_02)
is recommended. Only the **Wrapper and RV interfaces** have to match them; everything inside
RV is up to you. The simulator never edits your design, but its generated testbench connects
to the Wrapper's ports by name, so a renamed or resized port will not compile.

- Exactly one file declares `module Wrapper`.
- The Wrapper declares `IROM_DEPTH_BITS` and `DMEM_DEPTH_BITS` and loads its memories with
  its own `$readmemh`. A program that doesn't fit is refused.
- The register view needs a 32×32-bit array somewhere inside RV; the register file's
  module and port names don't matter. It is found automatically, or you give its path.
  Without it the program still runs.

### Finding the bug

- **Cross-check against the JS model** compares the two by effect: the order in which
  registers change and data memory is written. It reports the first difference with its
  cycle, both values and the instruction behind the model's. That holds for single-cycle,
  multi-cycle and pipelined cores alike. Start there.
- **Lint** runs on load and flags what won't synthesise as written: delays, `$display`,
  `real`, unbounded loops, `casex`, blocking assignments in clocked blocks, incomplete
  sensitivity lists.
- **Post-synthesis functional simulation** also runs the Yosys netlist and reports where it
  first diverges from your RTL, which is how an inferred latch or a blocking-assignment race
  shows up. First use downloads ~13 MB; each synthesis takes 20–35 s.
- **The waveform** includes internal signals. Registers appear as `x5_t0` etc.; memories
  aren't in a VCD, so use the Memory panel. Clicking a cycle moves the whole simulator there.
  The VCD downloads for GTKWave or [Surfer](https://surfer-project.org/).
- All registers `xxxxxxxx`? Either nothing has written them yet or the register file wasn't
  found; the Registers panel says which.

## 6. Running locally, and the full reference

To run your own copy, serve the folder rather than opening the file. From `file://` the
browser blocks the page's own fetches, so only **DIP to LED** loads and everything else fails
with `Failed to fetch`.

```bash
python3 -m http.server 8000      # then open http://localhost:8000/riscv_simulator.html
```

C mode needs the network either way, since it compiles on Compiler Explorer.

The MMIO map, ISA coverage, syscalls and internals are documented in
[`riscv_simulator_specs.md`](riscv_simulator_specs.md).
