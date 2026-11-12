# RISC-V Simulator User Guide

<p align="center">
  <a href="../riscv_simulator.html" target="_blank" rel="noopener">
    <img alt="Start the Simulator" src="https://img.shields.io/badge/▶%20Start%20the%20Simulator-2ea44f?style=for-the-badge">
  </a>
</p>

A RISC-V simulator that runs in the browser, with nothing to install.

- **Assembly or C.** RV32I(M) assembly is assembled in the browser. C is compiled with
  GCC or Clang through Compiler Explorer.
- **Two simulation engines.** Programs run either on a fast functional model written in
  JavaScript, or on your own Verilog processor, simulated with Icarus Verilog. Breakpoints,
  stepping and the simulated board behave the same with both.
- **Microarchitecture models** (JavaScript engine): single-cycle, multi-cycle with
  user-configurable cycle counts for each instruction type, and a 5-stage pipeline. The
  single-cycle and pipelined models have an animated datapath diagram, and the pipeline also
  has a timeline view. Each part of the hazard unit can be switched off individually, and
  configurable branch prediction can be enabled. Cycle count and CPI are reported for each
  run.
- **Step forward and back** by one machine instruction, by one statement (a C statement or
  an assembly pseudo-instruction such as `li`), or by one clock cycle on the pipeline.
  Stepping back restores registers, memory and peripherals.
- **Maximum speed or real time**, at a clock frequency set through a clock divider.
- **RTL and post-synthesis simulation.** Your Verilog can be simulated as written, and also
  as the gate-level netlist that Yosys synthesises from it. Sources are also checked for
  code that would behave differently after synthesis.
- **Cross-checking** of your processor against the JavaScript model, reporting the first
  point at which they disagree.
- **Waveform viewer** (Verilog simulation only) for every signal in your design, kept in step
  with the rest of the simulator.
- **A simulated FPGA board**, modelled on a Digilent Nexys 4 / Nexys 4 DDR / Nexys A7 with a
  Pmod OLED: LEDs, switches, push buttons, 7-segment display, UART, OLED display and
  accelerometer, including the UART's receive timing.
- **Export** of `.mem` memory images for Vivado, and of the generated Verilog testbench and
  the VCD waveform.

Most of these features, and the options that control them, are in **⚙ Settings**.

## 1. Writing and debugging programs

- **PC** in the status bar is the address of the *next* instruction. **Cycles** is computed
  by the selected microarchitecture model in JavaScript mode, and counts clock edges in HDL
  mode. The multi-cycle and pipelined models also report **CPI**, and the pipeline reports
  branch mispredictions when prediction is enabled.
- Each example program sets the code and data segment sizes (Settings → Linker) from
  the values in its header. A program that stops part-way through has usually exceeded the
  code segment, which is most common at `-O0`; the status bar reports the overflow after
  assembling. Increase the Linker size, and for hardware the matching
  `IROM_DEPTH_BITS`/`DMEM_DEPTH_BITS` in the Wrapper. The simulator accepts sizes larger
  than the FPGA's block RAM can hold.
- **The M extension is off by default.** Without it, `*`, `/` and `%` in C compile to calls
  to libgcc helper functions (`__mulsi3`, ...), which are not linked in. Enable the M
  extension, or use a higher `-O` level, where multiplication by a constant often becomes
  shifts and adds.
- `ecall` provides RARS-compatible system calls. They are a simulator facility with no
  hardware counterpart, so programs intended for the FPGA should use the memory-mapped
  peripherals instead.
- The text segment is read-only; stores to it are ignored.
- Writing to a writable memory-mapped register in the Memory panel has the same effect as a
  store to it. Writing to `UART RX` queues a received character.
- The Locals panel locates C local variables from the stack layout rather than from debug
  information, and may occasionally be inaccurate.

## 2. Microarchitecture models (JavaScript mode)

The model is selected under *Microarchitecture* in Settings → Simulation. Changing it resets
the program.

- **The datapath diagram's values are computed from the drawn datapath's own decoder and
  control logic**, separately from the instruction-level simulation, so they show what that
  hardware would do.
