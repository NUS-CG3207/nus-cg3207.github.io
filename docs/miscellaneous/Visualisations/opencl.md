# OpenCL in action: user guide

`opencl.html` steps through one complete OpenCL host program: platform and device discovery, buffer transfers, the kernel launch, work-groups running on compute units, and the read-back. It follows the 13 execution steps of a typical OpenCL host program and a `main.c` example.

Open `opencl.html` in a browser. It needs no server or install, but `opencl_engine.js` must sit in the same folder.

## Layout

| Panel | Shows |
|---|---|
| Code | `main.c` and `kernel.cl`. The current host call is highlighted; a red highlight means the host is blocked in that call. During the kernel, the kernel line being executed is highlighted too. |
| Platform | Host memory, the PCIe link, and the device inside its context: objects, command queue, global memory, the work-group scheduler, and each compute unit with its local memory and PEs. |
| NDRange | Every work-item, coloured by work-group. Click one to inspect it. |
| Work-item / Traffic | The selected work-item's `get_*_id` values, where it runs, and its private memory; bytes moved at each memory level so far. |

On a phone the panels are tabs, and the kernel/device settings sit behind **Setup**.

## Controls

| Control | Action |
|---|---|
| ▶ / Space | Play or pause |
| ▶\| / → | One step, animated |
| ◀ / ← | One step back |
| ⏭ / Shift+→ | Skip to the next host call or work-group round |
| ⏮ / Home | Start |
| 1 to 13 | Jump to that step of the list. Steps 5 and 6 come after 7 and 8, because `main.c` calls them in that order. |
| Slider | Scrub to any step |

Each step's badge shows which memory level it touches (private, local, global, PCIe). Steps that touch slower memory play for longer. The timing is relative, not cycle-accurate.

Particles show data moving: purple over PCIe, blue to or from global memory, green to or from local memory, amber for commands and work-group dispatch. Cells outlined in blue are being read and cells outlined in orange are being written. A coloured bar under a data cell marks the work-group that owns that element.

## Kernels

| Kernel | Shows |
|---|---|
| `vec_add` | The standard example. One work-item per element: two global loads, an add in private memory, one global store. |
| `invert` | A 2D NDRange over an image, `get_global_id(0)` and `(1)`. 32 × 32 with 8 × 8 local shows the work-group tiling clearly. |
| `reduce_sum` | Local memory and `barrier()`. Each work-group sums its slice in `__local` scratch, and the host adds the per-group results. |

## Settings

Change the global size, local size, number of compute units and PEs per CU to see how the work is scheduled. Only local sizes that divide the global size and fit the maximum work-group size (256) are offered; the reduction also needs a power of two.

- **More work-groups than CUs:** the groups run in rounds, and the last round may leave CUs idle.
- **More work-items per group than PEs:** the group runs in waves. With `reduce_sum`, work-items that reach a barrier wait there until later waves catch up.

## Things to try

- Set `vec_add` to 64/8 with 4 CUs, then change to 1 CU. Nothing about the result changes, only the number of rounds.
- In `reduce_sum`, step through the `s` loop and watch the active lanes halve each iteration. Compare global memory traffic with `vec_add`: the partial sums stay in local memory.
- Pick a work-item in the NDRange and follow its private variables as it runs.

## Simplifications

- Each compute unit holds one work-group at a time, and a group's waves run one after another. Real devices keep several groups resident and interleave waves to hide memory latency.
- All CUs step in lockstep, so rounds are uniform.
- The device is generic: its compute units and PEs are the ones in the settings.
