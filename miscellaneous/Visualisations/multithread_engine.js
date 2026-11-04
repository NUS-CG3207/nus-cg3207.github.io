/* Hardware multithreading models behind multithread.html. No DOM access: the
 * page and the node test suite both load this file. run() generates two instruction
 * streams and issues them on one superscalar core under four policies:
 *   none  one thread at a time; the core idles through every stall
 *   cgmt  coarse-grained: run one thread until it stalls on a miss, then switch
 *         (a refill penalty per switch); short dependency stalls are not hidden
 *   barrel fine-grained with strict rotation (a barrel processor): the cycle belongs to one
 *         thread in turn, so a stalled thread's turn is wasted
 *   fgmt  fine-grained: a different ready thread every cycle, one thread per cycle
 *   smt   simultaneous: the slots of one cycle are shared by both threads
 * Each stream is a list of groups of independent instructions. A group can issue
 * (possibly across several cycles, as slots allow); the next group waits for the
 * stall after it: none, a one-cycle dependency bubble, or a cache miss.          */
(function (root) {
'use strict';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RATES = { low: [0.15, 0.25], medium: [0.3, 0.4], high: [0.5, 0.5] };   // [miss, dependency]
const MODES = ['none', 'cgmt', 'barrel', 'fgmt', 'smt'];

function generate({ groups, ilp, stalls, lat, seed }) {
  const [pMiss, pDep] = RATES[stalls];
  return [0, 1].map(th => {
    const r = rng(seed * 1009 + th * 7919 + 17);
    const gs = [];
    for (let g = 0; g < groups; g++) {
      const n = 1 + Math.floor(r() * ilp);
      let stall = { kind: 'none', len: 0 };
      if (g < groups - 1) {
        if (r() < pMiss) stall = { kind: 'miss', len: lat };
        else if (r() < pDep) stall = { kind: 'dep', len: 1 };
      }
      gs.push({ n, stall });
    }
    return { groups: gs, total: gs.reduce((s, g) => s + g.n, 0) };
  });
}

function simulate(mode, T, W, switchCost) {
  const st = T.map(th => ({ gi: 0, left: th.groups[0].n, readyAt: 0, done: false, finished: -1, next: 1, stallKind: 'none' }));
  const ready = (i, t) => !st[i].done && st[i].readyAt <= t;
  const issues = [];
  function issue(i, t, slots) {
    const s = st[i], n = Math.min(s.left, slots), out = [];
    for (let k = 0; k < n; k++) out.push({ th: i, id: s.next++, g: s.gi, cycle: t, stall: null });
    s.left -= n;
    if (s.left === 0) {
      const g = T[i].groups[s.gi];
      // The last instruction of a group is the one the following stall hangs on.
      if (g.stall.kind !== 'none' && out.length) out[out.length - 1].stall = g.stall.kind;
      if (s.gi === T[i].groups.length - 1) { s.done = true; s.finished = t + 1; }
      else { s.gi++; s.left = T[i].groups[s.gi].n; s.readyAt = t + 1 + g.stall.len; s.stallKind = g.stall.kind; }
    }
    issues.push(...out);
    return out;
  }

  const cycles = [];
  const states = [];
  let t = 0, cur = 0, pen = 0, last = 1, switches = 0, from = 0;
  while (!st.every(s => s.done) && t < 5000) {
    let row = [], kind = null;
    if (mode === 'none') {
      const c = st[0].done ? 1 : 0;
      if (ready(c, t)) row = issue(c, t, W);
    } else if (mode === 'cgmt') {
      if (pen > 0) { pen--; kind = 'switch'; }
      else {
        const o = 1 - cur;
        const missStall = !st[cur].done && st[cur].readyAt > t && st[cur].stallKind === 'miss';
        if (st[cur].done ? !st[o].done : (missStall && ready(o, t))) {
          from = cur; cur = o; switches++;
          if (switchCost > 0) { pen = switchCost - 1; kind = 'switch'; }
        }
        if (!kind && ready(cur, t)) row = issue(cur, t, W);
      }
    } else if (mode === 'barrel') {
      // Strict rotation: the cycle belongs to one thread, ready or not. Once a thread has finished
      // the barrel holds only the other one.
      const th = st[t % 2].done ? 1 - (t % 2) : t % 2;
      if (ready(th, t)) row = issue(th, t, W);
    } else if (mode === 'fgmt') {
      const pick = [(last + 1) % 2, last].find(i => ready(i, t));
      if (pick !== undefined) { row = issue(pick, t, W); last = pick; }
    } else {
      const rd = [ready(0, t), ready(1, t)];
      let slots = W;
      for (const th of (t % 2 === 0 ? [0, 1] : [1, 0])) {
        if (rd[th] && slots > 0) { const r = issue(th, t, slots); row.push(...r); slots -= r.length; }
      }
    }
    const cells = row.map(r => ({ th: r.th, id: r.id, stall: r.stall }));
    while (cells.length < W) cells.push({ kind: kind === 'switch' ? 'switch' : row.length === 0 ? 'vwaste' : 'hwaste', to: cur, from });
    cycles.push(cells);
    // What each thread was doing this cycle: issuing, stalled on a miss or a dependency, ready but not picked, or finished.
    states.push(st.map((s, i) => (row.some(r => r.th === i) ? 'run' : s.done && s.finished <= t ? 'done' : s.readyAt > t ? s.stallKind : 'wait')));
    t++;
  }
  const issued = issues.length;
  const count = k => cycles.reduce((s, c) => s + c.filter(x => x.kind === k).length, 0);
  return {
    mode, cycles, states, issues, issued, length: t, util: issued / (W * t), ipc: issued / t,
    finishedAt: st.map(s => s.finished), switches,
    vwaste: count('vwaste'), hwaste: count('hwaste'), switchSlots: count('switch'),
  };
}

function run({ width = 4, ilp = 3, stalls = 'low', lat = 6, switchCost = 2, groups = 8, seed = 5 }) {
  const threads = generate({ groups, ilp, stalls, lat, seed });
  const modes = {};
  for (const m of MODES) modes[m] = simulate(m, threads, width, switchCost);
  return { width, ilp, stalls, lat, switchCost, groups, seed, threads, modes, maxCycles: Math.max(...MODES.map(m => modes[m].length)) };
}

const api = { run, generate, simulate, rng, MODES, RATES };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.MT = api;
})(typeof window !== 'undefined' ? window : globalThis);
