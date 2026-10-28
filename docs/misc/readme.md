# AccelerationExamples - Performance Optimization Examples

This repository contains C/C++/Verilog/Vysper files demonstrating hardware acceleration techniques and performance implications of memory access patterns.

All examples are AI-generated.

---

## 1. aos_vs_soa.c

**Summary:**
Compares Array of Structures (AoS) vs Structure of Arrays (SoA) memory layouts by timing a loop that sums only the X component of 64 million particles. SoA layout achieves significant speedup by avoiding cache waste on unused fields.

**Description:**
This example demonstrates the classic AOS vs SoA tradeoff in memory layout optimization. When accessing a single component (X) from many structures, SoA layout allows the CPU to fetch only the needed data, while AOS wastes 75% of every cache line on unused y/z/w fields. The code initializes 64 million particles with 4 components each and times how long it takes to sum only the X component.

**How to Run:**
```bash
# Compile
gcc -o aos_vs_soa aos_vs_soa.c -lrt

# Run
./aos_vs_soa
```

---

## 2. coalesced_vs_non_coalesced.c

**Summary:**
Compares coalesced vs non-coalesced GPU memory access patterns for matrix multiplication using OpenCL. Demonstrates how coalesced memory access (sequential reads) dramatically outperforms non-coalesced (strided) access.

**Description:**
This example shows the importance of memory coalescing in GPU programming. The `matmul_coalesced` kernel accesses arrays in sequential order (A[row*N+k], B[k*N+col]), while `matmul_noncoalesced` accesses with stride (A[k*N+row], B[col*N+k]). Coalesced access allows GPUs to fetch multiple elements in a single memory transaction, yielding significant speedup. If no GPU is available, it falls back to CPU OpenMP implementation.

**How to Run:**
```bash
# Install OpenCL development libraries first
# Ubuntu/Debian: sudo apt-get install ocl-icd-opencl-dev
# Then compile
gcc -o coalesced_vs_non_coalesced coalesced_vs_non_coalesced.c -lOpenCL

# Run with matrix size (default 1024)
./coalesced_vs_non_coalesced 1024
```

---

## 3. col_row_maj_cache.c

**Summary:**
Compares row-major vs column-major traversal of a 2D array to demonstrate cache locality effects. Row-major order accesses consecutive memory locations, while column-major order strides through memory.

**Description:**
This simple example creates an N×N matrix and times two traversal patterns: row-major (i then j loops) and column-major (j then i loops). Row-major order benefits from CPU cache prefetching since consecutive memory addresses are accessed sequentially. Column-major traversal with stride N often results in cache misses due to non-sequential access patterns. The traversal pattern is selectable with a command line switch, so each pattern can be benchmarked separately (e.g. under `perf`), while running with no switch still executes both. Each traversal is timed `REPS = 100` times (compile-time constant in the source) and only the averaged time is printed.

**How to Run:**
```bash
# Compile
gcc -o col_row_maj_cache col_row_maj_cache.c -lrt
# (add -O2 for meaningful timings)
gcc -O2 -o col_row_maj_cache col_row_maj_cache.c -lrt

# Run both traversals (default behaviour, N=3000)
./col_row_maj_cache

# Run only one traversal (row-major -r / column-major -c)
./col_row_maj_cache -r
./col_row_maj_cache -c

# Output is the averaged time over REPS (=100) timed runs, e.g.
#   Row-major average time: 0.012 sec
#   Column-major average time: 0.070 sec

# Optional matrix size (default N=3000); a bare number works too
./col_row_maj_cache -n 5000
./col_row_maj_cache -c 5000

# Compare cache misses of the two access patterns
perf stat -e cache-misses,cache-references ./col_row_maj_cache -r
perf stat -e cache-misses,cache-references ./col_row_maj_cache -c

# Other switches
./col_row_maj_cache --help
```

---

## 4. gpu_demo.c

**Summary:**
Demonstrates GPU acceleration using OpenCL for both matrix multiplication and vector multiplication, comparing performance gains of GPU vs CPU implementations.

**Description:**
This demo performs two operations using OpenCL: (1) Matrix multiplication (1024×1024) and (2) Vector multiplication (10,000,000 elements). Both operations are compared against CPU implementations. The key insight is that matrix multiplication benefits more from GPU acceleration because it's compute-bound (O(N³)), while elementwise operations remain memory-bound (O(N)).

**How to Run:**
```bash
# Compile
gcc -o gpu_demo gpu_demo.c -lOpenCL

# Run
./gpu_demo
```

---

## 5. matrix_transpose_optimization.c

**Summary:**
Shows how pre-transposing matrix B before multiplication improves cache locality. The naive implementation accesses B with stride N, while the optimized version accesses both matrices sequentially.

**Description:**
This example demonstrates a classic optimization technique: pre-transposing matrix B so that both A and B_T can be accessed in sequential row order during multiplication. The naive `matmul_naive` function accesses B[k*N+j] which strides by N elements per k-loop iteration. After transposing B to B_T, the optimized `matmul_transposed` accesses B_T[j*N+k] which is sequential. This dramatically improves cache utilization.

**How to Run:**
```bash
# Compile
gcc -o matrix_transpose_optimization matrix_transpose_optimization.c -lrt

# Run with default SIZE=1024
./matrix_transpose_optimization
```

---

## 6. vadd_comparison.cpp

**Summary:**
Compares a simple vector addition kernel vs an optimized burst-mode kernel using HLS-style pragmas. The burst kernel improves throughput by processing data in chunks of 64 elements.

