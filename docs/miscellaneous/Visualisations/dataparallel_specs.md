# Data parallelism visualisation: specification

## Files

| File | Role |
|---|---|
| `dataparallel.html` | Page: tabs, rendering, transport. |
| `dataparallel_engine.js` | DOM-free models for the four demos, loaded by the page and the tests. |
| `dataparallel_tests/engine.test.js` | Results and invariants for every demo. `node opencl/dataparallel_tests/engine.test.js` |
| `dataparallel_tests/ui.test.js` | Drives the page in Chromium at desktop, phone and dark settings. `NODE_PATH=$(npm root -g) node opencl/dataparallel_tests/ui.test.js` |
| `dataparallel.md` | User guide. |

## Engine

Each function simulates a demo up front and returns plain data; the page replays it one cycle per step, so scrubbing needs no state reconstruction.

- `axpy({n, w})`: instruction records for a scalar, a vector and a SIMT machine over `y[i] = a*x[i] + y[i]`. A record is `{line, kind, group, lanes[], vals[]}`; `lanes[j]` is the element lane `j` works on or `-1`. `yAt` replays the stores.
  - Scalar: 4 instructions per element. Vector: `vsetvli` plus 4 per strip, `vl = min(w, n left)`. SIMT: 4 per warp, threads past `n` masked.
  - Lane utilisation counts the vector instructions only: `n / (w * ceil(n / w))`.
- `diverge({w, warps, pattern, p, seed, costA, costB, flips})`: per warp, one compare, then path A if any lane takes it, then path B if any lane does not. The taken count is exact (`round(p * lanes)`), placed by a seeded shuffle, sorted order or alternation. "Independent" cost is `1 + max(path cost)` per warp.
- `latency({warps, issue, lat, rounds})`: a warp issues `issue` instructions per burst; the last is a load that stalls it `lat` cycles, except the final burst, which ends in a store. The scheduler stays on the current warp while it is ready, otherwise takes the next ready warp in round-robin order. Grid cells are `I` issuing, `M` waiting, `R` ready, `D` finished. Speed-up is measured against running the warps one after another.
- `coalesce({w, seg, pattern, stride, seed})`: addresses from one of six patterns, grouped by `floor(addr / seg)`; one transaction per distinct segment, issued in address order. Efficiency is distinct words over words fetched.

## UI rules

- Transport, narration and settings live in the header, so the controls stay on screen while the result scrolls. The narrow layout (≤ 860 px) hides settings behind **Setup** and keeps the four demos as one row of tabs.
- Only the active view is in the DOM.
- Each demo is a function of `(model, k)`, rendered in full on every step.
- All sizes are in `rem`; the root font size is `clamp(13px, 1.05vw, 28px)`. Row and cell heights in demos 3 and 4 also scale with viewport height, so a projected page fills the screen. Settings share the title row on wide screens, which saves a header row, and the narration is a banded block.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-04 | First version. Four demos: scalar vs SIMD vs SIMT on one loop, warp divergence, latency hiding, memory coalescing. The slide 50 schedule is a test case. The scheduler was first written as lowest-index-ready, which starved the last warp when three warps already saturated the core; it is now round-robin after the current warp. |
| 0.2 | 2026-11-04 | Projector legibility. `px` to `rem`, settings moved into the title row, narration made prominent, divergence warps laid out two per row so four fit at 1080p. Tests check the 1080p scale and that the main views need no scrolling. |
| 0.3 | 2026-11-04 | Controls that do not apply to the current setting are hidden, not greyed out (stride outside `a[s*i]`, reshuffle outside random access, the taken slider for alternating). Reshuffle in divergence is always available and redraws the data values. The stride label reads "Stride" (it was "Stride s"). |
