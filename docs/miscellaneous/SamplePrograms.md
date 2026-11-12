    # Acceleration & Memory-Access Examples

Small, self-contained programs showing **why memory access patterns, data layout and parallelism dominate performance**, plus two Verilog snippets showing what synthesis tools do to your RTL. The source files are in [the `SamplePrograms` folder of the course repository](https://github.com/NUS-CG3207/nus-cg3207.github.io/tree/main/docs/miscellaneous/SamplePrograms). All examples are AI-generated; absolute timings depend on your machine, but the *ratios* are what matter.

**Contents**

1. [Background: caches and hardware prefetching](#1-background-caches-and-hardware-prefetching)
2. [Prefetching experiment (`cache_access.c`)](#2-prefetching-experiment-cache_accessc)
3. [Other CPU memory-layout examples](#3-other-cpu-memory-layout-examples)
4. [Parallel / GPU examples](#4-parallel-gpu-examples)
5. [Verilog / Yosys examples](#5-verilog-yosys-examples)
6. [Number representation demos](#6-number-representation-demos-number_formatsc)
7. [Quick reference](#7-quick-reference)

> **Build tip:** compile with `-O2` for meaningful timings. Files using `clock_gettime` may need `-lrt` on older glibc (harmless on newer).

---

## 1. Background: caches and hardware prefetching

Modern CPUs move memory in **cache lines** (typically 64 bytes = 8 doubles). Two rules explain almost every result below:

- **The cache line is the unit of transfer.** Order *within* a line is irrelevant; what matters is how many distinct lines you touch and in what order.
- **Hardware prefetchers** watch your access pattern and fetch lines *before* you ask for them, turning "compulsory" misses into hits.

| Prefetcher | Detects | Example |
|---|---|---|
| Sequential / stream | consecutive lines | 100, 104, 108 → fetches 112, 116… |
| Stride | constant stride | 100, 200, 300 → learns +100, fetches 400, 500… |
| Next-line | (always) | fetches the line after the current one |

Caveats: prefetchers operate *between* lines, not within them; they do not cross page boundaries (1–4 KB); and prefetched lines can evict useful ones.

---

## 2. Prefetching experiment (`cache_access.c`)

Traverses a 64M-element `double` array (~512 MB) in six orders. A "block" is 64 elements (~512 B, ~8 cache lines).

| # | Pattern | Cache | Prefetcher | Expected |
|---|---|---|---|---|
| 1 | Perfect sequential: `0 1 2 3 … ` | excellent spatial locality | stream prefetcher runs far ahead | best |
| 2 | Fully random | every access misses | nothing to learn, stays idle | **worst** |
| 3 | Sequential inside block, blocks in random order | good within a block, miss at each block start | random jumps defeat it | moderate |
| 4 | Random inside block, blocks random | same as #3 | same as #3 | = #3 |
| 5 | Sequential inside block, blocks at constant stride (3) | good | **stride prefetcher learns block order** (0→3→6→9→1→4…) | very good |
| 6 | Random inside block, blocks at constant stride (3) | same as #5 | same as #5 | = #5 |

**Key insights**

1. The cache line is the fundamental unit for both caching and prefetching.
2. Order within a line is irrelevant, which is why 3≡4 and 5≡6.
3. Regular strides are prefetchable even when not sequential.
4. Prefetching turns caching from reactive (fetch on miss) into predictive (fetch before use), but only when the pattern is learnable *at cache-line granularity*.

**Run**
```bash
gcc -O2 -g -fno-omit-frame-pointer cache_access.c -o cache_access
./cache_access
```

**Sample output** (one machine; needs ~1 GB RAM)
```
1) Perfect sequential:                             0.131 s
2) Fully random:                                    0.857 s
3) Block-seq inside, block-random:                 0.146 s
4) Random-in-block, block-random:                  0.131 s
5) Block-seq inside, constant-stride blocks:        0.107 s
6) Random-in-block, constant-stride blocks:         0.107 s
```
Note #5/#6 beat even #1 here, and random is ~6–8× slower than everything else. The "dummy sum" printed at the end only prevents the compiler from deleting the loops.

---

## 3. Other CPU memory-layout examples

### `col_row_maj_cache.c`: row-major vs column-major traversal
Sums an N×N matrix (default N = 3000) two ways: row-major (`for i { for j }`, sequential) and column-major (`for j { for i }`, stride N). Each is timed `REPS = 100` times; only the average is printed. Column-major is typically **~5–6× slower** with far more cache misses. The sum is stored in a `volatile sink` so `-O2` cannot remove the loop.

```bash
gcc -O2 -o col_row_maj_cache col_row_maj_cache.c -lrt

./col_row_maj_cache            # both (default)
./col_row_maj_cache -r         # row-major only
./col_row_maj_cache -c         # column-major only
./col_row_maj_cache -n 5000    # matrix size (a bare number also works: -c 5000)
./col_row_maj_cache -h         # help

# Compare cache misses, one pattern per run
perf stat -e cache-misses,cache-references ./col_row_maj_cache -r
perf stat -e cache-misses,cache-references ./col_row_maj_cache -c
perf stat --repeat 5 -e cache-misses,cache-references ./col_row_maj_cache -c   # steadier
```
If `perf` reports "No supported events found": `sudo sysctl kernel.perf_event_paranoid=1` (or use sudo). Counts include the identical init phase, so the difference comes from the traversal.
Sample (N = 3000, -O2): `Row-major average time: 0.012 sec`, `Column-major average time: 0.070 sec`. A full run takes a few seconds (~1 s row, ~7 s column).

### `aos_vs_soa.c`: Array of Structures vs Structure of Arrays
Sums only the `x` field of 64M particles `{x,y,z,w}`. With **AoS**, 75% of every fetched cache line (y/z/w) is wasted; with **SoA**, `x` values are contiguous, so SoA is significantly faster.
```bash
gcc -O2 -o aos_vs_soa aos_vs_soa.c -lrt
./aos_vs_soa
```

### `matrix_transpose_optimization.c`: pre-transposing B
In `C = A×B`, the naive loop reads `B[k*N+j]`, striding by N each step. Transposing B once lets the inner loop read `B_T[j*N+k]` sequentially, so both operands stream through the cache. SIZE = 1024.
```bash
gcc -O2 -o matrix_transpose_optimization matrix_transpose_optimization.c -lrt
./matrix_transpose_optimization
```

---

## 4. Parallel / GPU examples

### `matmul_comparison.c`: six matrix multiply variants (1024×1024)
Progressively applies optimizations and times each (also prints threads available and a first-element check that all results agree):

1. Standard (poor locality for B)
2. Transposed B
3. Blocked (tiled)
4. OpenMP parallel
5. "SMT-aware": parallel + transposed + blocked (block 64)
6. "NUMA + SMT aware": per-thread init, dynamic scheduling, block 128

Speedups vary with core count, cache sizes and NUMA topology.
```bash
gcc -O2 -fopenmp -o matmul_comparison matmul_comparison.c
./matmul_comparison
OMP_NUM_THREADS=4 ./matmul_comparison     # control thread count
```

### `gpu_demo.c`: GPU (OpenCL) vs CPU
Runs a 1024×1024 matrix multiply and a 10M-element vector multiply on both. Matrix multiply gains far more from the GPU because it is **compute-bound** (O(N³) work on O(N²) data); element-wise vector multiply stays **memory-bound** (O(N)), so the GPU helps little once transfer costs are counted.
```bash
# Ubuntu/Debian: sudo apt-get install ocl-icd-opencl-dev   (plus a GPU/CPU OpenCL runtime, e.g. pocl-opencl-icd)
gcc -O2 -o gpu_demo gpu_demo.c -lOpenCL
./gpu_demo
```
Prints CPU time, GPU time and speedup for each operation, then a summary.

---

## 5. Verilog / Yosys examples

These show how many flip-flops synthesis *actually* produces. Requires [Yosys](https://github.com/YosysHQ/yosys).

### `dff_infer.v` / `dff_infer_keep.v`: duplicate registers
Two 8-bit registers (`reg_a`, `reg_b`) share the same clock, synchronous reset, enable and `data_in`, so the RTL implies **16 flip-flops**. Yosys sees they are always identical and merges them:

| Stage | Result | FFs |
|---|---|---|
| after `proc` | `$dff_8 ×2` | 16 |
| `proc; opt` | `$sdffe_8 ×1` (reset/enable folded in, duplicates merged) | 8 |
| generic `synth` | `$_SDFFE_PP0P_ ×8` | 8 |
| `synth_xilinx -family xc7` | `FDRE ×8` (+1 BUFG, 0 LUTs) | 8 |
| `dff_infer_keep.v` | `(* keep *)` blocks the merge | 16 |

`stat -width` prints cell width as a `_8` suffix, so *cells × width = flip-flops*. In Yosys 0.33 the `(* keep *)` must be on the `always` block; on the `reg` declaration alone it is not enough.

```bash
yosys -s dff_infer.ys       # reports all five stages (script not in this folder)
# or manually:
yosys -p "read_verilog dff_infer.v; synth -top dff_infer; stat -width"
yosys -p "read_verilog dff_infer_keep.v; synth -top dff_infer; stat -width"
```

### `number_multiplier.v`: constant multiplication folds to a shift
`result = data_ext * (12'd13 + 12'd3)`. The constants fold to 16, so synthesis replaces the multiplier with a fixed left shift by 4 (no `$mul` cell survives).
```bash
yosys -p "read_verilog number_multiplier.v; synth -top transfer; stat"
```

---

## 6. Number representation demos (`number_formats.c`)

Four short **predict-observe-explain** demos in one program. For each one: write down your prediction, press Enter, then compare with the output and explain any difference. Demos 1 and 3 are meant to surprise you.

```bash
gcc -o number_formats number_formats.c
./number_formats        # all four demos, in order
./number_formats 3      # just demo 3 (valid: 1-4; anything else prints usage and exits 1)
```

| # | Demo | What it shows |
|---|---|---|
| 1 | Bits inside a `float` (`-9.875f`, read via a `union`) | Prints `0xC11E0000`; work out sign, exponent and mantissa |
| 2 | 8-bit fixed point (`int8_t`, value = int / 128) | `0.1`, `0.2`, `0.3` truncate to 12, 25, 38, so `(a + b) - c` is `-1`, not `0` |
| 3 | 16-bit fixed point (`int16_t`, value = int / 256) | `A * B` for `1.5 * 1.5` overflows `int16_t` (result `0.25`, not `2.25`); fix with a 32-bit intermediate, then `>> 8` |
| 4 | Float addition order | `a = 1e30, b = -1e30, c = 1`: `(a + b) + c` is `1` but `a + (b + c)` is `0`. `volatile` stops the compiler folding the sums |

---

## 7. Quick reference

| File | Lang | Demonstrates | Build / deps |
|---|---|---|---|
| `cache_access.c` | C | Hardware prefetching: 6 access orders | `gcc -O2`, ~1 GB RAM |
| `col_row_maj_cache.c` (+ `.txt`) | C | Row vs column traversal, `perf` | `gcc -O2 -lrt`, optional `perf` |
| `aos_vs_soa.c` | C | AoS vs SoA layout | `gcc -O2 -lrt` |
| `matrix_transpose_optimization.c` | C | Transposing B for locality | `gcc -O2 -lrt` |
| `matmul_comparison.c` | C | Transpose, blocking, OpenMP, NUMA/SMT | `gcc -O2 -fopenmp` |
| `gpu_demo.c` | C | GPU compute-bound vs memory-bound | `-lOpenCL` + runtime |
| `number_formats.c` | C | Float encoding, fixed-point error/overflow, non-associativity | `gcc` |
| `dff_infer.v`, `dff_infer_keep.v` | Verilog | FF inference, merging, `(* keep *)` | Yosys |
| `number_multiplier.v` | Verilog | Constant multiply → shift | Yosys |

`col_row_maj_cache.txt` is a standalone cheat-sheet for that example; the compiled binaries in this folder are build artifacts and can be regenerated with the commands above.
