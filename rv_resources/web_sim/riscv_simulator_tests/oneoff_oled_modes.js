/*
 * ONE-OFF OLED verification. Deliberately NOT in `npm run test:all`.
 *
 * Checks the JS model's OLED against the authority: RV/Wrapper.v itself,
 * simulated by the real Icarus/WASM pipeline. The same program is run on
 * both engines and the two 96x64 frame buffers are compared pixel by pixel.
 *
 * Covers what the shipped examples never exercise: 16-bit and 24-bit colour,
 * vary_col / vary_row triggering, both autoadvance directions including their
 * wrap, and the sub-word write rules each colour mode imposes.
 *
 *   node riscv_simulator_tests/oneoff_oled_modes.js
 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM; }

const ROOT = path.resolve(__dirname, '..');
const RV = path.join(ROOT, 'RV');
const ENGINE = process.env.HDL_ENGINE_DIR || path.join(ROOT, 'vendor', 'verisim');
const html = fs.readFileSync(path.join(ROOT, 'riscv_simulator.html'), 'utf8');
const CM6 = fs.readFileSync(path.join(__dirname, 'cm6_bundle.min.js'), 'utf8');
const DESIGN = ['ALU.v', 'Decoder.v', 'Extend.v', 'MCycle.v', 'PC_Logic.v', 'ProgramCounter.v',
                'RegFile.v', 'Shifter.v', 'RV.v', 'Wrapper.v'];

let passed = 0, failed = 0;
const check = (label, cond) => {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
};

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable',
  url: 'http://localhost:8080/riscv_simulator.html',
  beforeParse(window) {
    window.__CM6_DISABLE_CDN = true;
    window.addEventListener('DOMContentLoaded', () => {
      try { window.eval(CM6); } catch (e) { console.error('CM6 inject failed:', e.message); }
    });
    window.requestAnimationFrame = cb => setTimeout(cb, 16);
    window.cancelAnimationFrame = id => clearTimeout(id);
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    window.Range.prototype.getClientRects = () => [];
    window.Range.prototype.getBoundingClientRect = () => ({ top:0,bottom:0,left:0,right:0,width:0,height:0 });
    window.Element.prototype.getClientRects = () => [];
    window.Element.prototype.getBoundingClientRect = () => ({ top:0,bottom:0,left:0,right:0,width:0,height:0 });
    window.HTMLCanvasElement.prototype.getContext = () => ({
      setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {},
      lineTo() {}, stroke() {}, fill() {}, closePath() {}, fillText() {}, save() {},
      restore() {}, rect() {}, clip() {}, drawImage() {}, putImageData() {},
      createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
      getImageData: () => ({ data: new Uint8Array(4) }),
      measureText: () => ({ width: 0 })
    });
  }
});
const win = dom.window, doc = win.document;

// ---- Icarus driver, compiled once and re-run per case ----------------------
async function makeIcarus(testbench) {
  const initIvlpp = (await import('file://' + path.join(ENGINE, 'ivlpp.js'))).default;
  const initIvl   = (await import('file://' + path.join(ENGINE, 'ivl.js'))).default;
  const initVvp   = (await import('file://' + path.join(ENGINE, 'vvp.js'))).default;

  const files = DESIGN.map(n => ({ name: n, src: fs.readFileSync(path.join(RV, n), 'utf8') }));
  files.push({ name: 'cg3207_hdl_tb.v', src: testbench });

  const ppOut = [];
  const pp = await initIvlpp({ print: s => ppOut.push(s), printErr: () => {} });
  const args = ['-L'];
  for (const f of files) { pp.FS.writeFile('/' + f.name, f.src + '\n'); args.push('/' + f.name); }
  pp.callMain(args);

  const errs = [];
  const ivl = await initIvl({ print: () => {}, printErr: s => errs.push(s) });
  ivl.FS.writeFile('/ivl.conf',
    'basedir:/\nmodule:system.vpi\ngeneration:2005\ngeneration:no-specify\nout:/out.vvp\n' +
    'iwidth:32\nwidthcap:65536\nfunctor:cprop\nfunctor:nodangle\nflag:DLL=vvp.tgt\n');
  ivl.FS.writeFile('/src.v', ppOut.join('\n') + '\n');
  ivl.callMain(['-C/ivl.conf', '--', '/src.v']);

  let vvpBytes = null;
  try { vvpBytes = ivl.FS.readFile('/out.vvp'); } catch (e) { /* compile failed */ }
  if (!vvpBytes) {
    console.log(errs.filter(l => !/system\.vpi|dynamic linking/.test(l)).join('\n'));
    throw new Error('testbench did not compile');
  }
  return async (plusargs, memFiles) => {
    const out = [];
    const vvp = await initVvp({ print: s => out.push(s), printErr: s => out.push(s) });
    vvp.FS.writeFile('/sim.vvp', vvpBytes);
    for (const n of Object.keys(memFiles)) vvp.FS.writeFile('/' + n, memFiles[n]);
    vvp.callMain(['/sim.vvp'].concat(plusargs));
    return out.join('\n');
  };
}

