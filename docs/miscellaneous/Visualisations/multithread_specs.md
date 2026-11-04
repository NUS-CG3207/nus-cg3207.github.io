# Hardware multithreading visualisation: specification

## Files

| File | Role |
|---|---|
| `multithread.html` | Page: cards, grids, settings, transport. |
| `multithread_engine.js` | DOM-free issue-slot simulator, loaded by the page and the tests. |
| `multithread_tests/engine.test.js` | Invariants over every offered configuration. `node opencl/multithread_tests/engine.test.js` |
| `multithread_tests/ui.test.js` | Drives the page in Chromium at desktop, 1080p, phone and dark settings. `NODE_PATH=$(npm root -g) node opencl/multithread_tests/ui.test.js` |
| `multithread.md` | User guide. |

## Engine

`MT.run({width, ilp, stalls, lat, switchCost, groups, seed})` generates two instruction streams and simulates each of the five policies to completion. Every policy sees the same streams.

- **Streams:** a list of groups of independent instructions. A group has 1 to `ilp` instructions. After each group except the last there is a stall: none, a one-cycle dependency stall, or a miss of `lat` cycles, with probabilities from the `stalls` preset. A group may issue across several cycles when slots run short; the stall counts from the cycle after its last instruction.
- **None:** thread 0 to the end, then thread 1.
- **Coarse-grained:** run one thread until it is stalled on a miss and the other is ready, then switch and pay `switchCost` refill cycles (all slots lost). A thread that finishes also hands over. One-cycle stalls never trigger a switch.
- **Barrel:** strict rotation. Cycle `t` belongs to thread `t mod 2` whether or not it is ready, and all `width` slots go to it. When a thread has finished the barrel serves the other every cycle.
- **Fine-grained (skipping):** each cycle the next ready thread after the last issuer, else the same one; all `width` slots go to that thread.
- **SMT:** each cycle the threads alternate who picks first; the first fills what it can, the second takes the remaining slots.
- **Causes:** the last instruction issued from a group carries the group's stall kind (`miss` or `dep`). Each cycle also records every thread's state: `run` if it issued, otherwise its stall kind while `readyAt` is in the future, `wait` if ready but not picked, `done` once finished. A lost cycle always has a stalled thread; a refill cell records the thread it switches from and to.
- **Slot accounting:** a slot is an instruction, a refill, lost in an empty cycle (vertical waste) or unused in a busy cycle (horizontal waste). They sum to `width × cycles`, and the instruction count is the same under every policy.

The default seed is chosen so the four policies finish in clearly different times. The tests check program order, stall respect, one thread per cycle for the non-SMT policies, that the barrel only issues in its own turn, that the skipping policies and SMT never lose a cycle while a thread is ready (the barrel can), refill accounting, and the ordering none > coarse > barrel > fine ≥ SMT averaged over 60 streams (a single stream can break it: a switch cost can make coarse-grained slower than the baseline).

## UI rules

- All sizes are in `rem` with the root font size `clamp(13px, 1.05vw, 28px)`; cell height also follows the viewport height so the five cards fit a 1080p screen.
- All four grids share one time axis. Above 860 px each grid scrolls horizontally if it needs to and follows the current cycle; at or below 860 px every cycle is fitted to the width, instruction labels are hidden and the ruler shows every fifth cycle.
- Stall causes are drawn three ways: a badge (`M`, `d`) on the instruction, two thread-state strips under each grid, and a tooltip on every slot. Under 860 px the badges and labels are hidden (a missing load keeps a dark outline) and the strips remain.
- Transport, narration and settings sit in the header, so the controls stay on screen while the cards scroll.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-04 | First version. Two threads on a superscalar core under no multithreading, coarse-grained, fine-grained and SMT; per-thread colours; vertical and horizontal waste counted per scheme. |
| 0.2 | 2026-11-04 | Made stalls legible. The load that misses and the instruction behind a dependency stall are badged, each thread's state is shown every cycle in a strip (so a thread that stalls while the other issues is visible), refill slots name the thread they switch to, and slots have tooltips. The default fine-grained schedule looked like it ignored alternation in cycles 5 to 8 because thread B's stall was not shown. |
| 0.3 | 2026-11-04 | Added the barrel processor (strict alternation) as a fifth scheme, separate from skipping fine-grained, to show what skipping a stalled thread buys. Row heights tightened so five cards still fit at 1080p. |
