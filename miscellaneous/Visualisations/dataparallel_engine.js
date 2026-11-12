/* Data-parallelism models behind dataparallel.html. No DOM access: the page
 * and the node test suite both load this file. Each function simulates one demo
 * up front and returns plain data that the page replays one cycle at a time.
 *   axpy      y[i] = a*x[i] + y[i] on a scalar core, a vector (SIMD) core and a SIMT core
 *   diverge   an if/else across warps, with lanes masked rather than jumped
 *   latency   warps interleaved on one core while loads are outstanding
 *   coalesce  one warp load grouped into memory transactions                      */
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

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ 1. axpy */

const LISTING = {
  scalar: [
    'flw     ft0, 0(a1)        # x[i]',
    'flw     ft1, 0(a2)        # y[i]',
    'fmadd.s ft1, fa0, ft0, ft1',
    'fsw     ft1, 0(a2)',
  ],
  vector: [
    'vsetvli t0, a0, e32       # vl = min(n left, VLMAX)',
    'vle32.v  v0, (a1)         # load x',
    'vle32.v  v1, (a2)         # load y',
    'vfmacc.vf v1, fa0, v0     # y += a*x, all lanes',
    'vse32.v  v1, (a2)         # store y',
  ],
  simt: [
    'ld.global  r1, x[i]',
    'ld.global  r2, y[i]',
    'fma        r2, a, r1, r2',
    'st.global  y[i], r2',
  ],
};
const KINDS = { scalar: ['load', 'load', 'alu', 'store'], vector: ['setvl', 'load', 'load', 'alu', 'store'], simt: ['load', 'load', 'alu', 'store'] };

function axpy({ n, w, a = 2 }) {
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const y0 = Array.from({ length: n }, (_, i) => 10 + (i * 7) % 9);
  const expected = x.map((v, i) => a * v + y0[i]);

  // One record per issued instruction, one cycle each. lanes[j] is the element
  // lane j works on, or -1 when the lane is masked off or unused.
  const mk = (machine, line, group, lanes, vl) => {
    const kind = KINDS[machine][line];
    const vals = lanes.map(i => {
      if (i < 0 || kind === 'setvl') return null;
      if (line === (machine === 'vector' ? 1 : 0)) return x[i];
      if (line === (machine === 'vector' ? 2 : 1)) return y0[i];
      return expected[i];
    });
    return { machine, line, kind, group, lanes, vals, vl };
  };

  const scalar = [];
  for (let i = 0; i < n; i++) for (let l = 0; l < 4; l++) scalar.push(mk('scalar', l, i, [i], 1));

  const vector = [];
  for (let s = 0, base = 0; base < n; s++, base += w) {
    const vl = Math.min(w, n - base);
    const lanes = Array.from({ length: w }, (_, j) => (j < vl ? base + j : -1));
    vector.push(mk('vector', 0, s, lanes.map(() => -1), vl));
    for (let l = 1; l < 5; l++) vector.push(mk('vector', l, s, lanes, vl));
  }

  const simt = [];
  for (let g = 0; g * w < n; g++) {
    const lanes = Array.from({ length: w }, (_, j) => (g * w + j < n ? g * w + j : -1));
    for (let l = 0; l < 4; l++) simt.push(mk('simt', l, g, lanes, lanes.filter(i => i >= 0).length));
  }

  const machines = { scalar, vector, simt };
  const out = {};
  for (const m of Object.keys(machines)) {
    const recs = machines[m];
    const width = m === 'scalar' ? 1 : w;
    const vrecs = recs.filter(r => r.kind !== 'setvl');
    const useful = vrecs.reduce((s, r) => s + r.lanes.filter(i => i >= 0).length, 0);
    out[m] = {
      records: recs, listing: LISTING[m], width, groups: recs[recs.length - 1].group + 1,
      instrs: recs.length, cycles: recs.length,
      laneSlots: vrecs.length * width, useful, util: useful / (vrecs.length * width),
    };
  }
  return { n, w, a, x, y0, expected, machines: out };
}

/* y after the first t cycles of a machine. */
function yAt(model, machine, t) {
  const y = model.y0.slice();
  const recs = model.machines[machine].records;
  for (let c = 0; c < Math.min(t, recs.length); c++) {
    const r = recs[c];
    if (r.kind === 'store') r.lanes.forEach((i, j) => { if (i >= 0) y[i] = r.vals[j]; });
  }
  return y;
}

/* -------------------------------------------------------------- 2. divergence */

function diverge({ w, warps, pattern = 'random', p = 0.5, seed = 1, costA = 4, costB = 4, flips = [] }) {
  const total = w * warps;
  const k = Math.round(p * total);
  let taken;
  if (pattern === 'sorted') taken = Array.from({ length: total }, (_, i) => i < k);
  else if (pattern === 'alternating') taken = Array.from({ length: total }, (_, i) => i % 2 === 0);
  else taken = shuffle(Array.from({ length: total }, (_, i) => i < k), rng(seed));
  for (const f of flips) if (f >= 0 && f < total) taken[f] = !taken[f];

  const rx = rng(seed * 7919 + 13);
  const x = taken.map(t => (t ? 1 : -1) * (1 + Math.floor(rx() * 9)));

  const records = [];
  const info = [];
  for (let g = 0; g < warps; g++) {
    const t = taken.slice(g * w, (g + 1) * w);
    const nt = t.map(v => !v);
    const anyA = t.some(Boolean), anyB = nt.some(Boolean);
    info.push({ anyA, anyB, divergent: anyA && anyB });
    records.push({ warp: g, pass: 'cmp', k: 0, active: t.map(() => true) });
    if (anyA) for (let c = 0; c < costA; c++) records.push({ warp: g, pass: 'A', k: c, active: t });
    if (anyB) for (let c = 0; c < costB; c++) records.push({ warp: g, pass: 'B', k: c, active: nt });
  }
  const useful = records.reduce((s, r) => s + r.active.filter(Boolean).length, 0);
  // Independent lanes (no shared PC) would only pay for the longest path any lane takes.
  const independent = info.reduce((s, i) => s + 1 + Math.max(i.anyA ? costA : 0, i.anyB ? costB : 0), 0);
  return {
    w, warps, costA, costB, taken, x, records, info,
    cycles: records.length, laneSlots: records.length * w, useful, util: useful / (records.length * w),
    divergentWarps: info.filter(i => i.divergent).length, independent, slowdown: records.length / independent,
  };
}

