# OpenCL visualisation: specification

## Files

| File | Role |
|---|---|
| `opencl.html` | Page: layout, rendering, animation, controls. |
| `opencl_engine.js` | DOM-free trace generator, loaded by the page and by the tests. |
| `opencl_tests/engine.test.js` | Results and execution-model invariants over every offered configuration. `node opencl/opencl_tests/engine.test.js` |
| `opencl_tests/ui.test.js` | Drives the page in Chromium at desktop and phone widths. `NODE_PATH=$(npm root -g) node opencl/opencl_tests/ui.test.js` |
| `opencl.md` | User guide. |

## Engine

`OCL.build(cfg)` simulates the whole host program up front and returns `steps[]`. `cfg` = `{ kernel, gsz:[x,y], lsz:[x,y], cus, pes }`. Each step carries:

- `phase` (0 to 13, the host program step numbering) and `chapter` (one host call or one work-group round, used by ⏭).
- `host` / `kern`: line tags to highlight. Host code is generated per kernel with tags attached to lines, so highlighting never depends on line numbers.
- `ops`: primitive state mutations (`halloc`, `copyHG`, `gset`, `lset`, `pset`, `wi`, `wg`, `qpush`, `cnt`, ...).
- `flows`, `reads`, `writes`: what moved where, for particles and cell outlines. `leg` 0/1 splits a step into a read half and a write half.
- `lanes`: `{cu, pe, wi, active, note}` for execution and barrier steps.

`stateAt(k)` clones the nearest checkpoint (every 32 steps) and replays `ops`, so scrubbing backwards is cheap.

### Execution model

- Work-groups are dispatched round-robin: group `g` runs on CU `g % C` in round `floor(g / C)`. One group per CU at a time.
- A group of `L` work-items on `P` PEs runs in `ceil(L / P)` waves; work-item `ll` runs on PE `ll % P` in wave `floor(ll / P)`.
- The kernel is a list of segments separated by barriers. For each segment, each wave runs every statement in it, then reaches the barrier. The barrier releases after the last wave arrives.
- A statement's `active` predicate masks lanes (divergence). Masked lanes still occupy the step.
- All busy CUs execute the same statement in the same step.
- Global and local reads of never-written cells throw, so a trace that reads undefined data fails to build.
- Local memory is allocated at dispatch and freed when the group finishes.

### Relative latency

Animation duration = 650 ms × factor ÷ speed. Factors: host 0.6, private/ALU 0.7, control 0.9, local 1.0, global 1.9, PCIe 2.4.

## UI rules

- The narrow layout (≤ 860 px) turns the panels into tabs. Transport and narration stay fixed in the header, so the controls are always on screen with the result.
- Animated steps scroll the Platform panel so that the particle endpoints are visible; if they don't all fit, the destinations win.
- Values that don't exist yet are not drawn: unwritten cells are blank, the NDRange is hidden until step 10, and private variables show `—` until assigned.
- Numeric arrays of the same shape in host and global memory share one cell size, so corresponding elements line up.
- All sizes are in `rem`. The root font size is `clamp(13px, 1vw, 26px)`, so a 1080p projector gets about 1.5× the laptop scale. Canvas cell caps, the cell font and particle radius multiply by `SC()` (root font size / 13) to follow it.
- At 1080p the Platform panel fits the host, device and four compute units without scrolling; the three arrays of a memory sit in one row and the Platform column takes the largest share of the width.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-25 | First version. Three kernels (`vec_add`, `invert` 2D, `reduce_sum` with local memory and barriers); configurable global/local size, CUs and PEs; conceptual timing. The device is generic (not labelled GPU) and `main.c` uses `CL_DEVICE_TYPE_DEFAULT`. A wave masked off entirely is still shown as a step, and the narration says hardware would skip it. |
| 0.2 | 2026-11-04 | Projector legibility. Sizes moved from `px` to `rem` with a root font size that grows with viewport width, canvas sizes follow it, and the column split favours the Platform panel so array cells keep their numbers. The NDRange grid is sized from the panel's content width (it overshot by the padding once cells grew). |
