# Cache memory simulator: user guide

`cache.html` is a single self-contained file (CSS and JS inline). Open it in a browser; no server or other files needed.

It runs a trace of memory accesses through a configurable cache, one access at a time: mapping, replacement, write policies and the types of misses.

## Addresses

Byte addressing is the default: 4 bytes per word, so the address has two byte-offset bits below the word field. **Word addr** drops them. Switching keeps the memory size (address bits change by 2) and rewrites the trace addresses, so the same locations are accessed and the results do not change.

Fields, high to low: tag, index, word, byte. The index is called *Block* for a direct-mapped cache and *Set* otherwise; a fully associative cache has none. Memory block number = address ÷ block size.

## Setup

| Control | Sets |
|---|---|
| Address bits | Width of the address, hence memory size |
| Words/block, Cache blocks | Cache geometry |
| Mapping | Direct mapped, N-way set associative, fully associative |
| Replace | LRU, FIFO or Optimal. Hidden when direct mapped |
| Writes | Write-back (dirty bit, whole block written on eviction) or write-through (every write goes to memory). Both allocate on a write miss |

The examples run one trace under direct, 2-way and fully associative mapping, a reference string for each replacement policy, a miss-type example, write-back against write-through, and a DMA invalidation.

## Trace

One item per access: `R addr`, `W addr`, or `D addr` (a DMA write to that block in memory). A bare number is a read. Decimal, `0x` hex and `0b` binary are accepted; items can be separated by spaces, commas or new lines; `#` or `//` starts a comment. Set **Numbers are** to *block numbers* to type a reference string such as `1 2 3 4 1 2 5`. Press Run or Ctrl+Enter after editing.

## Reading the results

Each miss is classified as:

| Type | Rule used |
|---|---|
| Compulsory | First reference to the block |
| Capacity | A fully associative LRU cache of the same size would also miss |
| Conflict | That cache would have hit |
| Coherence | The block was invalidated by DMA since it was last fetched |

The Replace panel runs FIFO, LRU and Optimal on the same trace and geometry, one column per access showing the accessed set afterwards, `f` for a miss. It appears only when there is a replacement choice. Optimal breaks ties by evicting the lowest-numbered way.

In the cache table, *recency* #1 is the most recently used line (LRU), *age* #1 is the oldest fill (FIFO), and *next use* is the access number at which the block is next needed (Optimal). A struck-through tag is a line invalidated by DMA.

## Controls

| Control | Action |
|---|---|
| ▶ / → | Next access |
| ◀ / ← | Previous access |
| ⏭ / End | Last access |
| ⏵ / Space | Auto-play (speed selector beside it) |
| ⟲ / R / Home | Back to the start |
| Slider, trace row, comparison column | Jump to that access |

On a phone the Lookup, Cache, Replace and Trace panels are tabs; the controls stay on screen.

## Tests

```
node cache/cache_tests/engine.test.js
NODE_PATH=$(npm root -g) node cache/cache_tests/ui.test.js
```
