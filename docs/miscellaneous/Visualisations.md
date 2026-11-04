# Interactive visualisations

Self-contained pages for the CEG5203 / CG3207 computer architecture lectures. Open an `.html` file in a browser. No server or install is needed. The first four pages load their `_engine.js`, so keep each page and its engine in the same folder; the interrupt simulator is a single file.

| Page | Shows | Guide | Spec |
|---|---|---|---|
| [opencl.html](opencl.html) | One OpenCL host program step by step: device discovery, buffer transfers, kernel launch, work-groups on compute units, read-back. | [opencl.md](opencl.md) | [opencl_specs.md](opencl_specs.md) |
| [dataparallel.html](dataparallel.html) | One loop on scalar, SIMD and SIMT hardware, plus warp divergence, latency hiding and memory coalescing. | [dataparallel.md](dataparallel.md) | [dataparallel_specs.md](dataparallel_specs.md) |
| [systolic.html](systolic.html) | Matrix multiply on a systolic array, output stationary and weight stationary (the TPU). | [systolic.md](systolic.md) | [systolic_specs.md](systolic_specs.md) |
| [multithread.html](multithread.html) | Two threads on one superscalar core: no multithreading, coarse-grained, barrel, fine-grained and SMT. | [multithread.md](multithread.md) | [multithread_specs.md](multithread_specs.md) |
| [RISC-V Interrupt Simulator.html](RISC-V%20Interrupt%20Simulator.html) | Vectored against non-vectored interrupt handling. Click a peripheral to raise an IRQ, then step through the context switch, the ISR and the return. Vectored mode jumps through the vector table; non-vectored mode enters one handler that polls the interrupt status and branches. | none | none |

The guides say how to use each page. The specs describe the models behind them and keep each page's version history. The interrupt simulator has no guide, spec or tests; it is a saved copy of [the NUS CS2100DE animation](https://nus-cs2100de.github.io/animations/vectored_nonvectored.html).

## Other files

- `*_engine.js`: the simulation behind each of the first four pages, with no DOM access. Loaded by the page and by its tests.
- `*_tests/`: engine and browser tests for each of the first four pages. From the repository root, run `node opencl/<page>_tests/engine.test.js` and `NODE_PATH=$(npm root -g) node opencl/<page>_tests/ui.test.js`.
- [CEG5203 Topic 4 Introduction to OpenCL.pdf](CEG5203%20Topic%204%20Introduction%20to%20OpenCL.pdf): the slides that `opencl.html` follows.
