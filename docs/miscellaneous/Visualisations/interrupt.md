# Interrupt simulator: user guide

`interrupt.html` compares vectored and non-vectored interrupt handling on a RISC-V core, one step at a time. A main loop runs until you raise an interrupt from one of two peripherals; you then step through the context switch, the interrupt service routine (ISR) and the return.

Open the file in a browser. It is a single self-contained file (CSS and JS inline) and needs no server. It is a saved copy of [the NUS CS2100DE animation](https://nus-cs2100de.github.io/animations/vectored_nonvectored.html).

## Controls

| Control | Action |
|---|---|
| Click Peripheral 1 or 2 | Raise that IRQ. Only accepted while the main program is running |
| ▶ / → / Space | Next step (clicking anywhere on the page body outside a button also steps) |
| ◀ / ← | Previous step (the last 50 are kept) |
| ⟲ / R | Reset |
| Vectored / Non-Vectored buttons | Switch mode; this also resets |

The state banner shows the current phase and mode. The register panel shows `PC`, `EPC` (the saved return address) and the `IRQ ID` of the interrupt being served.

## The two modes

| | Vectored | Non-vectored |
|---|---|---|
| Entry | PC loads the handler address from the vector table, indexed by the IRQ | PC always loads the one common handler at `0x9000` |
| Finding the source | Done by hardware: each IRQ has its own table entry | Done by software: the handler reads `INT_STATUS` and branches with `bne` |
| Handler | `ack_int_n`, work, `eret` | Polling code, then `jal` to a per-peripheral routine, `ret` back, `eret` |
| Extra display | Vector table, with the selected entry highlighted | Polling indicators for peripherals 1 and 2 |

Steps in a vectored interrupt:

1. **Main running**: PC walks the four-instruction loop at `0x0000` to `0x000C`.
2. **Interrupt pending**: you clicked a peripheral; its IRQ line lights up.
3. **Context switch**: the vector table entry for that IRQ is highlighted.
4. **ISR running**: `EPC` now holds the interrupted PC and PC points into the handler. `ack_int_n` clears the IRQ line.
5. **Interrupt return**: `eret` copies `EPC` back into PC and the main loop resumes where it left off.

Non-vectored mode skips the context-switch step: the next step after the interrupt goes straight to `0x9000` with `EPC` saved. The polling code checks peripheral 1 first, then peripheral 2, so the handler for peripheral 2 runs after one extra failed comparison.

## Things to try

- In vectored mode, raise IRQ 2 and count the steps from the click to the first instruction of its handler. Repeat in non-vectored mode and compare.
- In non-vectored mode, raise IRQ 1, then IRQ 2 in a second run. Watch the extra `bne` that the second one needs, and which line each `ret` returns to.
- Step back from the `eret` and watch `EPC` and PC to see exactly what is restored.
- Try to raise a second interrupt during an ISR. It is ignored: the simulator handles one interrupt at a time.

## Simplifications

- One interrupt is served at a time. There is no nesting, priority, masking or `mstatus`/`mcause` registers, and no pending queue.
- The simulator shows a program-level view. Instructions are not decoded or executed: `lw`, `addi`, `sw` and the rest only advance PC, and `ack_int_n` is a pseudo-instruction that clears the IRQ line.
- `jal`/`ret` in the non-vectored handlers follow fixed addresses rather than a real link register.
- There are no tests for this page.