- The diagrams cover the RV32I ALU, jump and branch instructions, and `lw` and `sw`. Other
  instructions still execute, but are not drawn. The pipeline executes all of RV32IM:
  `mul` and `div` take one cycle in Execute, and floating-point, atomic and `ecall`
  instructions wait in Decode until the stages ahead of them are empty.
- **Multi-cycle** is a performance model only, with no diagram. The number of cycles for
  each instruction type (ALU, multiply/divide, load, store, branch, jump, floating point,
  system) is user-configurable in Settings → Simulation.
- **Pipeline:** Step and Back move by one clock cycle, and the PC shown is that of the
  instruction being fetched (PCF). A breakpoint stops execution when its instruction reaches
  Execute, after which it can no longer be flushed. Statement stepping runs until the
  statement's last instruction leaves Writeback.
- **Hazard unit switches:** forwarding to Execute, forwarding from Writeback to Decode,
  forwarding from Writeback to Memory (a store of a value just loaded), the load-use stall,
  and flushing after a taken branch or jump. With a switch off, the pipeline behaves as
  hardware without that logic would: results are incorrect unless the hazard is resolved
  in software, for example with `nop`s. The load-use stall is raised only
  when the instruction in Decode reads the loaded register as a source operand; a store's
  data operand is handled by Writeback-to-Memory forwarding instead.
- **Branch prediction** (off by default) adds a branch history table to Fetch. It has 4 to
  256 untagged entries, indexed by PC[k+1:2], each holding a predicted direction (the last
  outcome, or a 2-bit saturating counter) and a target address. The lookup happens before
  the instruction is decoded, so every instruction fetched is looked up, branch or not, and
  instructions that share an entry interfere with each other. A misprediction is detected in
  Execute and flushes Decode and Execute.

## 3. Clock and real time

The clock frequency is set by `CLK_DIV_BITS`, as in the board template's top-level module
(`TOP_Nexys.vhd`): the board's 100 MHz clock divided by 2^`CLK_DIV_BITS`. 1 gives 50 MHz, and
the default of 5 gives 3.125 MHz. The setting also determines how many cycles a UART
character takes.

*Max speed* runs as fast as the browser allows. *Real time* runs at the set clock frequency,
so delay loops take as long as on the hardware; below about 1 kHz, execution can be followed
instruction by instruction. Real time is sustainable only at low clock frequencies, about
12.5 MHz for the single-cycle model and about 1.56 MHz for the pipeline. Above that, the
toolbar shows the fraction of real time achieved.

