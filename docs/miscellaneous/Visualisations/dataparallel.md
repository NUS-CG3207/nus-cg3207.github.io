# Data parallelism: user guide

`dataparallel.html` shows the same data-parallel work on different hardware, one cycle per step. It covers SIMD/vector versus SIMT, warp divergence and latency hiding, plus memory coalescing as the next question on GPUs.

Open the file in a browser. It needs no server, but `dataparallel_engine.js` must sit in the same folder.

## Controls

| Control | Action |
|---|---|
| ▶ / Space | Play or pause |
| ▶\| / → | One cycle forward |
| ◀ / ← | One cycle back |
| ⏮ / Home | Start |
| 1 to 4 | Switch demo |
| Slider | Scrub to any cycle |

Each demo keeps its own position and settings. Changing a setting rewinds that demo. On a phone, **Setup** shows the settings.

## 1. SIMD · SIMT

`y[i] = a*x[i] + y[i]` on a scalar core, a vector core and a SIMT core. Each issues one instruction per cycle.

- **Elements** and **Lanes** set n and the vector or warp width. Pick an n that is not a multiple of the width to see the tail: the last strip or warp leaves lanes idle, and "lanes busy" drops below 100%.
- The vector core runs `vsetvli` plus four vector instructions per strip. The SIMT core runs four per warp and masks the threads past n.
- Set lanes to 1: the vector core is slower than scalar, because it still pays for `vsetvli`.

## 2. Divergence

One or more warps run `if (x[i] > 0) A else B`. Every lane evaluates the condition, then each path runs with the other lanes masked off. A path no lane takes is skipped.

- **Data order** sets the signs of x. With 50% taken, *sorted by sign* keeps whole warps on one side and nothing diverges, while *random* splits almost every warp.
- Click a data cell to flip that lane.
- **Path A** and **Path B** set the instruction counts. "Independent lanes would need" is the cost if each lane followed its own path.

## 3. Latency

Warps share one core. Each issues a burst of instructions ending in a load, then waits. The core keeps issuing from a warp while it can, otherwise switches to the next ready warp.

- With the defaults (4 warps, bursts of 2, latency 6) the core never idles, so latency is fully hidden.
- Reduce **Resident warps** until idle cycles appear. Warps needed is ⌈(burst + latency) / burst⌉.
- Warp 0 finishes no earlier than it would alone. Only the total time improves.

## 4. Coalescing

One warp loads a word per lane. Memory is served in aligned segments, one transaction per cycle, so the cost is the number of segments touched.

- Compare `a[i]`, `a[i+1]` (misaligned), `a[s*i]` and `a[idx[i]]`.
- **Segment** sets the transaction size. A stride of at least the segment size costs one transaction per lane.
- The readout names the vector load that does the same job: `vle32.v` (unit stride), `vlse32.v` (strided), `vluxei32.v` (gather).

## Simplifications

- One instruction issues per cycle and every instruction takes one cycle, except the loads in demo 3 and the transactions in demo 4.
- Loop control, address arithmetic and the bounds check are not counted.
- Demo 3 has one scheduler and no limit on registers. On a real core, the register file bounds the resident warps.
- A transaction in demo 4 is one segment per cycle with no caches.