**Description:**
This C++ example demonstrates HLS (High-Level Synthesis) style optimization techniques. The `vadd_simple` kernel processes elements one-by-one, while `vadd_burst` processes chunks of 64 elements using local buffers. The burst approach reduces memory access overhead by grouping operations together. The code uses HLS pragmas like `#pragma HLS PIPELINE`, `#pragma HLS ARRAY_PARTITION` for simulation purposes (these are typically used for FPGA HLS tools).

**How to Run:**
```bash
# Compile with g++ (HLS pragmas are ignored for CPU execution)
g++ -o vadd_comparison vadd_comparison.cpp -std=c++11

# Run
./vadd_comparison
```

---

## 7. report_adders.v

**Summary:**
Verilog module for simple arithmetic operations: addition, bitwise AND with mask, and multiplication by 2 (left shift).

**Description:**
This is a basic Verilog design showing simple arithmetic operations using 8-bit inputs and outputs. The module takes a 8-bit input `a` and produces three outputs: `y1` (addition with constants), `y2` (bitwise AND with mask 0xFF), and `y3` (multiplication by 2, equivalent to left shift).

**How to Run:**
This Verilog file requires synthesis tools like Yosys for simulation/reporting:
```bash
# Using Yosys
yosys -s report_adders.ys
```

---

## 8. report_adders.ys

**Summary:**
Yosys script to load the Verilog design, synthesize it, and report statistics on arithmetic operations.

**Description:**
This Yosys script performs: (1) Load the Verilog file, (2) Check hierarchy, (3) Synthesize the design, and (4) Report statistics on `$add` (ALU) and `$mul` operations. It's used for analyzing hardware resource usage after synthesis.

**How to Run:**
```bash
# Run with Yosys
yosys -s report_adders.ys
```

---

## 9. sum_halves/sum_halves.cpp

**Summary:**
Vitis HLS example for computing a sum of halves with BRAM interfaces. Demonstrates HLS pragmas for memory mapping and pipelining.

**Description:**
This is a Vitis HLS design example that shows how to define HLS interfaces for BRAM (Block RAM). The function `sum_halves` takes an array of 2048 integers and outputs 1024 averaged values. It uses `#pragma HLS INTERFACE bram` to map arrays to BRAM, and `#pragma HLS PIPELINE` for pipelining. The commented line shows computing the average of 3 elements, while the active line computes using 3 different array elements divided by 3.

**How to Run:**
This requires Vitis HLS toolchain for FPGA synthesis:
```bash
# Requires Vitis HLS installation
# Launch Vitis HLS GUI and load sum_halves.cpp
```

---

## 10. dff_infer.v / dff_infer_keep.v

**Summary:**
Pure Verilog-2001 `always @(posedge clk)` block with two 8-bit registers (`reg_a`, `reg_b`) that are both loaded from the same `data_in`, with a synchronous `reset` and an `enable`. Shows how many flip-flops Yosys infers and how it optimizes duplicate registers.

**Description:**
The RTL implies **16 flip-flops** (2 registers x 8 bits). Yosys reports exactly that right after `proc` (`$dff_8 x 2`), but after optimization it merges the two registers into one (`$sdffe_8 x 1` -> `$_SDFFE_PP0P_ x 8` -> `FDRE x 8`), i.e. **8 flip-flops**, because `reset` always loads `8'h00` into both and `enable` always loads the same `data_in` into both, so the two registers are always identical. `dff_infer_keep.v` is the same design with `(* keep *)` on the `always` block, which blocks the merge and keeps all 16 flip-flops (in Yosys 0.33 the attribute must be on the `always` block; a `(* keep *)` on the declaration alone is not enough).

**How to Run:**
```bash
# Using Yosys
yosys -s dff_infer.ys
```

---

## 11. dff_infer.ys

**Summary:**
Yosys script that reports the flip-flop count of `dff_infer.v` at five different stages of synthesis.

**Description:**
The script loads the design and prints `stat -width` after (1) `proc` only -> `$dff_8 x 2` = 16 flip-flops, (2) `proc; opt` -> `$sdffe_8 x 1` = 8 flip-flops (reset/enable folded into the FF cell, identical registers merged), (3) generic full `synth` -> `$_SDFFE_PP0P_ x 8` = 8 flip-flops, (4) `synth_xilinx -family xc7` -> `FDRE x 8` plus 1 `BUFG` and 0 LUTs = 8 flip-flops, and (5) the `(* keep *)` variant `dff_infer_keep.v` -> `$_SDFFE_PP0P_ x 16` = 16 flip-flops. `stat -width` prints the cell width as an `_8` suffix, so cells x width = flip-flop count.

**How to Run:**
```bash
# Run with Yosys
yosys -s dff_infer.ys
```

---

## Quick Reference Table

| File | Language | Purpose | Dependencies |
|------|----------|---------|--------------|
| aos_vs_soa.c | C | AOS vs SoA comparison | libc, librt |
| coalesced_vs_non_coalesced.c | C | GPU memory coalescing | OpenCL |
| col_row_maj_cache.c | C | Cache locality demo | libc, librt |
| gpu_demo.c | C | GPU acceleration demo | OpenCL |
| matrix_transpose_optimization.c | C | Cache optimization via transpose | libc, librt |
| vadd_comparison.cpp | C++ | HLS burst optimization | libc++ |
| report_adders.v | Verilog | Arithmetic logic design | Yosys |
| report_adders.ys | Script | Yosys synthesis script | Yosys |
| dff_infer.v | Verilog | `always` register inference (16 FFs) | Yosys |
| dff_infer_keep.v | Verilog | Same RTL with `(* keep *)` -> 16 FFs kept | Yosys |
| dff_infer.ys | Script | Flip-flop count at 5 synthesis stages | Yosys |
| sum_halves/sum_halves.cpp | C (HLS) | Vitis HLS example | Vitis HLS |

---

*Generated for AccelerationExamples repository*