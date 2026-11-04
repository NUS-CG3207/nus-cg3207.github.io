/* Systolic array simulator behind systolic.html. No DOM access: the page and
 * the node test suite both load this file. run() simulates a whole matrix multiply
 * on an n x n array up front and returns one frame per cycle (frames[t] is the
 * state after t cycles; frames[0] is the initial state).
 *   'os'  output stationary (slide 53): A flows right, B flows down, each PE
 *         accumulates one element of C = A (n x len) . B (len x n).
 *   'ws'  weight stationary (TPU): weights W (n x n) are loaded first and stay put;
 *         rows of A (len x n) flow right and partial sums flow down, so C = A . W
 *         emerges from the bottom edge.                                          */
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

const grid = (n, f) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(i, j)));
const matmul = (X, Y) => X.map(row => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)));

function run({ mode = 'os', n, len, seed = 1 }) {
  const r = rng(seed);
  const val = () => 1 + Math.floor(r() * 4);
  const mat = (R, C) => Array.from({ length: R }, () => Array.from({ length: C }, val));
  const os = mode === 'os';
  const A = os ? mat(n, len) : mat(len, n);
  const B = os ? mat(len, n) : null;
  const W = os ? null : mat(n, n);
  const expected = matmul(A, os ? B : W);
  const macs = n * n * len;

  const frames = [];
  let busy = 0;
  const snap = (phase, pe, qL, qT, out, extra = {}) => frames.push({ t: frames.length, phase, pe, qL, qT, out, macs: busy, ...extra });
  const blank = () => ({ a: null, ak: null, b: null, bk: null, ps: null, pk: null, w: null, acc: 0, active: false, final: false });

  if (os) {
    const T = len + 2 * (n - 1);
    const qL = t => A.map((row, i) => { const q = []; for (let c = t; c < len + i; c++) q.push(c - i >= 0 ? row[c - i] : 0); return q; });
    const qT = t => Array.from({ length: n }, (_, j) => { const q = []; for (let c = t; c < len + j; c++) q.push(c - j >= 0 ? B[c - j][j] : 0); return q; });
    let aR = grid(n, () => null), bR = grid(n, () => null);
    const acc = grid(n, () => 0);
    snap('compute', grid(n, blank), qL(0), qT(0), null);
    for (let t = 0; t < T; t++) {
      const nA = grid(n, () => null), nB = grid(n, () => null);
      const pe = grid(n, (i, j) => {
        const ca = t - i, cb = t - j;
        const a = j === 0 ? (ca >= 0 && ca < len ? { v: A[i][ca], k: ca } : null) : aR[i][j - 1];
        const b = i === 0 ? (cb >= 0 && cb < len ? { v: B[cb][j], k: cb } : null) : bR[i - 1][j];
        nA[i][j] = a; nB[i][j] = b;
        const active = !!(a && b);
        if (active) { acc[i][j] += a.v * b.v; busy++; }
        return { ...blank(), a: a && a.v, ak: a && a.k, b: b && b.v, bk: b && b.k, acc: acc[i][j], active, final: t + 1 >= i + j + len };
      });
      aR = nA; bR = nB;
      snap('compute', pe, qL(t + 1), qT(t + 1), null);
    }
  } else {
    const Wr = grid(n, () => null);
    const emptyQ = () => Array.from({ length: n }, () => []);
    const qLc = c => Array.from({ length: n }, (_, i) => { const q = []; for (let t = c; t < len + i; t++) q.push(t - i >= 0 ? A[t - i][i] : 0); return q; });
    const wFrame = l => grid(n, (i, j) => ({ ...blank(), w: Wr[i][j] }));
    snap('load', wFrame(0), emptyQ(), Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, l) => W[n - 1 - l][j])), null);
    for (let l = 0; l < n; l++) {
      for (let i = n - 1; i >= 1; i--) Wr[i] = Wr[i - 1].slice();
      Wr[0] = W[n - 1 - l].slice();
      snap('load', wFrame(l), emptyQ(), Array.from({ length: n }, (_, j) => { const q = []; for (let m = l + 1; m < n; m++) q.push(W[n - 1 - m][j]); return q; }), null);
    }
    const T = len + 2 * (n - 1);
    let aR = grid(n, () => null), pR = grid(n, () => null);
    const C = Array.from({ length: len }, () => Array(n).fill(null));
    for (let c = 0; c < T; c++) {
      const nA = grid(n, () => null), nP = grid(n, () => null);
      const pe = grid(n, (i, j) => {
        const cr = c - i;
        const a = j === 0 ? (cr >= 0 && cr < len ? { v: A[cr][i], k: cr } : null) : aR[i][j - 1];
        nA[i][j] = a;
        let ps = null;
        if (a) {
          const up = i === 0 ? { v: 0, k: a.k } : pR[i - 1][j];
          ps = { v: (up ? up.v : NaN) + a.v * W[i][j], k: a.k, upk: up ? up.k : null };
          busy++;
          if (i === n - 1) C[a.k][j] = ps.v;
        }
        nP[i][j] = ps;
        return { ...blank(), a: a && a.v, ak: a && a.k, ps: ps && ps.v, pk: ps && ps.k, upk: ps && ps.upk, w: W[i][j], active: !!a };
      });
      aR = nA; pR = nP;
      snap('compute', pe, qLc(c + 1), emptyQ(), C.map(row => row.slice()));
    }
  }
  const cycles = frames.length - 1;
  const last = frames[cycles];
  const result = os ? last.pe.map(row => row.map(p => p.acc)) : last.out;
  return {
    mode, n, len, A, B, W, expected, frames, cycles, loadCycles: os ? 0 : n, macs, result,
    util: macs / (n * n * cycles),
    // Operands fetched from the buffer: the array reads each input once at its edge,
    // a conventional MAC unit reads both operands for every multiply.
    reads: os ? 2 * n * len : n * n + n * len, naiveReads: 2 * macs,
    speedup: macs / cycles,
  };
}

const api = { run, matmul, rng };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.SA = api;
})(typeof window !== 'undefined' ? window : globalThis);
