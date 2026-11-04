# Hardware multithreading: user guide

`multithread.html` runs the same two instruction streams on one superscalar core under five policies, one cycle per step. It follows slides 34 and 35 of *The Processor (Advanced)*.

Open the file in a browser. It needs no server, but `multithread_engine.js` must sit in the same folder.

## Reading the picture

Columns are cycles and rows are issue slots. Blue instructions belong to thread A (hart 0) and orange to thread B (hart 1); the number is the instruction's position in its thread. A red hatched slot is lost because no thread could issue that cycle. A dashed slot is unused in a cycle where something did issue (the thread had no more independent instructions). A purple hatched slot is a pipeline refill after a coarse-grained switch.

An `M` on an instruction is a load that misses in the cache; the thread then stalls. A `d` is an instruction whose result the next instructions need, which costs a one-cycle bubble. The two strips under each grid give each thread's state every cycle: solid is issuing, striped is waiting on a miss, dotted is waiting on a dependency, and an outline is ready but not picked. This is what explains the schedule: when one thread issues alone, the other's strip is striped or dotted. A refill slot is labelled with the thread it switches to. Hover any slot for the reason.

All four rows share one time axis, so a scheme that finishes sooner simply ends sooner.

## Controls

| Control | Action |
|---|---|
| ▶ / Space | Play or pause |
| ▶\| / → | One cycle forward |
| ◀ / ← | One cycle back |
| ⏮ / Home | Start |
| Slider | Scrub to any cycle |

Changing a setting rewinds. **Reshuffle** draws new instruction streams. On a phone, **Setup** shows the settings and the grids shrink to fit; instruction labels and badges are hidden and a missing load is a dark-outlined block.

## Schemes

| Scheme | Rule | What it hides |
|---|---|---|
| None | Run A to the end, then B. | Nothing. |
| Coarse-grained | Run one thread until it stalls on a cache miss, then switch (refill cost). | Long stalls only. A one-cycle dependency stall is not worth a switch. |
| Fine-grained: barrel | Strict rotation: even cycles belong to A, odd cycles to B, ready or not. | Stalls shorter than the rotation. A stalled thread's turn is wasted, even if the other thread is ready. |
| Fine-grained: skipping | A different ready thread every cycle; a stalled thread is skipped. | Short and long stalls. |
| SMT | Both threads can fill the slots of one cycle. | Stalls, and unused slots when one thread lacks ILP. |

## Settings

- **Issue width** is the number of slots per cycle.
- **Thread ILP** is the most independent instructions a thread can offer in a cycle. Groups are one to that many instructions.
- **Stalls** sets how often a group is followed by a one-cycle dependency stall or a cache miss. **Miss latency** is the length of a miss.
- **Switch cost** is the refill, in cycles, paid at each coarse-grained switch.

## Things to try

- In fine-grained, thread A issues alone in cycles 5 to 8. Look at B's strip: B4 missed, so B waits until cycle 11 and the core takes the only ready thread.
- Compare the barrel with the skipping fine-grained row. In the barrel, cycle 6 is B's turn and B is waiting on its miss, so the cycle is lost although A is ready. Skipping uses it for A. Defaults: 28 cycles against 23.
- With the defaults the finish times are 40, 30, 28, 23 and 20 cycles. Compare the red and dashed slots row by row: skipping fine-grained and SMT lose the same whole cycles, and SMT recovers the partly empty ones.
- SMT's lead over fine-grained is biggest when one thread cannot fill the width. At width 4 with ILP 1 or 2 it is about 2.5 cycles on average; at width 2 with ILP 2 or more a single thread nearly fills the core and the lead shrinks to under one.
- Raise the switch cost from 0 to 3 with many stalls and a miss latency of 8. Coarse-grained slows from about 47 to 59 cycles, while fine-grained stays at 45. Switching is cheap per stall only if the stall is long.
- Compare "A done" across rows. Thread A finishes at cycle 20 on its own, 22 under fine-grained and 24 under coarse-grained. Each thread gets slower; the pair finishes sooner.
- Raise the miss latency to 12. Even fine-grained and SMT lose many whole cycles, because two threads cannot cover a miss that long. GPUs keep many warps resident for this reason (slide 50).

## Simplifications

- The core issues in program order within a thread. A group of instructions is independent; the next group waits for the stall after the previous one.
- A thread has no more than one outstanding stall, and switching never loses a thread's registers (each hart has its own copy).
- Fine-grained, both kinds, issues from one thread per cycle but can issue up to the full width from it. Once a thread has finished, the barrel serves the remaining one every cycle.
- SMT alternates which thread gets first pick of the slots each cycle.
