# Systolic array: user guide

`systolic.html` runs a matrix multiply on an n × n systolic array, one cycle per step. It covers the array at the heart of the TPU and the classic output-stationary diagram.

Open the file in a browser. It needs no server, but `systolic_engine.js` must sit in the same folder.

## Controls

| Control | Action |
|---|---|
| ▶ / Space | Play or pause |
| ▶\| / → | One cycle forward |
| ◀ / ← | One cycle back |
| ⏮ / Home | Start |
| Slider | Scrub to any cycle |

Changing a setting rewinds. **Reshuffle** draws new matrices. On a phone, **Setup** shows the settings.

## Dataflows

| | Output stationary | Weight stationary (TPU) |
|---|---|---|
| Stays in the PE | The running sum of one element of C | One weight |
| Moves right | Elements of A | Elements of A |
| Moves down | Elements of B | Partial sums |
| Setting | **Inner dimension K** | **Rows of A streamed** |
| Cycles | K + 2(n − 1) | n (load) + rows + 2(n − 1) |

Inputs enter skewed by one cycle per row and column, so matching elements meet in the right PE. The zeros beside the array are that skew. A PE multiplies only when both of its inputs are present, so a diagonal wavefront of busy PEs sweeps across the array.

## Things to try

- Output stationary, 4 × 4, K = 4 is the classic diagram. Step to cycle 4: ten PEs are busy. Step on and watch P11 finish first and P44 last.
- Raise K. Fill and drain cost the same 2(n − 1) cycles however long the stream, so "PEs busy" climbs towards 100%.
- Switch to weight stationary and watch the weights load, then stay fixed. Stream 4 rows, then 16: the fill and drain are amortised over more results.
- Read "Operand reads from the buffer". Each input enters at an edge once and is reused by a whole row or column of PEs, so the count is n times smaller than for a MAC unit that fetches both operands for every multiply. This is the "no access to memory during each operation" point.
- At 256 × 256 and 700 MHz (the first-generation TPU) the array does 65,536 MACs per cycle, about 92 trillion operations per second counting a multiply and an add separately.

## Simplifications

- Every PE does one multiply-accumulate per cycle, and values move one PE per cycle.
- Weights load by shifting one row per cycle from the top. The real TPU double-buffers them so the next tile loads while the current one computes.
- Matrix entries are small integers; there is no 8-bit saturation, accumulator width or activation unit.
- The array is square and the matrices are sized to it. A larger matrix would be tiled.
