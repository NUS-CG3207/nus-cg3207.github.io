# Interactive visualisations

Self-contained pages for the CEG5203 / CG3207 computer architecture lectures. Open an `.html` file in a browser. No server or install is needed. The OpenCL, data-parallel, systolic and multithreading pages load their `_engine.js`, so keep each page and its engine in the same folder; the cache and interrupt simulators are single files.

| Page | Shows | Guide | Spec |
|---|---|---|---|
| [opencl.html](Visualisations/opencl.html) | One OpenCL host program step by step: device discovery, buffer transfers, kernel launch, work-groups on compute units, read-back. | [opencl.md](Visualisations/opencl.md) | [opencl_specs.md](Visualisations/opencl_specs.md) |
| [dataparallel.html](Visualisations/dataparallel.html) | One loop on scalar, SIMD and SIMT hardware, plus warp divergence, latency hiding and memory coalescing. | [dataparallel.md](Visualisations/dataparallel.md) | [dataparallel_specs.md](Visualisations/dataparallel_specs.md) |
| [systolic.html](Visualisations/systolic.html) | Matrix multiply on a systolic array, output stationary and weight stationary (the TPU). | [systolic.md](Visualisations/systolic.md) | [systolic_specs.md](Visualisations/systolic_specs.md) |
| [multithread.html](Visualisations/multithread.html) | Two threads on one superscalar core: no multithreading, coarse-grained, barrel, fine-grained and SMT. | [multithread.md](Visualisations/multithread.md) | [multithread_specs.md](Visualisations/multithread_specs.md) |
| [cache.html](Visualisations/cache.html) | A trace of memory accesses through a configurable cache: address fields, direct, set-associative and fully associative mapping, LRU, FIFO and optimal replacement, write-back against write-through, and compulsory, capacity, conflict and coherence misses. | [cache.md](Visualisations/cache.md) | – |
| [interrupt.html](Visualisations/interrupt.html) | Vectored against non-vectored interrupt handling. Click a peripheral to raise an IRQ, then step through the context switch, the ISR and the return. Vectored mode jumps through the vector table; non-vectored mode enters one handler that polls the interrupt status and branches. | [interrupt.md](Visualisations/interrupt.md) | – |

The guides say how to use each page. The specs describe the models behind them and keep each page's version history.

## Other files

- `*_engine.js`: the simulation behind each of the OpenCL, data-parallel, systolic and multithreading pages, with no DOM access. Loaded by the page and by its tests.
- `*_tests/`: engine and browser tests for each of those four pages. From the repository root, run `node opencl/<page>_tests/engine.test.js` and `NODE_PATH=$(npm root -g) node opencl/<page>_tests/ui.test.js`.