// Every OLED write the hardware committed, painted into a frame buffer the
// same way the page paints an @@O event.
// PmodOLEDrgb_bitmap addresses with (col[6] and not col[5]) & col[5:0], so a
// column the Wrapper passed through untouched still folds here.
function panelCol(c) {
  c &= 0x7F;
  return ((c & 0x40) && !(c & 0x20)) ? (64 + (c & 0x3F)) : (c & 0x3F);
}

function hdlFrame(stdout) {
  // Two pages, exactly as the controller and the JS engine have. Seeded opaque
  // black to match what the page's own reset leaves behind, so an untouched
  // pixel compares equal instead of differing on alpha.
  const blank = () => {
    const b = new Uint8Array(96 * 64 * 4);
    for (let p = 0; p < 96 * 64; p++) b[p * 4 + 3] = 255;
    return b;
  };
  const pages = [blank(), blank()];
  let front = 0, back = 0;
  const writes = [];

  for (const line of stdout.split('\n')) {
    const t = line.trim();

    // A present: split the pages on the first one, exchange after that, then
    // copy the newly displayed page back so partial updates keep working.
    if (/^@@B\b/.test(t)) {
      if (front === back) back = 1 - front;
      else { const x = front; front = back; back = x; }
      pages[back].set(pages[front]);
      writes.push('present');
      continue;
    }

    // 'x' shows up when the design writes a pixel whose OLED_Data was never
    // driven, which is a real outcome worth seeing rather than skipping.
    const m = /^@@O\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9a-fA-FxXzZ]+)/.exec(t);
    if (!m) continue;
    const undef = /[xXzZ]/.test(m[4]);
    const col = panelCol(+m[2]), row = (+m[3]) & 0x3F;
    const rgb = undef ? NaN : parseInt(m[4], 16) >>> 0;
    writes.push({ cyc: +m[1], col, row, rgb, undef });
    if (undef) continue;
    const i = (row * 96 + col) * 4;
    pages[back][i] = (rgb >>> 16) & 0xFF;
    pages[back][i + 1] = (rgb >>> 8) & 0xFF;
    pages[back][i + 2] = rgb & 0xFF;
    pages[back][i + 3] = 255;
  }
  return { buf: pages[front], writes };
}

function diffFrames(a, b) {
  const bad = [];
  for (let p = 0; p < 96 * 64; p++) {
    const i = p * 4;
    if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2] || a[i+3] !== b[i+3]) {
      bad.push({ col: p % 96, row: (p / 96) | 0,
                 js: [a[i], a[i+1], a[i+2], a[i+3]],
                 hdl: [b[i], b[i+1], b[i+2], b[i+3]] });
    }
  }
  return bad;
}

const px = (buf, col, row) => {
  const i = (row * 96 + col) * 4;
  return [buf[i], buf[i+1], buf[i+2], buf[i+3]];
};

// ---- The cases -------------------------------------------------------------
// t0 holds 0xFFFF0000 throughout; OLED regs are at +0x20/24/28/2C.
const PRE = ['.text', 'main:', '  lui  t0, 0xFFFF0'];
const HALT = ['halt:', '  jal  x0, halt'];
const ctrl = (v) => [`  addi t1, x0, ${v}`, '  sw   t1, 0x2C(t0)'];
const col  = (v) => [`  addi t1, x0, ${v}`, '  sw   t1, 0x20(t0)'];
const row  = (v) => [`  addi t1, x0, ${v}`, '  sw   t1, 0x24(t0)'];
// li via lui+addi so 16- and 24-bit constants survive.
const data = (v) => [`  li   t1, ${v}`, '  sw   t1, 0x28(t0)'];
const dataB = (v) => [`  li   t1, ${v}`, '  sb   t1, 0x28(t0)'];
const dataH = (v) => [`  li   t1, ${v}`, '  sh   t1, 0x28(t0)'];
const present = () => ['  addi t1, x0, 8', '  sw   t1, 0x2C(t0)'];

