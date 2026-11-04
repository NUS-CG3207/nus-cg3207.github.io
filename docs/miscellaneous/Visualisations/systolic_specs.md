# Systolic array visualisation: specification

## Files

| File | Role |
|---|---|
| `systolic.html` | Page: array, readouts, matrices, transport. |
| `systolic_engine.js` | DOM-free simulator, loaded by the page and the tests. |
| `systolic_tests/engine.test.js` | Results and timing invariants over every offered configuration. `node opencl/systolic_tests/engine.test.js` |
| `systolic_tests/ui.test.js` | Drives the page in Chromium at desktop, phone and dark settings. `NODE_PATH=$(npm root -g) node opencl/systolic_tests/ui.test.js` |
| `systolic.md` | User guide. |

## Engine

`SA.run({mode, n, len, seed})` simulates the whole multiply up front and returns `frames[0..cycles]`; `frames[t]` is the state after `t` cycles. The page renders a frame as a pure function of `k`, so scrubbing needs no replay.

A frame holds `pe[i][j]` (`a`, `b`, `ps`, `w`, `acc`, `active`, `final`, plus the `k` index each operand carries), the upcoming values on each edge (`qL`, `qT`, including skew zeros), the cumulative MAC count and, for weight stationary, the rows of C emitted so far.

- **Output stationary:** `C = A (n × len) · B (len × n)`. Row `i` of A and column `j` of B enter `i` and `j` cycles late. PE `(i,j)` multiplies the operands on its left and top inputs when both are present, adds to its own sum and forwards both. It is busy during cycles `i + j` to `i + j + len − 1`. Total `len + 2(n − 1)` cycles.
- **Weight stationary:** `C = A (len × n) · W (n × n)`. Load phase of `n` cycles: row `n − 1 − l` of W enters the top on cycle `l` and shifts down, so W sits in place afterwards. Compute phase: A's column `i` enters row `i` `i` cycles late and moves right; PE `(i,j)` adds `a · W[i][j]` to the partial sum from above and passes it down. `C[r][j]` leaves the bottom of column `j` on compute cycle `r + j + n − 1`. Total `n + len + 2(n − 1)` cycles.
- Utilisation is `n² · len / (n² · cycles)`, counting load cycles. Operand reads count each input once at its edge (`2·n·len`, or `n² + n·len` with the weights), against `2·n²·len` for a MAC unit that fetches both operands per multiply.

The tests check the result against a direct matrix product, the busy window of every PE, that each multiply pairs matching `k` and each partial sum extends the same row, that weights never move during compute, and the slide 53 case (4 × 4, 10 cycles).

## UI rules

- Transport, narration and settings live in the header, so the controls stay on screen while the result scrolls. On the narrow layout (≤ 860 px) the settings sit behind **Setup**, and PE cells shrink rather than scroll.
- Matrices A, B/W and C sit beside the readouts. C fills as sums become final (output stationary) or as rows leave the array (weight stationary).
- All sizes are in `rem`; the root font size is `clamp(13px, 1.1vw, 30px)`. The PE grid is sized from its container with container query units (`--pe` is the smaller of the width and height budgets, minus the queue gutters), so it fills the card at any screen size, and PE text scales with `--pe`. Matrices switch to a compact style when either side exceeds 8, so A, B and C fit in one row beside the array.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-04 | First version. Output-stationary (slide 53) and weight-stationary (TPU) dataflows on an n × n array (n = 2 to 6), configurable stream length, utilisation and operand-read readouts. |
| 0.2 | 2026-11-04 | Projector legibility. `px` to `rem`, the array centred and sized to its card (it was a fixed 96 px per PE, right-aligned), larger skew queues and matrices. Tests check PE size and no scrolling at 1080p. |
