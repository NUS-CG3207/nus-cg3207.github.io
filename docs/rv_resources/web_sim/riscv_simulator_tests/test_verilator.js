/*
 * Verilator in the desktop app, through the page's own HDL flow: the
 * Simulator setting, a build (cached by content), runs that record what
 * Icarus records, input changes and Resume, the Wrapper-only waveform, a
 * compile error, Reset during a build, the status line during a build, and
 * checkpoints: Resume and an input change replayed from one, the waveform
 * built from one, and a checkpoint that does not reproduce the recording.
 * In a browser the setting is shown and disabled. Also times Icarus against
 * Verilator through the page, waveform on and off.
 *
 * Needs native builds of both: cd electron && npm run build:iverilog &&
 * npm run build:verilator, and a C++20 compiler (or RVSIM_FORCE_ZIG=1 with
 * the network, which fetches Zig into the test's cache).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { installExamplesFetch } = require('./examples_fetch');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM; }

const ROOT = path.resolve(__dirname, '..');
const RV = require('./core_dir').coreDir('test_verilator');
const ENGINE = process.env.HDL_ENGINE_DIR || path.join(ROOT, 'vendor', 'verisim');
const { createRunner, findBinDir, readFolder } = require(path.join(ROOT, 'electron', 'hdl_native.js'));
const { createVerilator, findVerilator } = require(path.join(ROOT, 'electron', 'verilator_native.js'));
const OS = { darwin: 'mac', win32: 'win' }[process.platform] || process.platform;
const NATIVE = findBinDir([process.env.HDL_NATIVE_DIR, path.join(ROOT, 'electron', 'iverilog', OS + '-' + process.arch)]);
const VL_ROOT = findVerilator([process.env.HDL_VERILATOR_DIR, path.join(ROOT, 'electron', 'verilator', OS + '-' + process.arch)]);

const html = fs.readFileSync(path.join(ROOT, 'riscv_simulator.html'), 'utf8');
const CM6 = fs.readFileSync(path.join(__dirname, 'cm6_bundle.min.js'), 'utf8');
const DESIGN = ['ALU.v', 'Decoder.v', 'Extend.v', 'MCycle.v', 'PC_Logic.v', 'ProgramCounter.v',
                'RegFile.v', 'Shifter.v', 'RV.v', 'Wrapper.v'];

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The WASM build, run in Node the way the page's worker runs it.
function wasmRunner() {
  const factories = {};
  return {
    async run(id, tool, files, args, opts) {
      const factory = factories[tool] ||
        (factories[tool] = (await import('file://' + path.join(ENGINE, tool + '.js'))).default);
      const out = [], err = [];
      const m = await factory({ print: s => out.push(s), printErr: s => (opts.merge ? out : err).push(s) });
      for (const name in files) m.FS.writeFile('/' + name, files[name]);
      try { m.callMain(args); } catch (e) { if (!(e && e.name === 'ExitStatus')) throw e; }
      const got = {};
      if (opts.keep) {
        const re = new RegExp(opts.keep);
        for (const name of m.FS.readdir('/')) if (re.test(name)) got[name] = m.FS.readFile('/' + name);
      }
      return { out, err, files: got };
    },
    kill() {}
  };
}

// A page with the bridge preload.js would give it, running its stages on the
// given runner and reading folders from disk; folder.next is what the folder
// dialog returns.
function makePage(runner, folder, vl, src) {
  const timing = { ms: {} };
  const dom = new JSDOM(src || html, {
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
      if (window.HTMLCanvasElement) {
        window.HTMLCanvasElement.prototype.getContext = () => ({
          createImageData: (w,h) => ({ data: new Uint8Array(w*h*4), width:w, height:h }),
          putImageData(){}, fillRect(){}, clearRect(){}, drawImage(){}, fillText(){}, strokeRect(){},
          beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, save(){}, restore(){}, rect(){}, clip(){},
          setTransform(){}, closePath(){}, fill(){}, translate(){}, scale(){}, arc(){}, setLineDash(){}, strokeText(){},
          getImageData: () => ({ data: new Uint8Array(4) }), measureText: () => ({ width: 0 })
        });
      }
      installExamplesFetch(window);
      window.TextDecoder = TextDecoder;
      window.TextEncoder = TextEncoder;
      const progressCbs = [], liveCbs = [];
      window.rvNative = vl === 'browser' ? undefined : {
        icarus: true, icarusVersion: 'test', platform: process.platform, rememberedFolder: null,
        async hdlRun(id, tool, files, args, opts) {
          const t0 = Date.now();
          try { return await runner.run(id, tool, files, args, opts); }
          finally { timing.ms[tool] = (timing.ms[tool] || 0) + Date.now() - t0; }
        },
        hdlKill: id => { runner.kill(id); if (vl) vl.kill(id); },
        verilator: !!vl,
        vlBuild: (id, files, opts) => vl.build(id, files, opts, e => progressCbs.forEach(cb => cb(id, e))),
        vlRun: (id, key, files, args, opts) => vl.run(id, key, files, args, opts),
        onVlProgress: cb => progressCbs.push(cb),
        vlLive: (id, key, files, args, opts) => vl.runLive(id, key, files, args, opts, d => liveCbs.forEach(cb => cb(id, d))),
        vlLiveSend: async (id, line) => vl.liveSend(id, line),
        vlLiveRead: async (id, name, max) => vl.liveRead(id, name, max),
        onVlLiveData: cb => liveCbs.push(cb),
        pickFolder: async () => folder.next,
        readFolder: dir => readFolder(dir),
        forgetFolder: async () => {}
      };
    }
  });
  return { win: dom.window, doc: dom.window.document, timing };
}

const consoleText = doc => [...doc.querySelectorAll('#console div')].map(d => d.textContent);
const stripVcdDate = v => (v || '').replace(/\$date[\s\S]*?\$end/, '');
async function until(cond, ms) {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > (ms || 60000)) return false; await sleep(20); }
  return true;
}

// The architectural record of a run, without the peripheral events at
// cycle 1, where Icarus reports outputs leaving x and Verilator, being
// two-state, has nothing to report.
const arch = t => JSON.stringify(t.steps.map(s => [s.cyc, s.pc, s.instr, s.regw, s.memw]));

// [8], run in a process of its own (see below): the pages of the other
// sections fill this one's heap, and jsdom does not give it back.
async function checkpointSection(dir, cache) {
  const vl = createVerilator({ root: VL_ROOT, cacheDir: cache });
  // The same page with the checkpoint module left out: every replay from reset.
  const noCk = html.replace('let ck = state.off ? null : state;', 'let ck = null;');
  check('(the page can be built without checkpoints, for reference)', noCk !== html);
  const cp = makePage(createRunner(NATIVE), { next: dir }, vl);
  const cq = makePage(createRunner(NATIVE), { next: dir }, vl, noCk);
  await sleep(1500);
  const fresh = async (x, cycles) => {
    x.win.resetAll();
    await x.win.loadExample('dip_led');
    x.win.setDipSwitches(0x00ad);
    x.win.setHdlCycles(cycles);
  };
  for (const x of [cp, cq]) {
    x.win.setHdlSimulator('verilator');
    await x.win.hdlPickFolder();
    x.win.setHdlDumpVcd(false);
    x.win.setHdlLiveWave('pause');
    await fresh(x, 500000);
  }
  const seen7 = [];
  const watch7 = setInterval(() => {
    const s = cp.doc.getElementById('statusBar').textContent;
    if (seen7[seen7.length - 1] !== s) seen7.push(s);
  }, 5);
  const ks = t => (t.vlCks || []).map(c => c.k).join();
  await cp.win.runHdlSimulation();
  let ct = cp.win.getHdlTrace();
  check('A run keeps its two newest checkpoints (' + ks(ct) + ')', ks(ct) === '400000,200000');
  let ms = Date.now();
  await cp.win.runHdlSimulation();
  console.log('    Resume to 1,000,000 cycles: ' + (Date.now() - ms) + ' ms');
  ct = cp.win.getHdlTrace();
  check('Resume replays from the newest checkpoint before the end',
    seen7.some(s => /replaying cycles 400,000 to 500,000/.test(s)));
  check('…and then holds the two newest of the longer recording (' + ks(ct) + ')', ks(ct) === '800000,600000');
  cq.win.setHdlCycles(1000000);
  await cq.win.runHdlSimulation();
  check('The joined recording is the one a run from reset makes (' + ct.steps.length + ' instructions)',
    ct.budget === 1000000 && arch(ct) === arch(cq.win.getHdlTrace()));
  check('…with no warning', !consoleText(cp.doc).some(l => /did not match/.test(l)));

  cp.win.hdlSeek(ct.steps.length - 30000);
  seen7.length = 0;
  cp.win.setDipSwitches(0x0072);
  await until(() => seen7.some(s => /simulating/.test(s)) &&
    !/simulating/.test(cp.doc.getElementById('statusBar').textContent), 60000);
  await sleep(300);
  ct = cp.win.getHdlTrace();
  check('A switch moved while paused replays from the checkpoint before it',
    seen7.some(s => /simulating cycles 800000 to/.test(s)));
  cq.win.hdlDiscardTrace();
  cq.win.hdlSetStim(ct.timeline.stim);
  const cr = await cq.win.hdlBuildTrace(ct.budget, { quiet: true });
  check('…and records what a replay from reset records', !!cr && arch(cr) === arch(ct));
  cp.win.hdlSeek(ct.steps.length);
  check('…with the LEDs following (0x' + cp.win.getLedState().toString(16) + ')', cp.win.getLedState() === 0x72);

  // The design's signals: the testbench's own trace bookkeeping differs,
  // since a replay from a checkpoint prints its records to be checked.
  // Compared signal by signal: two whole waveforms as text do not fit in
  // this process beside everything else it holds.
  const sameDut = () => {
    const a = cp.win.parseVcd(cp.win.getHdlLastVcd() || ''), b = cq.win.parseVcd(cq.win.getHdlLastVcd() || '');
    let n = 0, changes = 0;
    for (const [name, s] of a.byPath) {
      if (!/\.dut\./.test(name)) continue;
      const t = b.byPath.get(name);
      if (!t) return false;
      const x = a.changes.get(s.id) || { times: [], values: [] }, y = b.changes.get(t.id) || { times: [], values: [] };
      if (x.times.length !== y.times.length || x.times.some((v, i) => v !== y.times[i] || x.values[i] !== y.values[i])) return false;
      n++;
      changes += x.times.length;
    }
    return n > 20 && changes > 50000;
  };
  for (const x of [cp, cq]) { x.win.setHdlDumpVcd(true); x.win.setHdlWaveTop(true); await fresh(x, 700000); }
  await cp.win.runHdlSimulation();
  await cq.win.runHdlSimulation();
  check('The waveform built on Pause, from a checkpoint, shows the design as one built from reset does', sameDut());
  for (const x of [cp, cq]) x.win.setHdlLiveWave('live');
  seen7.length = 0;
  await cp.win.runHdlSimulation();
  await cq.win.runHdlSimulation();
  check('Resume with the waveform followed live starts from a checkpoint before the waveform\'s window',
    seen7.some(s => /replaying cycles 600,000 to 700,000/.test(s)));
  check('…and its waveform and recording are those of a run from reset',
    sameDut() && arch(cp.win.getHdlTrace()) === arch(cq.win.getHdlTrace()));

  // A checkpoint that does not reproduce the recording: the PC is saved last.
  // (The Wrapper-only waveform stays: turning it off would select another model.)
  for (const x of [cp, cq]) { x.win.setHdlLiveWave('pause'); x.win.setHdlDumpVcd(false); }
  ct = cp.win.getHdlTrace();
  for (const c of ct.vlCks) {
    const lines = c.txt.split('\n');
    const i = lines.length - 2;
    lines[i] = lines[i].slice(0, -3) + (lines[i].slice(-3) === '000' ? '100' : '000');
    c.txt = lines.join('\n');
  }
  await cp.win.runHdlSimulation();
  await cq.win.runHdlSimulation();
  check('A checkpoint that does not reproduce the recording is reported',
    consoleText(cp.doc).some(l => /did not match the recording/.test(l)));
  check('…the run is replayed from reset, and is right', arch(cp.win.getHdlTrace()) === arch(cq.win.getHdlTrace()));
  check('…and checkpoints stay off for those sources', !cp.win.getHdlTrace().vlCks);

  // A design that sets its initial values with <= overrides the restore.
  const pcSrc = fs.readFileSync(path.join(RV, 'ProgramCounter.v'), 'utf8');
  const oldPc = pcSrc.replace(/output reg \[31:0\] PC = PC_INIT\s*\);/, 'output reg [31:0] PC\n    );\n    initial begin\n        PC <= PC_INIT;\n    end');
  check('(the old ProgramCounter can be rebuilt for this)', oldPc !== pcSrc);
  fs.writeFileSync(path.join(dir, 'ProgramCounter.v'), oldPc);
  cp.doc.getElementById('console').innerHTML = '';
  for (const x of [cp, cq]) await fresh(x, 500000);
  await cp.win.runHdlSimulation();
  await cp.win.runHdlSimulation();
  cq.win.setHdlCycles(1000000);
  await cq.win.runHdlSimulation();
  check('Verilator warns about the <= in an initial block', consoleText(cp.doc).some(l => /Verilator MULTIDRIVEN/.test(l)));
  check('…the replay from its checkpoint does not match and is run again from reset',
    consoleText(cp.doc).some(l => /did not match the recording/.test(l)));
  check('…and the recording is still right', arch(cp.win.getHdlTrace()) === arch(cq.win.getHdlTrace()));
  fs.copyFileSync(path.join(RV, 'ProgramCounter.v'), path.join(dir, 'ProgramCounter.v'));
  clearInterval(watch7);

}

if (process.argv[2] === '--checkpoints') {
  setTimeout(async () => {
    try { await checkpointSection(process.argv[3], process.argv[4]); }
    catch (e) { console.error(e); failed++; }
    console.log('checkpoints: ' + passed + ' passed, ' + failed + ' failed');
    process.exit(0);
  }, 500);
} else setTimeout(async () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'rvsim-vlcache-'));
  try {
    console.log('===========================================================');
    console.log('⚡ VERILATOR (the desktop app) THROUGH THE PAGE');
    console.log('===========================================================');
    if (!NATIVE || !VL_ROOT) {
      check('Native Icarus and Verilator builds are present (npm run build:iverilog / build:verilator in electron/)', false);
      throw new Error('no native builds');
    }
    console.log('  ' + fs.readFileSync(path.join(VL_ROOT, 'VERSION'), 'utf8').trim());

    console.log('\n[1] The Simulator setting');
    const plain = makePage(createRunner(NATIVE), { next: RV }, 'browser');
    await sleep(1500);
    const psel = plain.doc.getElementById('hdlSimulator');
    check('In a browser the setting is there, disabled', !!psel && psel.disabled && psel.value === 'icarus');
    check('…with a tooltip saying it needs the desktop app',
      /only in the desktop app/.test(plain.doc.getElementById('hdlSimulatorRow').title));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvsim-folder-'));
    for (const f of fs.readdirSync(RV)) if (/\.v$/.test(f)) fs.copyFileSync(path.join(RV, f), path.join(dir, f));
    // A register file that reads with <=, so that there is a warning to count.
    fs.writeFileSync(path.join(dir, 'RegFile.v'),
      fs.readFileSync(path.join(RV, 'RegFile.v'), 'utf8').replace(/RD([12]) = /g, 'RD$1 <= '));
    const vl = createVerilator({ root: VL_ROOT, cacheDir: cache });
    const ic = makePage(createRunner(NATIVE), { next: dir }, null);
    const p = makePage(createRunner(NATIVE), { next: dir }, vl);
    const { win, doc } = p;
    await sleep(1500);
    const sel = doc.getElementById('hdlSimulator');
    check('In the app it can be chosen', !!sel && !sel.disabled);
    win.setHdlSynth(true);
    doc.getElementById('hdlSynth').checked = true;
    win.setHdlSimulator('verilator');
    check('Choosing Verilator hides post-synthesis simulation and turns it off',
      doc.getElementById('hdlSynthCard').style.display === 'none' && !doc.getElementById('hdlSynth').checked);
    check('The choice is remembered', win.localStorage.getItem('rvsim.hdlSimulator') === 'verilator');

    for (const q of [ic, p]) {
      await q.win.hdlPickFolder();
      await q.win.loadExample('dip_led');
      q.win.setDipSwitches(0x00ad);
    }

    console.log('\n[2] A build and a run');
    const seen = new Set();
    const watch = setInterval(() => seen.add(doc.getElementById('statusBar').textContent), 25);
    let t0 = Date.now();
    const tv = await win.hdlStartTrace(40000);
    const tBuild = Date.now() - t0;
    clearInterval(watch);
    const log2 = consoleText(doc);
    console.log('    first build and 40,000 cycles: ' + tBuild + ' ms');
    check('The status line follows the build (' + [...seen].filter(s => /Verilator/.test(s)).length + ' messages)',
      [...seen].some(s => /Verilator: compiling the model \(\d+ of \d+ files\)/.test(s)) && [...seen].some(s => /Verilator: linking/.test(s)));
    check('The console says Verilator is two-state', log2.some(l => /two-state logic/.test(l)));
    check('…and how long the build took', log2.some(l => /Verilator build [\d.]+ s/.test(l)));
    check('Its warnings are counted by kind', log2.some(l => /Verilator COMBDLY ×\d+: /.test(l)));
    const ti = await ic.win.hdlStartTrace(40000);
    check('It records the same ' + tv.steps.length + ' instructions, register and memory writes as Icarus',
      !!tv && !!ti && arch(tv) === arch(ti));
    win.hdlSeek(tv.steps.length);
    check('The LEDs show the switches (0x' + win.getLedState().toString(16) + ')', win.getLedState() === 0xad);
    doc.getElementById('console').innerHTML = '';
    win.hdlDiscardTrace();
    t0 = Date.now();
    await win.hdlStartTrace(40000);
    console.log('    again, model cached: ' + (Date.now() - t0) + ' ms');
    check('The same sources reuse the model', consoleText(doc).some(l => /Reusing the compiled design|Reusing the Verilator model/.test(l)));
    check('Verilator\'s end-of-run report stays out of the console',
      !consoleText(doc).some(l => /S i m u l a t i o n|Verilator: \$finish|Verilog \$finish/.test(l)));

    console.log('\n[3] An input change, and Resume');
    const before = win.getHdlTrace();
    win.hdlSeek(Math.floor(before.steps.length * 0.9));
    win.setDipSwitches(0x0072);
    await until(() => win.getHdlTrace() !== before && win.getHdlTrace());
    await sleep(200);
    win.hdlSeek(win.getHdlTrace().steps.length);
    check('A switch change replays, and the LEDs follow (0x' + win.getLedState().toString(16) + ')', win.getLedState() === 0x72);
    const n0 = win.getHdlTrace().budget;
    await win.hdlGrowTrace(n0 + 2000);
    check('Resume extends the recording', win.getHdlTrace().budget === n0 + 2000);

    console.log('\n[4] The Wrapper-only waveform');
    win.setHdlWaveTop(true);
    win.hdlDiscardTrace();
    await win.hdlStartTrace(4000);
    const vars = win.parseVcd(win.getHdlLastVcd()).vars.map(v => v.path);
    check('It keeps CLK, PC, Instr, LED_OUT and the register aliases',
      ['CLK', 'dut.PC', 'dut.Instr', 'LED_OUT', 'x5_t0'].every(s => vars.some(v => v === s || v.endsWith('.' + s))));
    check('…and nothing inside RV', vars.length > 0 && !vars.some(v => /\.RV1\./.test(v)));
    win.setHdlWaveTop(false);

    console.log('\n[5] Errors and Reset');
    doc.getElementById('console').innerHTML = '';
    fs.writeFileSync(path.join(dir, 'ALU.v'), fs.readFileSync(path.join(RV, 'ALU.v'), 'utf8').replace(/endmodule/, 'endmodul'));
    const bad = await win.hdlStartTrace(2000);
    check('A syntax error is reported with its file and line, and nothing runs',
      bad === null && consoleText(doc).some(l => /ALU\.v:\d+:\d+: /.test(l)));
    fs.writeFileSync(path.join(dir, 'ALU.v'), fs.readFileSync(path.join(RV, 'ALU.v'), 'utf8') + '\n// changed\n');
    const pending = win.hdlStartTrace(2000).then(t => ({ t }), e => ({ e }));
    await until(() => /Verilator: (translating|compiling)/.test(doc.getElementById('statusBar').textContent), 20000);
    win.hdlStopWorker();
    const ended = await pending;
    check('Reset during a build cancels it', !!ended.e && ended.e.cancelled === true);
    await sleep(300);
    const left = process.platform === 'win32' ? [] : execSync('ps -eo args', { encoding: 'utf8' }).split('\n')
      .filter(l => /verilator_bin|cc1plus|rvsim-vl-/.test(l) && !/ps -eo/.test(l));
    check('…and leaves no compiler running (' + left.length + ')', left.length === 0);
    fs.copyFileSync(path.join(RV, 'ALU.v'), path.join(dir, 'ALU.v'));

    console.log('\n[6] Live runs');
    const steps2arch = t => arch(t);
    win.setHdlSimulator('icarus');
    check('Icarus keeps 200,000 cycles per run', doc.getElementById('hdlCycles').value === '200000');
    win.setHdlSimulator('verilator');
    check('Verilator defaults to 20,000,000', doc.getElementById('hdlCycles').value === '20000000');
    check('The waveform setting shows with Verilator', doc.getElementById('hdlLiveWaveRow').style.display === 'flex');
    win.setHdlDumpVcd(true);
    win.setHdlCycles(300000);
    win.resetAll();
    await win.loadExample('dip_led');
    win.setDipSwitches(0x00ad);
    // A fresh live run, with the switches moved while it runs.
    const liveRun = win.runHdlSimulation();
    await until(() => win.getHdlTrace() && win.getHdlTrace().steps.length > 20000, 60000);
    const movedAt = win.getHdlTrace().steps.length;
    win.setDipSwitches(0x0072);
    await liveRun;
    const lt = win.getHdlTrace();
    const st = win.hdlGetStim ? win.hdlGetStim() : null;
    console.log('    live run: ' + lt.budget + ' cycles, switches moved after ' + movedAt + ' instructions');
    check('A live run records to its cycle limit', lt.budget === 300000 && lt.steps.length > 250000);
    win.hdlSeek(lt.steps.length);
    check('The switch change took effect while it ran (LED 0x' + win.getLedState().toString(16) + ')', win.getLedState() === 0x72);
    check('…and is on the input timeline at the cycle the model applied it',
      lt.timeline.stim.length === 1 && lt.timeline.stim[0].value === 0x72 && lt.timeline.stim[0].cycle > 1000);
    const liveArch = steps2arch(lt);
    const replay = await win.hdlBuildTrace(300000, { quiet: true });
    check('A replay of that timeline from reset records the same run', !!replay && steps2arch(replay) === liveArch);
    check('Followed live flat out, the waveform stops at 20 MB and says so',
      consoleText(doc).some(l => /too fast to follow/.test(l)));
    check('The waveform was built on Pause and covers the last 50,000 cycles',
      !!win.getHdlLastVcd() && /#2500000\b|#25000\d{2}/.test(win.getHdlLastVcd().slice(0, 200000)) && win.parseVcd(win.getHdlLastVcd()).vars.length > 50);
    {
      // The model must stop writing it, not only the page stop reading it:
      // a dump left running fills /tmp at about 150 MB a second.
      const said = () => consoleText(doc).some(l => /too fast to follow/.test(l));
      win.setHdlCycles(20000000);
      win.resetAll();
      doc.getElementById('console').innerHTML = '';
      const flat = win.runHdlSimulation();
      await until(said, 60000);
      await sleep(500);                 // the model closes it at its next edge
      const id = win.eval('hdlLive && hdlLive.id');
      const size = async () => { const b = id && await win.rvNative.vlLiveRead(id, 'dump.vcd', 1); return b ? b.size : -1; };
      const s1 = await size();
      await sleep(1500);
      const s2 = await size();
      win.toggleRunPause();
      await flat;
      check('…and the model stops writing it (' + s1 + ' bytes, then ' + s2 + ')', s1 > 0 && s2 === s1 && s1 < 100e6);
      win.setHdlCycles(300000);
    }

    // Pause, paced to a slow clock.
    win.resetAll();
    win.setHdlCycles(2000000);
    win.setClkDivBits(16);                           // 1.53 kHz
    win.setRunPace('real');
    win.setHdlLiveWave('live');
    const paced = win.runHdlSimulation();
    await until(() => /running live/.test(doc.getElementById('statusBar').textContent), 120000);
    await sleep(1500);
    const midVcd = win.getHdlLastVcd();
    win.toggleRunPause();
    await paced;
    const pt = win.getHdlTrace();
    console.log('    paced to 1.53 kHz for about 1.5 s: ' + pt.budget + ' cycles');
    check('Real time paces the model to the clock (' + pt.budget + ' cycles in ~1.5 s at 1.53 kHz)', pt.budget > 1000 && pt.budget < 4000);
    check('Pause ends the run where it was', /paused/i.test(doc.getElementById('statusBar').textContent) || pt.budget < 4000);
    check('The waveform followed the run while it went', !!midVcd && midVcd.length > 0);

    // Without the architectural trace a live run still shows the peripherals as it goes.
    win.resetAll();
    win.setHdlDetail('fastest', true);
    win.setHdlCycles(50000000);
    win.setRunPace('real');
    win.setClkDivBits(0);
    win.setDipSwitches(0x0011);
    const noTrace = win.runHdlSimulation();
    await until(() => /running live/.test(doc.getElementById('statusBar').textContent), 120000);
    await sleep(800);
    win.setDipSwitches(0x0022);
    const ledLive = await until(() => win.getLedState() === 0x22, 5000);
    const statsNt = doc.getElementById('statsBar').textContent;
    win.toggleRunPause();
    await noTrace;
    check('With Detail Fastest (no trace) a live run still shows a switch change while it runs', ledLive);
    check('…and its fraction of real time is not stuck at 0 (' + (/×[\d.]+ real time/.exec(statsNt) || ['none'])[0] + ')',
      !/×0\.00 real time/.test(statsNt) && /Cycles: [1-9]/.test(statsNt));
    const ntEnd = win.getHdlTrace().budget;
    win.setHdlCycles(300000);
    const ntSeen = [];
    const ntWatch = setInterval(() => ntSeen.push(doc.getElementById('statusBar').textContent), 5);
    await win.runHdlSimulation();
    clearInterval(ntWatch);
    win.hdlSeek(0);
    check('Without the trace, Run carries on from where it paused (' + ntEnd + ' to ' + win.getHdlTrace().budget + ')',
      win.getHdlTrace().budget === ntEnd + 300000 && win.getLedState() === 0x22);
    check('…from a checkpoint', ntEnd < 400000 || ntSeen.some(s => /replaying cycles [\d,]+ to /.test(s)));
    win.setHdlCycles(50000000);
    win.setHdlDetail('full', true);

    // Paced to a clock it cannot reach, the stats say how far behind it is.
    win.resetAll();
    win.setHdlLiveWave('pause');
    win.setClkDivBits(0);                            // 100 MHz
    win.setRunPace('real');
    const fast = win.runHdlSimulation();
    await until(() => /running live/.test(doc.getElementById('statusBar').textContent), 120000);
    await sleep(2000);
    const lagText = doc.getElementById('statsBar').textContent;
    win.toggleRunPause();
    await fast;
    check('A live run behind its clock shows the fraction of real time (' + (/×[\d.]+ real time/.exec(lagText) || ['none'])[0] + ')',
      /×0\.\d+ real time/.test(lagText));
    win.resetAll();
    win.setClkDivBits(16);
    win.setHdlLiveWave('live');
    const paced2 = win.runHdlSimulation();
    await sleep(1500);
    win.toggleRunPause();
    await paced2;

    // Resume, flat out, from where the pause left it.
    win.setRunPace('max');
    win.setClkDivBits(5);
    win.setHdlLiveWave('pause');
    win.setHdlCycles(50000);
    const b0 = win.getHdlTrace().budget;
    await win.runHdlSimulation();
    const rt = win.getHdlTrace();
    check('Resume carries on from the end (' + b0 + ' to ' + rt.budget + ')', rt.budget === b0 + 50000);
    const resumedArch = steps2arch(rt);
    const replay2 = await win.hdlBuildTrace(rt.budget, { quiet: true });
    check('…joined onto the recording exactly as a run from reset', !!replay2 && steps2arch(replay2) === resumedArch);

    // A breakpoint stops a live run.
    win.resetAll();
    win.setHdlCycles(1000000);
    const srcLines = win.editor.value.split('\n');
    const bpLine = srcLines.findIndex(l => /^\s*sw\s+s4/.test(l)) + 1;
    win.toggleBreakpoint(bpLine);
    await win.runHdlSimulation();
    const bt = win.getHdlTrace();
    check('A breakpoint stops a live run on its line (' + bpLine + ')',
      bpLine > 0 && win.getHdlIndex() < bt.steps.length && win.sourceLineForPc(bt.steps[win.getHdlIndex()].pc) === bpLine);
    check('…long before the cycle limit (' + bt.budget + ')', bt.budget < 1000000);
    win.toggleBreakpoint(bpLine);

    // UART typed while it runs.
    win.resetAll();
    await win.loadExample('hello_world');
    win.setHdlCycles(2000000);
    const ur = win.runHdlSimulation();
    await until(() => win.getHdlTrace() && win.getHdlTrace().steps.length > 5000, 60000);
    doc.getElementById('uartInputMode').value = 'ascii';
    doc.getElementById('uartInputText').value = 'A\\r';
    win.sendUartInput();
    await sleep(800);
    win.toggleRunPause();
    await ur;
    const termEl = doc.getElementById('uartTerminal');
    const term = String(termEl.innerText || termEl.textContent || '');
    check('Typing into the UART console reaches the running model (' + JSON.stringify(term.slice(0, 40)) + ')', /Welcome|Hello|A/.test(term) && term.length > 5);
    check('…and the bytes are on the timeline', win.getHdlTrace().timeline.rx.length >= 2);

    // A long run keeps only the most recent part of its recording.
    win.resetAll();
    await win.loadExample('dip_led');
    win.setDipSwitches(0x00ad);
    win.setHdlCycles(5000000);
    const t5 = Date.now();
    const longRun = win.runHdlSimulation();
    await until(() => win.getHdlTrace() && (win.getHdlTrace().offset || 0) + win.getHdlTrace().steps.length > 3000000, 120000);
    win.setDipSwitches(0x0033);
    await longRun;
    const lg = win.getHdlTrace();
    console.log('    5,000,000 cycles live in ' + (Date.now() - t5) + ' ms; kept ' + lg.steps.length + ' instructions from ' + (lg.offset || 0));
    check('A run past 2,000,000 cycles does not stop', lg.budget === 5000000);
    check('…and keeps only the most recent part', lg.offset > 0 && lg.steps[lg.steps.length - 1].cyc - lg.steps[0].cyc <= 2500000);
    win.hdlSeek(lg.steps.length);
    const ledEnd = win.getLedState();
    const instr = (/Instr:\s*(\d+)/.exec(doc.getElementById('statsBar').innerHTML) || [])[1];
    check('The instruction count still counts from reset (' + instr + ')', +instr === lg.offset + lg.steps.length);
    win.hdlSeek(0);
    win.hdlSeek(lg.steps.length);
    check('Seeking back to the start of what is kept and forward again gives the same state (LED 0x' + ledEnd.toString(16) + ')',
      win.getLedState() === ledEnd && ledEnd === 0x33);
    // An input moved while paused replays from reset but joins on at the change.
    win.hdlSeek(lg.steps.length - 1000);
    const t6 = Date.now();
    doc.getElementById('statusBar').textContent = '';
    win.setDipSwitches(0x0044);
    await until(() => /re-simulated/.test(doc.getElementById('statusBar').textContent), 60000);
    await sleep(100);
    console.log('    switch moved near the end of a trimmed recording: replayed in ' + (Date.now() - t6) + ' ms');
    const rs = win.getHdlTrace();
    win.hdlSeek(rs.steps.length);
    check('…and the recording continues with the new switches (LED 0x' + win.getLedState().toString(16) + ')', win.getLedState() === 0x44);

    console.log('\n[7] Time through the page, Icarus against Verilator (model already built)');
    for (const vcd of [true, false]) {
      for (const [name, q] of [['Icarus', ic], ['Verilator', p]]) {
        q.win.setHdlDumpVcd(vcd);
        q.win.hdlDiscardTrace();
        await q.win.hdlStartTrace(2000);           // builds or reuses, outside the timing
        q.win.hdlDiscardTrace();
        const ms0 = Object.assign({}, q.timing.ms);
        const s = Date.now();
        const t = await q.win.hdlStartTrace(200000);
        const total = Date.now() - s;
        const sim = (q.timing.ms.vvp || 0) - (ms0.vvp || 0);
        console.log('    200,000 cycles, waveform ' + (vcd ? 'on ' : 'off') + ', ' + name.padEnd(9) + ': ' +
          total + ' ms' + (name === 'Icarus' ? ' (simulation ' + sim + ' ms)' : '') + ', ' + t.steps.length + ' instructions');
      }
    }
    check('Timing ran', true);

    console.log('\n[8] Checkpoints');
    const child = require('child_process').spawnSync(process.execPath, [__filename, '--checkpoints', dir, cache],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20 });
    process.stdout.write(child.stdout || '');
    const counts = /^checkpoints: (\d+) passed, (\d+) failed$/m.exec(child.stdout || '');
    check('(the checkpoint section ran to the end)', !!counts && child.status === 0);
    if (counts) { passed += +counts[1]; failed += +counts[2]; }

    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.error(e);
    failed++;
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
  console.log('\n===========================================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}, 500);