const CASES = [
  {
    name: '8-bit colour (3R-3G-2B), vary_pixel_data',
    prog: [].concat(ctrl(0x00), col(5), row(7), data(0xE0),
                    col(6), data(0x1C), col(7), data(0x03),
                    col(8), data(0xFF)),
    note: 'pure R, pure G, pure B and white at cols 5..8 of row 7'
  },
  {
    name: '16-bit colour (5R-6G-5B), vary_pixel_data',
    prog: [].concat(ctrl(0x10), col(10), row(3), data(0xF800),
                    col(11), data(0x07E0), col(12), data(0x001F),
                    col(13), data(0xFFFF), col(14), data(0x8410)),
    note: 'R, G, B, white and a mid-grey at cols 10..14 of row 3'
  },
  {
    name: '24-bit colour, vary_pixel_data',
    prog: [].concat(ctrl(0x20), col(20), row(9), data(0xFF8040),
                    col(21), data(0x010203), col(22), data(0xFFFFFF)),
    note: 'arbitrary 8-8-8 values pass through untouched'
  },
  {
    name: 'vary_col trigger (writing OLED_COL paints)',
    prog: [].concat(ctrl(0x11), row(20), data(0x07E0),
                    col(30), col(31), col(32), col(40)),
    note: 'one green pixel per column written, data set once'
  },
  {
    name: 'vary_row trigger (writing OLED_ROW paints)',
    prog: [].concat(ctrl(0x12), col(50), data(0x001F),
                    row(10), row(11), row(12), row(20)),
    note: 'one blue pixel per row written, data set once'
  },
  {
    name: 'autoadvance_col (row major), 16-bit',
    prog: [].concat(ctrl(0x14), col(0), row(30),
                    data(0xF800), data(0x07E0), data(0x001F),
                    data(0xFFFF), data(0xF81F)),
    note: 'five pixels marching right along row 30'
  },
  {
    name: 'autoadvance_col wrap at column 95',
    prog: [].concat(ctrl(0x14), col(93), row(40),
                    data(0xF800), data(0x07E0), data(0x001F), data(0xFFFF), data(0xF81F)),
    note: 'must roll onto the next row after column 95'
  },
  {
    name: 'autoadvance_row (column major), 16-bit',
    prog: [].concat(ctrl(0x15), col(60), row(0),
                    data(0xF800), data(0x07E0), data(0x001F), data(0xFFFF)),
    note: 'four pixels marching down column 60'
  },
  {
    name: 'autoadvance_row wrap at row 63',
    prog: [].concat(ctrl(0x15), col(70), row(61),
                    data(0xF800), data(0x07E0), data(0x001F), data(0xFFFF)),
    note: 'must roll onto the next column after row 63'
  },
  {
    name: 'the column register after leaving autoadvance_col',
    prog: [].concat(ctrl(0x14), col(10), row(5),
                    data(0xF800), data(0xF800), data(0xF800),
                    ctrl(0x10), data(0x001F)),
    note: 'the Wrapper arms on the first write, so it ends one behind a naive count'
  },
  {
    name: 'the row register after leaving autoadvance_row',
    prog: [].concat(ctrl(0x15), col(20), row(3),
                    data(0xF800), data(0xF800), data(0xF800),
                    ctrl(0x10), data(0x001F)),
    note: 'same arming rule on the other axis'
  },
  {
    name: 'out-of-range column 96 folds onto 32, it does not wrap to 0',
    prog: [].concat(ctrl(0x10), col(96), row(7), data(0x07E0)),
    note: 'the panel folds 96..127 onto 32..63'
  },
  {
    name: 'out-of-range column 100 folds onto 36',
    prog: [].concat(ctrl(0x10), col(100), row(6), data(0x07E0)),
    note: 'same fold, mid-range'
  },
  {
    name: 'column 128 is truncated to 7 bits by the Wrapper',
    prog: [].concat(ctrl(0x10), col(128), row(8), data(0x07E0)),
    note: 'OLED_Col <= WriteData_out[6:0], so 128 becomes 0'
  },
  {
    name: 'a present keeps the drawn frame on screen',
    prog: [].concat(ctrl(0x10), col(4), row(4), data(0xF800), present()),
    note: 'the first present splits the pages, leaving what was drawn displayed'
  },
  {
    name: 'a partial update after a present survives the page copy',
    prog: [].concat(ctrl(0x10), col(5), row(5), data(0xF800),
                    col(6), data(0xF800), present(),
                    col(5), data(0x001F), present()),
    note: 'the controller copies front to back, so (6,5) must still be there'
  },
  {
    name: 'a present does not disturb the configured mode',
    prog: [].concat(ctrl(0x14), col(0), row(9),
                    data(0xF800), present(), data(0x07E0), data(0x001F)),
    note: 'bit 3 is a present, not a configure: autoadvance_col must survive it'
  },
  {
    name: '8-bit colour accepts a byte write (sb) to OLED_DATA',
    prog: [].concat(ctrl(0x00), col(80), row(50), dataB(0xE0)),
    note: 'Wrapper gates 8-bit on MemWrite_out[0], so sb is enough'
  },
  {
    // Written as two paints of the same pixel: the byte write still triggers
    // a paint, so what is under test is that it repaints the OLD colour.
    name: '16-bit colour ignores a byte write (sb) to OLED_DATA',
    prog: [].concat(ctrl(0x10), col(81), row(51), dataH(0x07E0), dataB(0xF8)),
    note: 'Wrapper gates 16-bit on MemWrite_out[1] && [0]: the sb must leave the green'
  },
  {
    name: '16-bit colour accepts a half-word write (sh)',
    prog: [].concat(ctrl(0x10), col(82), row(52), dataH(0x07E0)),
    note: 'lower half-word is the documented minimum for 16-bit'
  },
  {
    name: '24-bit colour accepts a byte write (sb) into the blue lane',
    prog: [].concat(ctrl(0x20), col(83), row(53), data(0xFFFFFF), dataB(0x00)),
    note: 'per-byte lanes: sb rewrites only OLED_Data[7:0]'
  }
];

