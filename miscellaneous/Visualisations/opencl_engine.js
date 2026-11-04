/* OpenCL execution trace generator. No DOM access: the page and the node test
 * suite both load this file. build(cfg) returns every step of one host-program
 * run; stateAt(k) reconstructs the full machine state after step k. */
(function (root) {
'use strict';

const DEVICE_MAX_WG = 256;
const CHECKPOINT_EVERY = 32;

// Work-item states
const WI = { NONE: 0, PENDING: 1, RESIDENT: 2, BARRIER: 3, DONE: 4 };
// Work-group states
const WG = { PENDING: 0, RUNNING: 1, DONE: 2 };

const PHASES = [
  'Program start',
  'Discover and initialise platforms',
  'Discover and initialise devices',
  'Create the context',
  'Create a command queue',
  'Create device buffers',
  'Write host data to device buffers (global memory)',
  'Create and compile the program',
  'Create the kernel',
  'Set the kernel arguments',
  'Configure the work-item structure',
  'Enqueue the kernel for execution',
  'Read the output buffer back to the host',
  'Release the OpenCL resources',
];

const COST_NOTE = {
  alu: 'Private memory only (registers): fastest.',
  local: 'Local memory: on-chip, shared by the work-group.',
  global: 'Global memory: off-chip, highest latency.',
};

function fmt(v) {
  if (v === undefined || Number.isNaN(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function range(n) { return Array.from({ length: n }, (_, i) => i); }
function pow2Upto(n, from) { const r = []; for (let v = from; v <= n; v *= 2) r.push(v); return r; }

/* ---------- Test image for the 2D kernel ---------- */
function testImage(w, h) {
  const img = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 20 + Math.round(90 * x / (w - 1));           // dark-to-mid gradient
      const dx = x - w * 0.34, dy = y - h * 0.36;
      if (dx * dx + dy * dy < (w * 0.22) * (w * 0.22)) v = 235;  // bright disc, upper left
      if (y >= Math.round(h * 0.72) && y < Math.round(h * 0.84) && x >= Math.round(w * 0.45)) v = 250; // bar, lower right
      img[y * w + x] = v;
    }
  }
  return img;
}

/* ---------- Host-code line builder ---------- */
function codeBuilder() {
  const lines = [];
  const L = (text, ...tags) => { lines.push({ text, tags }); };
  return { lines, L };
}

function commonHostHead(L, kname) {
  L('    cl_int status;');
  L('    cl_platform_id platform;');
  L('    status = clGetPlatformIDs(1, &platform, NULL);', 'platform');
  L('    cl_device_id device;');
  L('    status = clGetDeviceIDs(platform, CL_DEVICE_TYPE_DEFAULT, 1, &device, NULL);', 'device');
  L('');
  L('    cl_context context = clCreateContext(NULL, 1, &device, NULL, NULL, &status);', 'context');
  L('    cl_command_queue queue = clCreateCommandQueue(context, device, 0, &status);', 'queue');
  L('');
  L('    // src, src_size: kernel.cl read with fopen()/fread()');
  L('    cl_program program = clCreateProgramWithSource(context, 1,', 'program');
  L('                             (const char**)&src, &src_size, &status);', 'program');
  L('    status = clBuildProgram(program, 1, &device, NULL, NULL, NULL);', 'build');
  L(`    cl_kernel kernel = clCreateKernel(program, "${kname}", &status);`, 'kernel');
  L('');
}

/* ---------- Kernels ---------- */
const KERNELS = {
  vec_add: {
    id: 'vec_add', title: 'vec_add (1D)', dims: 1, elem: 'float', bytes: 4,
    globals: [16, 32, 64, 128, 256], defGlobal: [64, 1], defLocal: [8, 1],
    minLocal: 1, usesLocal: false,
    priv: ['id', 'a', 'b', 'c'],
    kernelLines: [
      ['__kernel void vec_add(__global const float* A,'],
      ['                      __global const float* B,'],
      ['                      __global float* C) {'],
      ['    int id = get_global_id(0);', 'id'],
      ['    C[id] = A[id] + B[id];', 'body'],
      ['}'],
    ],
    hostArrays: g => [
      { name: 'A', n: g.N, init: i => i },
      { name: 'B', n: g.N, init: i => 2 * i },
      { name: 'C', n: g.N },
    ],
    buffers: g => [
      { name: 'bufA', host: 'A', n: g.N, flag: 'CL_MEM_READ_ONLY', write: true },
      { name: 'bufB', host: 'B', n: g.N, flag: 'CL_MEM_READ_ONLY', write: true },
      { name: 'bufC', host: 'C', n: g.N, flag: 'CL_MEM_WRITE_ONLY', read: true },
    ],
    args: () => [{ label: 'bufA' }, { label: 'bufB' }, { label: 'bufC' }],
    hostCode(g) {
      const { lines, L } = codeBuilder();
      L('#define CL_TARGET_OPENCL_VERSION 120');
      L('#include <CL/cl.h>');
      L('#include <stdlib.h>');
      L('');
      L('int main() {');
      L(`    const size_t N = ${g.N};`, 'alloc');
      L('    float *A = (float*)malloc(sizeof(float) * N);', 'alloc');
      L('    float *B = (float*)malloc(sizeof(float) * N);', 'alloc');
      L('    float *C = (float*)malloc(sizeof(float) * N);', 'alloc');
      L('    for (size_t i = 0; i < N; i++) {', 'alloc');
      L('        A[i] = i;', 'alloc');
      L('        B[i] = 2 * i;', 'alloc');
      L('    }', 'alloc');
      L('');
      commonHostHead(L, 'vec_add');
      L('    cl_mem bufA = clCreateBuffer(context, CL_MEM_READ_ONLY,  sizeof(float)*N, NULL, &status);', 'buf:bufA');
      L('    cl_mem bufB = clCreateBuffer(context, CL_MEM_READ_ONLY,  sizeof(float)*N, NULL, &status);', 'buf:bufB');
      L('    cl_mem bufC = clCreateBuffer(context, CL_MEM_WRITE_ONLY, sizeof(float)*N, NULL, &status);', 'buf:bufC');
      L('');
      L('    // Host -> device transfers (blocking)');
      L('    clEnqueueWriteBuffer(queue, bufA, CL_TRUE, 0, sizeof(float)*N, A, 0, NULL, NULL);', 'write:bufA');
      L('    clEnqueueWriteBuffer(queue, bufB, CL_TRUE, 0, sizeof(float)*N, B, 0, NULL, NULL);', 'write:bufB');
      L('');
      L('    clSetKernelArg(kernel, 0, sizeof(cl_mem), &bufA);', 'arg:0');
      L('    clSetKernelArg(kernel, 1, sizeof(cl_mem), &bufB);', 'arg:1');
      L('    clSetKernelArg(kernel, 2, sizeof(cl_mem), &bufC);', 'arg:2');
      L('');
      L('    size_t globalSize = N;', 'gsize');
      L(`    size_t localSize = ${g.L};`, 'lsize');
      L('    status = clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &globalSize, &localSize,', 'ndrange');
      L('                                    0, NULL, NULL);', 'ndrange');
      L('');
      L('    // Device -> host transfer (blocking)');
      L('    clEnqueueReadBuffer(queue, bufC, CL_TRUE, 0, sizeof(float)*N, C, 0, NULL, NULL);', 'read:bufC');
      L('');
      L('    clReleaseKernel(kernel); clReleaseProgram(program);', 'release');
      L('    clReleaseMemObject(bufA); clReleaseMemObject(bufB); clReleaseMemObject(bufC);', 'release');
      L('    clReleaseCommandQueue(queue); clReleaseContext(context);', 'release');
      L('    free(A); free(B); free(C);');
      L('    return 0;');
      L('}');
      return lines;
    },
    segments() {
      return [{
        stmts: [
          { tag: 'id', cost: 'alu', label: 'id = get_global_id(0)',
            run: (w, io) => { io.set('id', w.gid[0]); return 'id=' + w.gid[0]; } },
          { tag: 'body', cost: 'global', label: 'load A[id] into private a',
            run: (w, io) => { const v = io.gread('bufA', io.get('id')); io.set('a', v); return 'a=' + fmt(v); } },
          { tag: 'body', cost: 'global', label: 'load B[id] into private b',
            run: (w, io) => { const v = io.gread('bufB', io.get('id')); io.set('b', v); return 'b=' + fmt(v); } },
          { tag: 'body', cost: 'alu', label: 'c = a + b',
            run: (w, io) => { const v = io.get('a') + io.get('b'); io.set('c', v); io.alu(); return 'c=' + fmt(v); } },
          { tag: 'body', cost: 'global', label: 'store c to C[id]',
            run: (w, io) => { io.gwrite('bufC', io.get('id'), io.get('c')); return 'C[' + io.get('id') + ']'; } },
        ],
      }];
    },
    expected(g) { return { C: range(g.N).map(i => 3 * i) }; },
  },

  invert: {
    id: 'invert', title: 'invert (2D image)', dims: 2, elem: 'uchar', bytes: 1,
    globals: [[16, 16], [32, 32]], defGlobal: [16, 16], defLocal: [4, 4],
    minLocal: 1, usesLocal: false, pixel: true,
    priv: ['x', 'y', 'i', 'p'],
    kernelLines: [
      ['__kernel void invert(__global const uchar* in,'],
      ['                     __global uchar* out,'],
      ['                     const int width) {'],
      ['    int x = get_global_id(0);', 'x'],
      ['    int y = get_global_id(1);', 'y'],
      ['    int i = y * width + x;', 'i'],
      ['    uchar p = in[i];', 'load'],
      ['    out[i] = 255 - p;', 'store'],
      ['}'],
    ],
    hostArrays: g => {
      const img = testImage(g.gsz[0], g.gsz[1]);
      return [{ name: 'img', n: g.N, init: i => img[i] }, { name: 'out', n: g.N }];
    },
    buffers: g => [
      { name: 'bufIn', host: 'img', n: g.N, flag: 'CL_MEM_READ_ONLY', write: true },
      { name: 'bufOut', host: 'out', n: g.N, flag: 'CL_MEM_WRITE_ONLY', read: true },
    ],
    args: g => [{ label: 'bufIn' }, { label: 'bufOut' }, { label: 'width = ' + g.gsz[0] }],
    hostCode(g) {
      const { lines, L } = codeBuilder();
      L('#define CL_TARGET_OPENCL_VERSION 120');
      L('#include <CL/cl.h>');
      L('#include <stdlib.h>');
      L('');
      L('int main() {');
      L(`    const int W = ${g.gsz[0]}, H = ${g.gsz[1]};`, 'alloc');
      L('    const size_t bytes = sizeof(unsigned char) * W * H;', 'alloc');
      L('    unsigned char *img = malloc(bytes);', 'alloc');
      L('    unsigned char *out = malloc(bytes);', 'alloc');
      L('    make_test_image(img, W, H);   // gradient, disc and bar', 'alloc');
      L('');
      commonHostHead(L, 'invert');
      L('    cl_mem bufIn  = clCreateBuffer(context, CL_MEM_READ_ONLY,  bytes, NULL, &status);', 'buf:bufIn');
      L('    cl_mem bufOut = clCreateBuffer(context, CL_MEM_WRITE_ONLY, bytes, NULL, &status);', 'buf:bufOut');
      L('');
      L('    // Host -> device transfer (blocking)');
      L('    clEnqueueWriteBuffer(queue, bufIn, CL_TRUE, 0, bytes, img, 0, NULL, NULL);', 'write:bufIn');
      L('');
      L('    clSetKernelArg(kernel, 0, sizeof(cl_mem), &bufIn);', 'arg:0');
      L('    clSetKernelArg(kernel, 1, sizeof(cl_mem), &bufOut);', 'arg:1');
      L('    clSetKernelArg(kernel, 2, sizeof(int), &W);', 'arg:2');
      L('');
      L('    size_t globalSize[2] = { W, H };', 'gsize');
      L(`    size_t localSize[2]  = { ${g.lsz[0]}, ${g.lsz[1]} };`, 'lsize');
      L('    status = clEnqueueNDRangeKernel(queue, kernel, 2, NULL, globalSize, localSize,', 'ndrange');
      L('                                    0, NULL, NULL);', 'ndrange');
      L('');
      L('    // Device -> host transfer (blocking)');
      L('    clEnqueueReadBuffer(queue, bufOut, CL_TRUE, 0, bytes, out, 0, NULL, NULL);', 'read:bufOut');
      L('');
      L('    clReleaseKernel(kernel); clReleaseProgram(program);', 'release');
      L('    clReleaseMemObject(bufIn); clReleaseMemObject(bufOut);', 'release');
      L('    clReleaseCommandQueue(queue); clReleaseContext(context);', 'release');
      L('    free(img); free(out);');
      L('    return 0;');
      L('}');
      return lines;
    },
    segments(g) {
      const W = g.gsz[0];
      return [{
        stmts: [
          { tag: 'x', cost: 'alu', label: 'x = get_global_id(0)',
            run: (w, io) => { io.set('x', w.gid[0]); return 'x=' + w.gid[0]; } },
          { tag: 'y', cost: 'alu', label: 'y = get_global_id(1)',
            run: (w, io) => { io.set('y', w.gid[1]); return 'y=' + w.gid[1]; } },
          { tag: 'i', cost: 'alu', label: 'i = y * width + x',
            run: (w, io) => { const v = io.get('y') * W + io.get('x'); io.set('i', v); io.alu(2); return 'i=' + v; } },
          { tag: 'load', cost: 'global', label: 'load in[i] into private p',
            run: (w, io) => { const v = io.gread('bufIn', io.get('i')); io.set('p', v); return 'p=' + v; } },
          { tag: 'store', cost: 'global', label: 'out[i] = 255 - p',
            run: (w, io) => { const v = 255 - io.get('p'); io.alu(); io.gwrite('bufOut', io.get('i'), v); return 'out=' + v; } },
        ],
      }];
    },
    expected(g) { const img = testImage(g.gsz[0], g.gsz[1]); return { out: img.map(v => 255 - v) }; },
  },

  reduce: {
    id: 'reduce', title: 'reduce_sum (local memory)', dims: 1, elem: 'float', bytes: 4,
    globals: [16, 32, 64, 128, 256], defGlobal: [32, 1], defLocal: [8, 1],
    minLocal: 2, usesLocal: true,
    priv: ['gid', 'lid', 's'],
    kernelLines: [
      ['__kernel void reduce_sum(__global const float* in,'],
      ['                         __global float* partial,'],
      ['                         __local float* scratch) {'],
      ['    int gid = get_global_id(0);', 'gid'],
      ['    int lid = get_local_id(0);', 'lid'],
      ['    scratch[lid] = in[gid];', 'load'],
      ['    barrier(CLK_LOCAL_MEM_FENCE);', 'bar0'],
      ['    for (int s = get_local_size(0) / 2; s > 0; s >>= 1) {', 'loop'],
      ['        if (lid < s)', 'add'],
      ['            scratch[lid] += scratch[lid + s];', 'add'],
      ['        barrier(CLK_LOCAL_MEM_FENCE);', 'bar1'],
      ['    }'],
      ['    if (lid == 0)', 'out'],
      ['        partial[get_group_id(0)] = scratch[0];', 'out'],
      ['}'],
    ],
    hostArrays: g => [
      { name: 'in', n: g.N, init: i => (i * 7 + 3) % 10 },
      { name: 'partial', n: g.G },
      { name: 'sum', n: 1 },
    ],
    buffers: g => [
      { name: 'bufIn', host: 'in', n: g.N, flag: 'CL_MEM_READ_ONLY', write: true },
      { name: 'bufPartial', host: 'partial', n: g.G, flag: 'CL_MEM_WRITE_ONLY', read: true, perGroup: true },
    ],
    args: g => [{ label: 'bufIn' }, { label: 'bufPartial' }, { label: `__local ${g.L * 4} B` }],
    hostCode(g) {
      const { lines, L } = codeBuilder();
      L('#define CL_TARGET_OPENCL_VERSION 120');
      L('#include <CL/cl.h>');
      L('#include <stdlib.h>');
      L('');
      L('int main() {');
      L(`    const size_t N = ${g.N}, localSize = ${g.L};   // a power of two`, 'alloc', 'lsize');
      L('    const size_t groups = N / localSize;', 'alloc');
      L('    float *in      = (float*)malloc(sizeof(float) * N);', 'alloc');
      L('    float *partial = (float*)malloc(sizeof(float) * groups);', 'alloc');
      L('    for (size_t i = 0; i < N; i++)', 'alloc');
      L('        in[i] = (i * 7 + 3) % 10;', 'alloc');
      L('');
      commonHostHead(L, 'reduce_sum');
      L('    cl_mem bufIn      = clCreateBuffer(context, CL_MEM_READ_ONLY,', 'buf:bufIn');
      L('                                       sizeof(float)*N, NULL, &status);', 'buf:bufIn');
      L('    cl_mem bufPartial = clCreateBuffer(context, CL_MEM_WRITE_ONLY,', 'buf:bufPartial');
      L('                                       sizeof(float)*groups, NULL, &status);', 'buf:bufPartial');
      L('');
      L('    // Host -> device transfer (blocking)');
      L('    clEnqueueWriteBuffer(queue, bufIn, CL_TRUE, 0, sizeof(float)*N, in, 0, NULL, NULL);', 'write:bufIn');
      L('');
      L('    clSetKernelArg(kernel, 0, sizeof(cl_mem), &bufIn);', 'arg:0');
      L('    clSetKernelArg(kernel, 1, sizeof(cl_mem), &bufPartial);', 'arg:1');
      L('    clSetKernelArg(kernel, 2, sizeof(float) * localSize, NULL);   // __local scratch', 'arg:2');
      L('');
      L('    size_t globalSize = N;', 'gsize');
      L('    status = clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &globalSize, &localSize,', 'ndrange');
      L('                                    0, NULL, NULL);', 'ndrange');
      L('');
      L('    // Device -> host transfer (blocking)');
      L('    clEnqueueReadBuffer(queue, bufPartial, CL_TRUE, 0, sizeof(float)*groups, partial,', 'read:bufPartial');
      L('                        0, NULL, NULL);', 'read:bufPartial');
      L('    float sum = 0;', 'hostsum');
      L('    for (size_t g = 0; g < groups; g++)', 'hostsum');
      L('        sum += partial[g];', 'hostsum');
      L('');
      L('    clReleaseKernel(kernel); clReleaseProgram(program);', 'release');
      L('    clReleaseMemObject(bufIn); clReleaseMemObject(bufPartial);', 'release');
      L('    clReleaseCommandQueue(queue); clReleaseContext(context);', 'release');
      L('    free(in); free(partial);');
      L('    return 0;');
      L('}');
      return lines;
    },
    segments(g) {
      const segs = [{
        stmts: [
          { tag: 'gid', cost: 'alu', label: 'gid = get_global_id(0)',
            run: (w, io) => { io.set('gid', w.gid[0]); return 'gid=' + w.gid[0]; } },
          { tag: 'lid', cost: 'alu', label: 'lid = get_local_id(0)',
            run: (w, io) => { io.set('lid', w.lid[0]); return 'lid=' + w.lid[0]; } },
          { tag: 'load', cost: 'global', label: 'scratch[lid] = in[gid]',
            run: (w, io) => { const v = io.gread('bufIn', io.get('gid')); io.lwrite(io.get('lid'), v); return 's[' + io.get('lid') + ']=' + fmt(v); } },
        ],
        barrier: 'bar0',
      }];
      for (let s = g.L / 2; s > 0; s >>= 1) {
        segs.push({
          stmts: [{
            tag: 'add', cost: 'local', label: `s = ${s}: if (lid < ${s}) scratch[lid] += scratch[lid + ${s}]`,
            pre: (w, io) => io.set('s', s),
            active: (w, io) => io.get('lid') < s,
            run: (w, io) => {
              const lid = io.get('lid');
              const a = io.lread(lid), b = io.lread(lid + s);
              io.alu();
              io.lwrite(lid, a + b);
              return 's[' + lid + ']=' + fmt(a + b);
            },
          }],
          barrier: 'bar1',
        });
      }
      segs.push({
        stmts: [{
          tag: 'out', cost: 'global', label: 'if (lid == 0) partial[group] = scratch[0]',
          active: (w, io) => io.get('lid') === 0,
          run: (w, io) => { const v = io.lread(0); io.gwrite('bufPartial', w.g, v); return 'p[' + w.g + ']=' + fmt(v); },
        }],
      });
      return segs;
    },
    expected(g) {
      const inp = range(g.N).map(i => (i * 7 + 3) % 10);
      const partial = range(g.G).map(k => inp.slice(k * g.L, (k + 1) * g.L).reduce((a, b) => a + b, 0));
      return { partial, sum: [inp.reduce((a, b) => a + b, 0)] };
    },
  },
};

/* ---------- Size options (only valid combinations are offered) ---------- */
function globalOptions(kid) {
  const K = KERNELS[kid];
  return K.globals.map(v => K.dims === 1
    ? { key: String(v), gsz: [v, 1], label: String(v) }
    : { key: v.join('x'), gsz: v.slice(), label: v.join(' × ') });
}

function localOptions(kid, gsz) {
  const K = KERNELS[kid];
  if (K.dims === 1) {
    return pow2Upto(Math.min(gsz[0], DEVICE_MAX_WG), K.minLocal)
      .filter(l => gsz[0] % l === 0)
      .map(l => ({ key: String(l), lsz: [l, 1], label: String(l) }));
  }
  const out = [];
  for (const ly of pow2Upto(gsz[1], 1)) {
    for (const lx of pow2Upto(gsz[0], 1)) {
      if (lx * ly <= DEVICE_MAX_WG && gsz[0] % lx === 0 && gsz[1] % ly === 0) {
        out.push({ key: lx + 'x' + ly, lsz: [lx, ly], label: lx + ' × ' + ly });
      }
    }
  }
  return out.sort((a, b) => a.lsz[0] * a.lsz[1] - b.lsz[0] * b.lsz[1] || a.lsz[1] - b.lsz[1]);
}

function geometry(cfg) {
  const K = KERNELS[cfg.kernel];
  const gsz = cfg.gsz.slice(), lsz = cfg.lsz.slice();
  const ng = [gsz[0] / lsz[0], gsz[1] / lsz[1]];
  const N = gsz[0] * gsz[1], L = lsz[0] * lsz[1], G = ng[0] * ng[1];
  const C = cfg.cus, P = cfg.pes;
  return { K, dims: K.dims, gsz, lsz, ng, N, L, G, C, P, waves: Math.ceil(L / P), rounds: Math.ceil(G / C) };
}

function validate(cfg) {
  const K = KERNELS[cfg.kernel];
  if (!K) return 'unknown kernel';
  const g = globalOptions(cfg.kernel).find(o => o.gsz[0] === cfg.gsz[0] && o.gsz[1] === cfg.gsz[1]);
  if (!g) return 'global size not offered';
  if (!localOptions(cfg.kernel, cfg.gsz).some(o => o.lsz[0] === cfg.lsz[0] && o.lsz[1] === cfg.lsz[1])) return 'local size not valid';
  if (!(cfg.cus >= 1 && cfg.pes >= 1)) return 'bad device';
  return null;
}

/* Work-item identity for linear local id `ll` of flat group index `g`. */
function workItem(geo, g, ll) {
  const grp = [g % geo.ng[0], Math.floor(g / geo.ng[0])];
  const lid = [ll % geo.lsz[0], Math.floor(ll / geo.lsz[0])];
  const gid = [grp[0] * geo.lsz[0] + lid[0], grp[1] * geo.lsz[1] + lid[1]];
  return { g, ll, grp, lid, gid, flat: gid[1] * geo.gsz[0] + gid[0] };
}

/* Inverse of workItem: flat global index -> identity. */
function workItemOf(geo, flat) {
  const gid = [flat % geo.gsz[0], Math.floor(flat / geo.gsz[0])];
  const grp = [Math.floor(gid[0] / geo.lsz[0]), Math.floor(gid[1] / geo.lsz[1])];
  const lid = [gid[0] - grp[0] * geo.lsz[0], gid[1] - grp[1] * geo.lsz[1]];
  const g = grp[1] * geo.ng[0] + grp[0];
  const ll = lid[1] * geo.lsz[0] + lid[0];
  return { g, ll, grp, lid, gid, flat, cu: g % geo.C, round: Math.floor(g / geo.C), wave: Math.floor(ll / geo.P), pe: ll % geo.P };
}

/* ---------- State ---------- */
function blankState(geo) {
  return {
    host: {}, global: {},
    local: new Array(geo.C).fill(null),
    priv: new Float64Array(geo.N * geo.K.priv.length).fill(NaN),
    wi: new Uint8Array(geo.N), wg: new Uint8Array(geo.G), cuWG: new Int32Array(geo.C).fill(-1),
    obj: { platform: 0, device: 0, context: 0, queue: 0, program: 0, kernel: 0, nd: 0, released: 0 },
    args: [], q: [], hostStatus: 'running', hostBlocked: false,
    cnt: { pcieHD: 0, pcieDH: 0, gR: 0, gW: 0, lR: 0, lW: 0, alu: 0, wgDone: 0 },
  };
}

function cloneMem(m) { return m && { data: m.data.slice(), init: m.init.slice() }; }
function cloneState(s) {
  const host = {}, global = {};
  for (const k in s.host) host[k] = cloneMem(s.host[k]);
  for (const k in s.global) global[k] = cloneMem(s.global[k]);
  return {
    host, global, local: s.local.map(cloneMem), priv: s.priv.slice(),
    wi: s.wi.slice(), wg: s.wg.slice(), cuWG: s.cuWG.slice(),
    obj: Object.assign({}, s.obj), args: s.args.slice(), q: s.q.map(e => Object.assign({}, e)),
    hostStatus: s.hostStatus, hostBlocked: s.hostBlocked, cnt: Object.assign({}, s.cnt),
  };
}
function newMem(n) { return { data: new Float64Array(n), init: new Uint8Array(n) }; }

function applyOp(S, o) {
  switch (o[0]) {
    case 'halloc': { const m = newMem(o[2]); if (o[3]) { m.data.set(o[3]); m.init.fill(1); } S.host[o[1]] = m; break; }
    case 'hset': S.host[o[1]].data[o[2]] = o[3]; S.host[o[1]].init[o[2]] = 1; break;
    case 'galloc': S.global[o[1]] = newMem(o[2]); break;
    case 'gfree': delete S.global[o[1]]; break;
    case 'copyHG': { const h = S.host[o[1]], d = S.global[o[2]]; d.data.set(h.data); d.init.set(h.init); break; }
    case 'copyGH': { const d = S.global[o[1]], h = S.host[o[2]]; h.data.set(d.data); h.init.set(d.init); break; }
    case 'gset': S.global[o[1]].data[o[2]] = o[3]; S.global[o[1]].init[o[2]] = 1; break;
    case 'lalloc': S.local[o[1]] = newMem(o[2]); break;
    case 'lfree': S.local[o[1]] = null; break;
    case 'lset': S.local[o[1]].data[o[2]] = o[3]; S.local[o[1]].init[o[2]] = 1; break;
    case 'pset': S.priv[o[1]] = o[2]; break;
    case 'wi': S.wi[o[1]] = o[2]; break;
    case 'wiAll': S.wi.fill(o[1]); break;
    case 'wg': S.wg[o[1]] = o[2]; break;
    case 'cu': S.cuWG[o[1]] = o[2]; break;
    case 'obj': S.obj[o[1]] = o[2]; break;
    case 'arg': S.args[o[1]] = o[2]; break;
    case 'qpush': S.q.push({ label: o[1], state: 'queued' }); break;
    case 'qrun': S.q[0].state = 'running'; break;
    case 'qshift': S.q.shift(); break;
    case 'host': S.hostStatus = o[1]; S.hostBlocked = !!o[2]; break;
    case 'cnt': S.cnt[o[1]] += o[2]; break;
    default: throw new Error('bad op ' + o[0]);
  }
}

/* ---------- Trace builder ---------- */
function build(cfg) {
  const err = validate(cfg);
  if (err) throw new Error(err);
  const geo = geometry(cfg);
  const K = geo.K;
  const V = K.priv.length;
  const varIdx = Object.fromEntries(K.priv.map((v, i) => [v, i]));
  const hostLines = K.hostCode(geo);
  const sigEnd = K.kernelLines.findIndex(([t]) => t.trimEnd().endsWith('{'));
  const kernelLines = K.kernelLines.map(([text, ...tags], i) => ({ text, tags: i <= sigEnd ? tags.concat('sig') : tags }));
  const hostArrays = K.hostArrays(geo);
  const buffers = K.buffers(geo);
  const args = K.args(geo);
  const bytes = K.bytes;

  const S = blankState(geo);
  const steps = [];
  const checkpoints = [];
  let cur = null;

  function begin(info) {
    cur = Object.assign({
      phase: 0, chapter: '', title: '', detail: '', host: [], hostMode: 'cur', kern: [], cost: 'host',
      ops: [], flows: [], reads: [], writes: [], lanes: null, cus: null,
    }, info);
  }
  function op(o) { applyOp(S, o); cur.ops.push(o); }
  function end() {
    cur.index = steps.length;
    steps.push(cur);
    if (cur.index % CHECKPOINT_EVERY === 0) checkpoints.push(cloneState(S));
    cur = null;
  }
  const nb = n => n * bytes;

  /* 0: host allocates + initialises */
  begin({ phase: 0, chapter: 'start', host: ['alloc'], cost: 'host',
    title: 'Host allocates and initialises its data',
    detail: 'Input arrays are filled in host memory. The device cannot see host memory: the data must be copied into global memory before a kernel can use it.' });
  for (const a of hostArrays) {
    if (a.name === 'sum') continue;
    op(['halloc', a.name, a.n, a.init ? range(a.n).map(a.init) : null]);
  }
  end();

  begin({ phase: 1, chapter: 'platform', host: ['platform'], title: 'clGetPlatformIDs',
    detail: 'Select an OpenCL platform: one vendor\'s implementation of the runtime and compilers.' });
  op(['obj', 'platform', 1]); end();

  begin({ phase: 2, chapter: 'device', host: ['device'], title: 'clGetDeviceIDs',
    detail: `Find a device on the platform. This one has ${geo.C} compute unit${geo.C > 1 ? 's' : ''}, each with ${geo.P} processing element${geo.P > 1 ? 's' : ''}.` });
  op(['obj', 'device', 1]); end();

  begin({ phase: 3, chapter: 'context', host: ['context'], title: 'clCreateContext',
    detail: 'The context holds the device and every object created next: queue, program, kernel and buffers.' });
  op(['obj', 'context', 1]); end();

  begin({ phase: 4, chapter: 'queue', host: ['queue'], title: 'clCreateCommandQueue',
    detail: 'The host drives the device only through this queue. Commands leave it in order.' });
  op(['obj', 'queue', 1]); end();

  begin({ phase: 7, chapter: 'program', host: ['program'], title: 'clCreateProgramWithSource',
    detail: 'The kernel source text is handed to the runtime. Nothing is compiled yet.' });
  op(['obj', 'program', 1]); end();

  begin({ phase: 7, chapter: 'build', host: ['build'], title: 'clBuildProgram',
    detail: 'The device-specific compiler builds the program at run time.' });
  op(['obj', 'program', 2]); end();

  const kname = kernelLines[0].text.match(/void (\w+)/)[1];
  begin({ phase: 8, chapter: 'kernel', host: ['kernel'], kern: ['sig'], title: 'clCreateKernel',
    detail: `Pick the __kernel function ${kname} out of the built program.` });
  op(['obj', 'kernel', 1]); end();

  for (const b of buffers) {
    begin({ phase: 5, chapter: 'buf:' + b.name, host: ['buf:' + b.name], title: `clCreateBuffer: ${b.name}`,
      detail: `${b.n} × ${K.elem} (${nb(b.n)} bytes) reserved in global memory, ${b.flag}. Its contents are undefined until written.` });
    op(['galloc', b.name, b.n]); end();
  }

  for (const b of buffers.filter(b => b.write)) {
    begin({ phase: 6, chapter: 'write:' + b.name, host: ['write:' + b.name], cost: 'ctrl', title: `clEnqueueWriteBuffer: ${b.name}`,
      detail: 'The write is queued. CL_TRUE makes the call blocking: the host waits for it to finish.' });
    op(['qpush', 'write ' + b.name]);
    op(['host', 'blocked in clEnqueueWriteBuffer', true]);
    cur.flows.push({ from: { k: 'cpu' }, to: { k: 'queue' }, kind: 'ctrl' });
    end();

    begin({ phase: 6, chapter: 'write:' + b.name, host: ['write:' + b.name], hostMode: 'blocked', cost: 'pcie', title: `Transfer: ${b.host} → ${b.name}`,
      detail: `${nb(b.n)} bytes cross the host-device link (usually PCIe) into global memory.` });
    op(['qrun']);
    op(['copyHG', b.host, b.name]);
    op(['cnt', 'pcieHD', nb(b.n)]);
    op(['qshift']);
    op(['host', 'running', false]);
    for (let i = 0; i < b.n; i++) {
      cur.flows.push({ from: { k: 'h', arr: b.host, idx: i }, to: { k: 'g', buf: b.name, idx: i }, via: { k: 'link' }, kind: 'pcie' });
      cur.writes.push({ sp: 'g', buf: b.name, idx: i });
      cur.reads.push({ sp: 'h', arr: b.host, idx: i });
    }
    end();
  }

  args.forEach((a, i) => {
    const isLocal = K.usesLocal && i === args.length - 1;
    begin({ phase: 9, chapter: 'args', host: ['arg:' + i], title: `clSetKernelArg ${i}: ${a.label}`,
      detail: isLocal
        ? `A size with a NULL pointer: this reserves ${geo.L} floats of __local memory per work-group. There is no host data behind it.`
        : `Argument ${i} of ${kname} is bound. Nothing is copied now; the kernel receives it when it runs.` });
    op(['arg', i, a.label]);
    end();
  });

  const gtxt = geo.dims === 1 ? String(geo.N) : `${geo.gsz[0]} × ${geo.gsz[1]}`;
  const ltxt = geo.dims === 1 ? String(geo.L) : `${geo.lsz[0]} × ${geo.lsz[1]}`;
  begin({ phase: 10, chapter: 'gsize', host: ['gsize'], title: `Global size ${gtxt}`,
    detail: `The NDRange: one work-item per data element, ${geo.N} in total, all running the same kernel.` });
  op(['obj', 'nd', 1]); end();

  begin({ phase: 10, chapter: 'lsize', host: ['lsize'], title: `Local size ${ltxt}: ${geo.G} work-groups`,
    detail: `The NDRange is cut into ${geo.G} work-groups of ${geo.L} work-items. A work-group always runs on a single compute unit.` });
  op(['obj', 'nd', 2]); op(['wiAll', WI.PENDING]); end();

  begin({ phase: 11, chapter: 'enqueue', host: ['ndrange'], cost: 'ctrl', title: 'clEnqueueNDRangeKernel',
    detail: 'The kernel launch is queued. The call returns at once; the host carries on.' });
  op(['qpush', 'NDRange ' + kname]);
  cur.flows.push({ from: { k: 'cpu' }, to: { k: 'queue' }, kind: 'ctrl' });
  end();

  const outBufs = buffers.filter(b => b.read);
  for (const b of outBufs) {
    begin({ phase: 12, chapter: 'readq', host: ['read:' + b.name], cost: 'ctrl', title: `clEnqueueReadBuffer: ${b.name}`,
      detail: 'Queued behind the kernel. The queue is in-order and the read is blocking, so the host now waits for both.' });
    op(['qpush', 'read ' + b.name]);
    op(['host', 'blocked in clEnqueueReadBuffer', true]);
    cur.flows.push({ from: { k: 'cpu' }, to: { k: 'queue' }, kind: 'ctrl' });
    end();
  }
  const blockedHost = outBufs.map(b => 'read:' + b.name);

  /* ---- Kernel execution ---- */
  begin({ phase: 11, chapter: 'kstart', host: blockedHost, hostMode: 'blocked', kern: ['sig'], cost: 'ctrl',
    title: `Kernel starts: ${geo.G} work-group${geo.G > 1 ? 's' : ''} wait for compute units`,
    detail: `The device's scheduler hands work-groups to free compute units. ${geo.G} work-groups over ${geo.C} CU${geo.C > 1 ? 's' : ''}: ${geo.rounds} round${geo.rounds > 1 ? 's' : ''}.` });
  op(['qrun']); end();

  const segs = K.segments(geo);
  const ioFor = (lane, w) => ({
    get: name => S.priv[w.flat * V + varIdx[name]],
    set: (name, v) => op(['pset', w.flat * V + varIdx[name], v]),
    alu: (n = 1) => op(['cnt', 'alu', n]),
    gread: (buf, idx) => {
      const m = S.global[buf];
      if (!m.init[idx]) throw new Error(`read of uninitialised ${buf}[${idx}]`);
      cur.reads.push({ sp: 'g', buf, idx });
      cur.flows.push({ from: { k: 'g', buf, idx }, to: { k: 'pe', cu: lane.cu, pe: lane.pe }, kind: 'global', leg: 0 });
      op(['cnt', 'gR', bytes]);
      return m.data[idx];
    },
    gwrite: (buf, idx, v) => {
      op(['gset', buf, idx, v]);
      cur.writes.push({ sp: 'g', buf, idx });
      cur.flows.push({ from: { k: 'pe', cu: lane.cu, pe: lane.pe }, to: { k: 'g', buf, idx }, kind: 'global', leg: 1 });
      op(['cnt', 'gW', bytes]);
    },
    lread: idx => {
      const m = S.local[lane.cu];
      if (!m.init[idx]) throw new Error(`read of uninitialised local[${idx}] on CU${lane.cu}`);
      cur.reads.push({ sp: 'l', cu: lane.cu, idx });
      cur.flows.push({ from: { k: 'l', cu: lane.cu, idx }, to: { k: 'pe', cu: lane.cu, pe: lane.pe }, kind: 'local', leg: 0 });
      op(['cnt', 'lR', bytes]);
      return m.data[idx];
    },
    lwrite: (idx, v) => {
      op(['lset', lane.cu, idx, v]);
      cur.writes.push({ sp: 'l', cu: lane.cu, idx });
      cur.flows.push({ from: { k: 'pe', cu: lane.cu, pe: lane.pe }, to: { k: 'l', cu: lane.cu, idx }, kind: 'local', leg: 1 });
      op(['cnt', 'lW', bytes]);
    },
  });

  const cuRange = n => n === 1 ? 'CU 0' : `CUs 0–${n - 1}`;
  for (let r = 0; r < geo.rounds; r++) {
    const groups = range(geo.C).map(c => r * geo.C + c).filter(g => g < geo.G);
    const busy = groups.length;
    const chapter = 'round:' + r;
    const gl = groups.length === 1 ? `Work-group ${groups[0]}` : `Work-groups ${groups[0]}–${groups[busy - 1]}`;
    const idle = geo.C - busy;
    begin({ phase: 11, chapter, host: blockedHost, hostMode: 'blocked', kern: ['sig'], cost: 'ctrl',
      title: `Round ${r + 1}/${geo.rounds}: ${gl} → ${cuRange(busy)}`,
      detail: `Each work-group is dispatched whole to one compute unit${K.usesLocal ? ', which gives it a fresh local-memory scratch area' : ''}.` +
        (idle ? ` ${idle} CU${idle > 1 ? 's' : ''} idle: no work-groups left.` : '') +
        (geo.waves > 1 ? ` ${geo.L} work-items on ${geo.P} PEs: they run in ${geo.waves} waves.` : '') });
    cur.cus = groups.map((g, c) => ({ cu: c, g }));
    groups.forEach((g, c) => {
      op(['wg', g, WG.RUNNING]); op(['cu', c, g]);
      if (K.usesLocal) op(['lalloc', c, geo.L]);
      for (let ll = 0; ll < geo.L; ll++) op(['wi', workItem(geo, g, ll).flat, WI.RESIDENT]);
      cur.flows.push({ from: { k: 'sched', g }, to: { k: 'cu', cu: c }, kind: 'ctrl' });
    });
    end();

    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si];
      for (let v = 0; v < geo.waves; v++) {
        const lls = range(geo.P).map(p => v * geo.P + p).filter(ll => ll < geo.L);
        for (const st of seg.stmts) {
          begin({ phase: 11, chapter, host: blockedHost, hostMode: 'blocked', kern: [st.tag], cost: st.cost,
            title: st.label, stmt: st, wave: v });
          cur.lanes = [];
          cur.cus = groups.map((g, c) => ({ cu: c, g }));
          let active = 0, masked = 0;
          groups.forEach((g, c) => {
            for (const ll of lls) {
              const w = Object.assign(workItem(geo, g, ll), { cu: c, pe: ll - v * geo.P });
              const lane = { cu: c, pe: w.pe, wi: w.flat, active: true, note: '' };
              const io = ioFor(lane, w);
              if (st.pre) st.pre(w, io);
              if (st.active && !st.active(w, io)) { lane.active = false; masked++; }
              else { lane.note = st.run(w, io); active++; }
              cur.lanes.push(lane);
            }
          });
          const waveTxt = geo.waves > 1 ? `wave ${v + 1}/${geo.waves}, ` : '';
          cur.detail = `${busy > 1 ? busy + ' CUs in parallel, ' : ''}${waveTxt}${lls.length} PE${lls.length > 1 ? 's' : ''} each. ` +
            (masked && !active ? 'Every work-item in this wave fails the if; real hardware skips a wave that is masked off entirely. '
              : masked ? `${masked} work-item${masked > 1 ? 's' : ''} masked off by the if: the PE idles (divergence). ` : '') +
            COST_NOTE[st.cost];
          end();
        }
        if (seg.barrier) {
          const last = v === geo.waves - 1;
          begin({ phase: 11, chapter, host: blockedHost, hostMode: 'blocked', kern: [seg.barrier], cost: 'alu',
            title: last ? 'barrier(): all work-items arrived, released' : `barrier(): wave ${v + 1} waits`, wave: v });
          cur.cus = groups.map((g, c) => ({ cu: c, g }));
          cur.lanes = [];
          groups.forEach((g, c) => {
            if (last) {
              for (let ll = 0; ll < geo.L; ll++) op(['wi', workItem(geo, g, ll).flat, WI.RESIDENT]);
            } else {
              for (const ll of lls) op(['wi', workItem(geo, g, ll).flat, WI.BARRIER]);
            }
            for (const ll of lls) cur.lanes.push({ cu: c, pe: ll - v * geo.P, wi: workItem(geo, g, ll).flat, active: true, note: 'barrier' });
          });
          cur.detail = last
            ? `Every work-item in the work-group has finished writing local memory, so reads after this point see all of it. Barriers only work inside one work-group.`
            : `These work-items stop until the rest of their work-group, running in later waves, reaches the same barrier.`;
          end();
        }
      }
    }

    begin({ phase: 11, chapter, host: blockedHost, hostMode: 'blocked', cost: 'ctrl',
      title: `${gl} finished`,
      detail: K.usesLocal
        ? 'The compute units are free again. Their local memory is discarded: it does not survive from one work-group to the next.'
        : 'The compute units are free for the next work-groups.' });
    groups.forEach((g, c) => {
      op(['wg', g, WG.DONE]); op(['cu', c, -1]); op(['cnt', 'wgDone', 1]);
      if (K.usesLocal) op(['lfree', c]);
      for (let ll = 0; ll < geo.L; ll++) op(['wi', workItem(geo, g, ll).flat, WI.DONE]);
    });
    end();
  }

  begin({ phase: 11, chapter: 'kdone', host: blockedHost, hostMode: 'blocked', cost: 'ctrl', title: 'Kernel complete',
    detail: 'The NDRange command leaves the queue; the read behind it can start.' });
  op(['qshift']); end();

  for (const b of outBufs) {
    begin({ phase: 12, chapter: 'read:' + b.name, host: ['read:' + b.name], hostMode: 'blocked', cost: 'pcie', title: `Transfer: ${b.name} → ${b.host}`,
      detail: `${nb(b.n)} bytes cross the link back into host memory. The blocking call returns.` });
    op(['qrun']); op(['copyGH', b.name, b.host]); op(['cnt', 'pcieDH', nb(b.n)]); op(['qshift']);
    op(['host', 'running', false]);
    for (let i = 0; i < b.n; i++) {
      cur.flows.push({ from: { k: 'g', buf: b.name, idx: i }, to: { k: 'h', arr: b.host, idx: i }, via: { k: 'link' }, kind: 'pcie' });
      cur.reads.push({ sp: 'g', buf: b.name, idx: i });
      cur.writes.push({ sp: 'h', arr: b.host, idx: i });
    }
    end();
  }

  if (K.id === 'reduce') {
    begin({ phase: 12, chapter: 'hostsum', host: ['hostsum'], cost: 'host', title: 'Host adds the partial sums',
      detail: `Work-groups cannot synchronise with each other, so the ${geo.G} per-group results are combined here (or by a second kernel launch).` });
    const p = S.host.partial.data;
    let sum = 0;
    for (let i = 0; i < geo.G; i++) { sum += p[i]; cur.reads.push({ sp: 'h', arr: 'partial', idx: i }); }
    op(['halloc', 'sum', 1, [sum]]);
    cur.writes.push({ sp: 'h', arr: 'sum', idx: 0 });
    end();
  }

  begin({ phase: 13, chapter: 'release', host: ['release'], title: 'Release OpenCL resources',
    detail: 'Buffers, kernel, program, queue and context are freed. The results stay in host memory.' });
  for (const b of buffers) op(['gfree', b.name]);
  op(['obj', 'kernel', 0]); op(['obj', 'program', 0]); op(['obj', 'queue', 0]); op(['obj', 'context', 0]);
  op(['obj', 'released', 1]);
  end();

  function stateAt(k) {
    k = Math.max(0, Math.min(steps.length - 1, k));
    const j = Math.floor(k / CHECKPOINT_EVERY);
    const s = cloneState(checkpoints[j]);
    for (let i = j * CHECKPOINT_EVERY + 1; i <= k; i++) for (const o of steps[i].ops) applyOp(s, o);
    return s;
  }

  return {
    cfg, geo, kernel: K, hostLines, kernelLines, hostArrays, buffers, args, steps, stateAt, finalState: S,
    varNames: K.priv, expected: K.expected(geo), workItemOf: flat => workItemOf(geo, flat),
  };
}

function defaultConfig(kid, cus = 4, pes = 4) {
  const K = KERNELS[kid];
  return { kernel: kid, gsz: K.defGlobal.slice(), lsz: K.defLocal.slice(), cus, pes };
}

const api = { KERNELS, PHASES, WI, WG, DEVICE_MAX_WG, build, globalOptions, localOptions, validate, defaultConfig, geometry, workItemOf, fmt, testImage };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.OCL = api;
})(typeof window !== 'undefined' ? window : globalThis);