In HDL mode, real time is a replay. Icarus Verilog cannot be slowed to a given rate, so the
run is first simulated at full speed (see [§5](#how-hdl-simulation-runs)) and the recorded
result is then played back at the set clock frequency.

## 4. Peripherals

The registers and behaviour of each peripheral are described in the
[peripherals reference](https://nus-cg3207.github.io/rv_resources/peripherals/). The
simulation follows the hardware closely, including its limitations. In particular:

- **Push buttons:** clicking a button toggles it. Holding `J`, `K` or `L` produces a
  momentary press and release, as required by edge-detection code.
- **UART receive has no FIFO.** A character that arrives before the previous one has been
  read is lost. The console reports this; the hardware does not. At 115200 baud a character
  takes 8640 cycles of the 100 MHz clock, which is about 270 processor cycles at the default
  `CLK_DIV_BITS` and fewer at lower settings. *Paste* sends characters one character time
  apart and *Typed* much further apart, whether or not the program has read the previous
  one. *Forgiving* holds each character until the previous one has been read, so program
  logic can be tested independently of timing.
- **`OLED_STATUS` never reads busy** in the simulator, because the display is not scanned
  out. A program that does not wait after presenting a frame displays correctly in the
  simulator (with a console warning) but loses pixels on the hardware, and a program that
  relies on the busy wait for pacing runs faster in the simulator than on the hardware.

## 5. Simulating your own Verilog (HDL mode)

In HDL mode, load the file that declares `module Wrapper`, your processor and all of its
submodules in **Settings → Simulation**. The files are compiled in the browser by Icarus
Verilog, not uploaded anywhere, and have to be loaded again in each new browser tab.
**Prebuilt processor** loads a working RV32I+M processor and Wrapper for comparison.

### How HDL simulation runs

Although stepping looks the same as in JavaScript mode, the design is not simulated one step
at a time. Icarus Verilog cannot be paused, so each Run simulates a fixed number of cycles
(*Cycles per Run/Resume*) from start to finish and records the result. Step, Back and
breakpoints then move through that recording.

- **The page is unresponsive while a simulation runs**, for a time proportional to the
  number of cycles.
- **Changing an input re-runs the simulation** from reset, with the change applied at the
  current cycle, and then returns to that cycle. The page is again unresponsive while this
  happens. Inputs cannot change during a run.
- Resuming, or stepping past the end of the recording, simulates further cycles.
- Registers and memory cannot be edited, since what is shown is a recording.
- Registers that have not been written show `xxxxxxxx`.
- Step, Back and breakpoints follow the Wrapper's `PC` output, which is the fetch address.
  In a pipelined processor this runs ahead of the results, and includes instructions that
  are fetched and later flushed.

### Interfaces

It is recommended to start from the
[Wrapper and processor templates](https://github.com/NUS-CG3207/nus-cg3207.github.io/tree/main/docs/code_templates/Asst_02).
Only two interfaces must match them: `Wrapper` (the processor together with its instruction
and data memories and memory-mapped I/O) and `RV` (the processor). The internal structure of
`RV` is unrestricted. The simulator does not modify the design, but its generated
testbench connects to the Wrapper's ports by name, so a renamed or resized port causes a
compilation error.

- Exactly one file may declare `module Wrapper`.
- The Wrapper must declare `IROM_DEPTH_BITS` and `DMEM_DEPTH_BITS` and initialise its
  memories with its own `$readmemh`. A program that does not fit in these memories is
  rejected.
- The Registers panel needs a 32×32-bit array somewhere inside `RV`; the register file's
  module and port names do not matter. The array is found automatically, or its hierarchical
  path can be given. Without it, the program still runs but registers are not shown.

### Debugging

- **Cross-check against the JS model** compares the two engines by effect: the order in
  which registers change and data memory is written. It reports the first difference with
  its cycle, both values, and the instruction responsible in the JavaScript model. It works
  for single-cycle, multi-cycle and pipelined designs alike.
- **Synthesis checks** run whenever sources are loaded, and list code that simulates
  differently from the hardware synthesised from it, or does not synthesise at all: `#`
  delays, `$display` and other simulation-only tasks, `real`, unbounded loops, `casex`,
  blocking assignments in clocked blocks, and incomplete sensitivity lists. The results
  appear in the console with file and line numbers. They are warnings only and never prevent
  a simulation.
- **Post-synthesis functional simulation** also simulates the netlist produced by Yosys and
  reports the first point at which it differs from the RTL, which exposes problems such as
  unintended latches and races between blocking assignments. The first use downloads about
  13 MB, and each synthesis takes 20 to 35 seconds.
- **The waveform** includes internal signals, with registers named `x5_t0` and so on.
  Memories are not recorded in a VCD; their contents are shown in the Memory panel. Clicking
  a cycle in the waveform moves the whole simulator to that cycle. The VCD can be downloaded for
  GTKWave or [Surfer](https://surfer-project.org/).
- If every register shows `xxxxxxxx`, either none has been written yet or the register file
  was not found; the Registers panel indicates which.

## 6. Running locally, and the full reference

To run a local copy, serve the folder through a web server rather than opening the file
directly. From a `file://` address the browser blocks the page's own requests, so only the
**DIP to LED** example loads, and everything else fails with `Failed to fetch`.

```bash
python3 -m http.server 8000      # then open http://localhost:8000/riscv_simulator.html
```

C programs need an internet connection either way, since they are compiled on Compiler
Explorer.

The memory map, ISA coverage, system calls and implementation details are documented in
[`riscv_simulator_specs.md`](riscv_simulator_specs.md).