// ---- Runner ----------------------------------------------------------------
async function jsFrame(source) {
  win.setSimEngineMode('js');
  win.setLanguageMode('asm');
  win.editor.value = source;
  win.assembleOnly();
  win.resetAll();
  // Programs end on a self-loop, so step a fixed budget rather than running.
  for (let i = 0; i < 400; i++) await win.stepOnce();
  return Uint8Array.from(win.getOledBuffer());
}

(async () => {
  console.log('===========================================================');
  console.log('🖥️  ONE-OFF: OLED modes, JS model vs RV/Wrapper.v via Icarus');
  console.log('===========================================================');

  win.hdlSetSources(DESIGN.map(n => ({ name: n, src: fs.readFileSync(path.join(RV, n), 'utf8') })));
  const rb = win.hdlDiscoverRegBank();
  const run = await makeIcarus(win.hdlBuildTestbench({ regBankPath: rb }));
  console.log('Testbench compiled; register bank at ' + rb + '\n');

  for (const c of CASES) {
    const source = PRE.concat(c.prog, HALT).join('\n');
    console.log('── ' + c.name);
    console.log('   ' + c.note);

    const js = await jsFrame(source);
    // The HDL side needs the memory image the page built for this program.
    const mem = win.hdlMemFiles().files;
    const out = await run(['+CYCLES=800', '+TRACE=2'], mem);
    const { buf: hdl, writes } = hdlFrame(out);

    const bad = diffFrames(js, hdl);
    const litJs = [];
    for (let p = 0; p < 96 * 64; p++) if (js[p * 4 + 3]) litJs.push(p);
    const litHdl = [];
    for (let p = 0; p < 96 * 64; p++) if (hdl[p * 4 + 3]) litHdl.push(p);

    console.log(`   hardware wrote ${writes.length} pixel(s); lit: JS ${litJs.length}, HDL ${litHdl.length}`);
    if (writes.length) {
      const show = writes.slice(0, 8).map(w => w === 'present' ? '[present]' :
        `(${w.col},${w.row})=` + (w.undef ? '#undefined' : '#' + w.rgb.toString(16).padStart(6, '0'))).join(' ');
      console.log('   HDL writes: ' + show + (writes.length > 8 ? ' …' : ''));
    }
    if (bad.length) {
      console.log(`   first mismatches:`);
      for (const d of bad.slice(0, 6)) {
        console.log(`     (${d.col},${d.row}) JS rgba(${d.js}) vs HDL rgba(${d.hdl})`);
      }
      if (bad.length > 6) console.log(`     … ${bad.length - 6} more`);
    }
    check(`${c.name}: frame buffers identical`, bad.length === 0);
    console.log('');
  }

  console.log('===========================================================');
  console.log(failed === 0
    ? `🎉 ALL ${passed} OLED MODE COMPARISONS MATCHED`
    : `💥 ${failed} OF ${passed + failed} OLED MODE COMPARISONS DIFFER`);
  console.log('===========================================================');
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('One-off OLED test failed:', e); process.exit(1); });