/* ----------------------------------------------------------- 3. latency hiding */

/* Each warp issues `issue` instructions, the last of which is a load that stalls
 * it for `lat` cycles; this repeats `rounds` times and the final burst ends in a
 * store (no stall). The scheduler keeps issuing from the current warp while it is
 * ready, otherwise takes the next ready warp after it in round-robin order (so no
 * warp starves). Grid chars:
 * I issuing, M waiting on memory, R ready but not picked, D finished. */
function latency({ warps, issue, lat, rounds }) {
  const left = Array(warps).fill(issue);
  const round = Array(warps).fill(0);
  const readyAt = Array(warps).fill(0);
  const done = Array(warps).fill(false);
  const finishedAt = Array(warps).fill(-1);
  const grid = Array.from({ length: warps }, () => []);
  const issuedBy = [];
  let cur = -1, t = 0;
  while (done.some(d => !d)) {
    const ready = g => !done[g] && readyAt[g] <= t;
    let pick = -1;
    if (cur >= 0 && ready(cur)) pick = cur;
    else for (let d = 1; d <= warps; d++) { const g = ((cur < 0 ? -1 : cur) + d) % warps; if (ready(g)) { pick = g; break; } }
    for (let g = 0; g < warps; g++) {
      grid[g].push(done[g] ? 'D' : g === pick ? 'I' : readyAt[g] > t ? 'M' : 'R');
    }
    issuedBy.push(pick);
    if (pick >= 0) {
      cur = pick;
      if (--left[pick] === 0) {
        if (++round[pick] === rounds) { done[pick] = true; finishedAt[pick] = t + 1; }
        else { left[pick] = issue; readyAt[pick] = t + 1 + lat; }
      }
    }
    t++;
  }
  const cycles = t;
  const issueCycles = warps * rounds * issue;
  const solo = rounds * issue + (rounds - 1) * lat;
  return {
    warps, issue, lat, rounds, grid, issuedBy, cycles, issueCycles, util: issueCycles / cycles,
    finishedAt, soloCycles: solo, speedup: warps * solo / cycles,
    warpsToHide: Math.ceil((issue + lat) / issue),
  };
}

/* ------------------------------------------------------------- 4. coalescing */

const PATTERNS = {
  unit: { label: 'a[i]', vec: 'vle32.v (unit stride)' },
  shift: { label: 'a[i+1]', vec: 'vle32.v (unit stride, misaligned)' },
  stride: { label: 'a[s*i]', vec: 'vlse32.v (strided)' },
  reverse: { label: 'a[w-1-i]', vec: 'vlse32.v (stride -4)' },
  broadcast: { label: 'a[0]', vec: 'flw + vfmv.v.f (scalar broadcast)' },
  random: { label: 'a[idx[i]]', vec: 'vluxei32.v (indexed gather)' },
};

function coalesce({ w, seg, pattern = 'unit', stride = 2, seed = 1 }) {
  let addrs, need = w + 1;
  if (pattern === 'unit') addrs = Array.from({ length: w }, (_, i) => i);
  else if (pattern === 'shift') addrs = Array.from({ length: w }, (_, i) => i + 1);
  else if (pattern === 'stride') { addrs = Array.from({ length: w }, (_, i) => i * stride); need = w * stride; }
  else if (pattern === 'reverse') addrs = Array.from({ length: w }, (_, i) => w - 1 - i);
  else if (pattern === 'broadcast') addrs = Array(w).fill(0);
  else {
    need = Math.min(256, Math.max(64, 4 * w));
    addrs = shuffle(Array.from({ length: need }, (_, i) => i), rng(seed)).slice(0, w);
  }
  const memSize = Math.ceil(Math.max(need, 64) / seg) * seg;
  const segOf = addrs.map(a => Math.floor(a / seg));
  const segs = Array.from(new Set(segOf)).sort((a, b) => a - b);
  const transactions = segs.map(s => ({ seg: s, lanes: segOf.map((v, j) => (v === s ? j : -1)).filter(j => j >= 0) }));
  const distinct = new Set(addrs).size;
  return {
    w, seg, pattern, stride, addrs, memSize, segOf, transactions, distinct, vec: PATTERNS[pattern].vec,
    T: transactions.length, ideal: Math.ceil(distinct / seg), efficiency: distinct / (transactions.length * seg),
  };
}

const api = { rng, axpy, yAt, diverge, latency, coalesce, LISTING, PATTERNS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.DP = api;
})(typeof window !== 'undefined' ? window : globalThis);
