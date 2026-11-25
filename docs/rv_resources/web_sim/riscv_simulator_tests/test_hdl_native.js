/*
 * The desktop app's native Icarus, through the page's own HDL flow.
 *
 * Two copies of the page run side by side in jsdom, each given the
 * window.rvNative bridge that electron/preload.js provides. One bridge runs
 * the native build (electron/hdl_native.js, the module the app's main process
 * uses); the other runs the vendored WASM build in Node, the way the page's
 * worker does. Both pages then do the same things - load the RV/ folder,
 * run, change a switch mid-recording - and their recordings and waveforms
 * must be identical. The folder picker's selection and re-reading are
 * checked on the native page, and so are runs recorded in chunks, which
 * take input while they run.
 *
 * Needs a native build: cd electron && npm run build:iverilog
 * (or HDL_NATIVE_DIR pointing at one).
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
const RV = require('./core_dir').coreDir('test_hdl_native');
const ENGINE = process.env.HDL_ENGINE_DIR || path.join(ROOT, 'vendor', 'verisim');
const { createRunner, findBinDir, readFolder } = require(path.join(ROOT, 'electron', 'hdl_native.js'));
const OS = { darwin: 'mac', win32: 'win' }[process.platform] || process.platform;
const NATIVE = findBinDir([process.env.HDL_NATIVE_DIR, path.join(ROOT, 'electron', 'iverilog', OS + '-' + process.arch)]);

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
function makePage(runner, folder) {
  const timing = { ms: {} };
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
      window.rvNative = {
        icarus: true, icarusVersion: 'test', platform: process.platform, rememberedFolder: null,
        async hdlRun(id, tool, files, args, opts) {
          const t0 = Date.now();
          try { return await runner.run(id, tool, files, args, opts); }
          finally { timing.ms[tool] = (timing.ms[tool] || 0) + Date.now() - t0; }
        },
        hdlKill: id => runner.kill(id),
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

setTimeout(async () => {
  try {
    console.log('===========================================================');
    console.log('🖥  NATIVE ICARUS (the desktop app) AGAINST ICARUS/WASM');
    console.log('===========================================================');
    if (!NATIVE) {
      check('A native Icarus build is present (cd electron && npm run build:iverilog, or set HDL_NATIVE_DIR)', false);
      throw new Error('no native build');
    }
    console.log('  native build: ' + NATIVE + ' (' + fs.readFileSync(path.join(NATIVE, 'VERSION'), 'utf8').trim() + ')');

    // A student's folder: the design, the course testbenches beside it, a
    // Vivado run folder holding a generated copy, and VHDL files.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvsim-folder-'));
    for (const f of fs.readdirSync(RV)) if (/\.(v|vhd)$/.test(f)) fs.copyFileSync(path.join(RV, f), path.join(dir, f));
    fs.mkdirSync(path.join(dir, 'proj.runs', 'synth_1'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'proj.runs', 'synth_1', 'RV_stub.v'), 'module RV(input CLK); endmodule\n');
    const folder = { next: dir };

    const nat = makePage(createRunner(NATIVE), folder);
    const wasm = makePage(wasmRunner(), folder);
    await sleep(1500);

    // --- 1. Picking the folder --------------------------------------
    console.log('\n[1] A folder loads what sits under Wrapper');
    for (const p of [nat, wasm]) await p.win.hdlPickFolder();
    const names = nat.win.getHdlFiles().map(f => f.name).sort();
    check('The ten design files are loaded (' + names.join(', ') + ')',
      names.join() === DESIGN.slice().sort().join());
    check('The testbenches beside them are left out, and the console names them',
      consoleText(nat.doc).some(l => /Left out 6 file/.test(l) && /test_Wrapper_DIP_to_LED\.v/.test(l)));
    check('The copy under proj.runs/ is not loaded',
      !nat.win.getHdlFiles().some(f => /RV_stub/.test(f.folderPath || '')));
    check('The sources note names the folder',
      new RegExp('10 loaded from ' + path.basename(dir) + ', Wrapper found')
        .test(nat.doc.getElementById('hdlSourcesNote').textContent));
    check('Picking a folder switches to HDL mode', nat.win.getSimEngineMode() === 'hdl');
    check('The folder button is offered', nat.doc.getElementById('hdlFolderBtn').style.display !== 'none');

    // --- 2. The same run, both engines --------------------------------
    console.log('\n[2] A run records the same thing on both engines');
    for (const p of [nat, wasm]) {
      await p.win.loadExample('dip_led');
      p.win.setDipSwitches(0x00ad);
    }
    const t0 = Date.now();
    const tn = await nat.win.hdlStartTrace(40000);
    const tNat = Date.now() - t0;
    const t1 = Date.now();
    const tw = await wasm.win.hdlStartTrace(40000);
    const tWasm = Date.now() - t1;
    console.log('    40,000 cycles from cold: native ' + tNat + ' ms ' + JSON.stringify(nat.timing.ms) +
      ', WASM ' + tWasm + ' ms ' + JSON.stringify(wasm.timing.ms));
    check('The native run produced a recording', !!tn && tn.steps.length > 1000);
    check('Both engines record the same ' + (tn ? tn.steps.length : 0) + ' instructions',
      !!tn && !!tw && JSON.stringify(tn.steps) === JSON.stringify(tw.steps));
    check('…and the same waveform',
      !!nat.win.getHdlLastVcd() && stripVcdDate(nat.win.getHdlLastVcd()) === stripVcdDate(wasm.win.getHdlLastVcd()));
    nat.win.hdlSeek(tn.steps.length);
    check('The LEDs show the switches (0x' + nat.win.getLedState().toString(16) + ')', nat.win.getLedState() === 0xad);

    // --- 3. A switch moved late in the recording ----------------------
    // The replay starts from a checkpoint, which the native vvp has to
    // save and restore exactly as the WASM one does.
    console.log('\n[3] An input change replays from a checkpoint');
    const at = Math.floor(tn.steps.length * 0.9);
    const before = [nat, wasm].map(p => p.win.getHdlTrace());
    for (const p of [nat, wasm]) { p.win.hdlSeek(at); p.doc.getElementById('console').innerHTML = ''; }
    const t2 = Date.now();
    nat.win.setDipSwitches(0x0072);
    await until(() => nat.win.getHdlTrace() !== before[0] && nat.win.getHdlTrace());
    const tResim = Date.now() - t2;
    wasm.win.setDipSwitches(0x0072);
    await until(() => wasm.win.getHdlTrace() !== before[1] && wasm.win.getHdlTrace());
    await sleep(200);
    const rn = nat.win.getHdlTrace(), rw = wasm.win.getHdlTrace();
    console.log('    native replay: ' + tResim + ' ms');
    check('The replay started from a checkpoint, not from reset',
      !consoleText(nat.doc).some(l => /from reset/.test(l)));
    check('Both engines record the same replay (' + rn.steps.length + ' instructions)',
      JSON.stringify(rn.steps) === JSON.stringify(rw.steps));
    nat.win.hdlSeek(rn.steps.length);
    check('The LEDs follow the new switches (0x' + nat.win.getLedState().toString(16) + ')',
      nat.win.getLedState() === 0x72);

    // --- 4. Editing a file in the folder -------------------------------
    console.log('\n[4] The folder is read again when the window regains focus');
    nat.doc.getElementById('console').innerHTML = '';
    nat.win.dispatchEvent(new nat.win.Event('focus'));
    check('Nothing changed, so nothing is reloaded and the recording stays',
      (await nat.win.hdlReadFolder()) === false && nat.win.getHdlTrace() === rn &&
      !consoleText(nat.doc).some(l => /Reloaded/.test(l)));
    fs.appendFileSync(path.join(dir, 'ALU.v'), '\n// edited\n');
    fs.mkdirSync(path.join(dir, 'old'));
    fs.writeFileSync(path.join(dir, 'old', 'ALU_backup.v'), fs.readFileSync(path.join(RV, 'ALU.v'), 'utf8'));
    nat.win.dispatchEvent(new nat.win.Event('focus'));
    await nat.win.hdlReadFolder();
    await sleep(50);
    const log4 = consoleText(nat.doc);
    check('An edited file is reloaded, and the console says which',
      log4.some(l => /Reloaded from .*ALU\.v changed/.test(l)));
    check('A second file declaring the same module is named in a warning',
      log4.some(l => /More than one file .* declares ALU \(ALU\.v, old\/ALU_backup\.v\)/.test(l)));
    check('The recording of the old sources is discarded', nat.win.getHdlTrace() === null);
    nat.win.hdlRemoveFile('ALU_backup.v');
    nat.doc.getElementById('console').innerHTML = '';
    nat.win.dispatchEvent(new nat.win.Event('focus'));
    await nat.win.hdlReadFolder();
    check('A file removed with × stays out when the folder is read again',
      !nat.win.getHdlFiles().some(f => f.name === 'ALU_backup.v'));

    // --- 5. Errors and cancellation -----------------------------------
    console.log('\n[5] Compile errors and Reset');
    nat.doc.getElementById('console').innerHTML = '';
    fs.writeFileSync(path.join(dir, 'ALU.v'), fs.readFileSync(path.join(RV, 'ALU.v'), 'utf8').replace(/endmodule/, 'endmodul'));
    const bad = await nat.win.hdlStartTrace(2000);
    check('A syntax error is reported with its file and line, and nothing runs',
      bad === null && consoleText(nat.doc).some(l => /ALU\.v:\d+: error/.test(l)));
    fs.copyFileSync(path.join(RV, 'ALU.v'), path.join(dir, 'ALU.v'));
    const long = nat.win.hdlStartTrace(5000000).then(t => ({ t }), e => ({ e }));
    await sleep(800);
    nat.win.hdlStopWorker();
    const ended = await long;
    check('Reset stops a native run as a cancellation', !!ended.e && ended.e.cancelled === true);
    if (process.platform !== 'win32') {
      await sleep(200);
      const vvp = path.join(NATIVE, 'vvp');
      const left = execSync('ps -eo args', { encoding: 'utf8' }).split('\n').filter(l => l.startsWith(vvp + ' '));
      check('…and leaves no vvp process behind', left.length === 0);
    }

    // --- 6. Resume, and the Wrapper-only waveform ----------------------
    // A checkpoint is taken 17 cycles before the end of every run, so a
    // Resume re-runs only the stretch it has to verify.
    console.log('\n[6] Resume from the checkpoint at the end; the Wrapper-only waveform');
    const vcdSame = (win, a, b) => {
      const p = win.parseVcd(a), q = win.parseVcd(b);
      return p.vars.length === q.vars.length && p.vars.every(v => {
        const c = p.changes.get(v.id) || { times: [], values: [] }, d = q.changes.get(v.id) || { times: [], values: [] };
        return c.times.join() === d.times.join() && c.values.join() === d.values.join();
      });
    };
    fs.rmSync(path.join(dir, 'old'), { recursive: true, force: true });
    const resumed = {};
    for (const [name, p] of [['native', nat], ['wasm', wasm]]) {
      p.win.setHdlWaveTop(true);
      p.win.hdlDiscardTrace();
      await p.win.hdlStartTrace(8000);
      const vars = p.win.parseVcd(p.win.getHdlLastVcd()).vars.map(v => v.path);
      if (name === 'native') {
        check('The Wrapper-only waveform keeps CLK, PC, Instr, LED_OUT and the register aliases',
          ['CLK', 'dut.PC', 'dut.Instr', 'LED_OUT', 'x5_t0'].every(s => vars.some(v => v === s || v.endsWith('.' + s))));
        check('…and nothing inside RV', !vars.some(v => /\.RV1\./.test(v)));
      }
      p.doc.getElementById('console').innerHTML = '';
      p.doc.getElementById('statusBar').textContent = '';
      const calls = [];
      const orig = p.win.rvNative.hdlRun;
      p.win.rvNative.hdlRun = (...a) => { calls.push(a); return orig(...a); };
      await p.win.hdlGrowTrace(10000);
      p.win.rvNative.hdlRun = orig;
      if (name === 'native') {
        const load = calls.filter(c => c[1] === 'vvp').map(c => c[3].find(x => /^\+CKLOAD=/.test(x)))[0];
        check('The Resume starts 17 cycles before the old end (' + load + ')', load === '+CKLOAD=7983');
      }
      const grown = { steps: JSON.stringify(p.win.getHdlTrace().steps), vcd: p.win.getHdlLastVcd() };
      p.win.hdlDiscardTrace();
      await p.win.hdlStartTrace(10000);
      resumed[name] = grown;
      if (name === 'native') {
        check('A Resume is the longer run from reset, recording and waveform',
          grown.steps === JSON.stringify(p.win.getHdlTrace().steps) && vcdSame(p.win, grown.vcd, p.win.getHdlLastVcd()));
      }
      p.win.setHdlWaveTop(false);
    }
    check('Both engines resume to the same recording', resumed.native.steps === resumed.wasm.steps);

    // --- 7. Run in chunks, taking input while it runs ---------------------
    console.log('\n[7] Run records in chunks and takes input while it runs');
    {
      const { win, doc } = nat;
      const st = () => doc.getElementById('statusBar').textContent;
      const archOf = t => JSON.stringify(t.steps.map(s => [s.cyc, s.pc, s.instr, s.regw, s.memw, s.per]));
      const fresh = async () => { win.resetAll(); await win.loadExample('dip_led'); win.setDipSwitches(0xad); };
      win.setHdlDumpVcd(false);
      win.setHdlWaveTop(false);
      win.setHdlCycles(100000);
      await fresh();
      const run = win.runHdlSimulation();
      check('Run shows its progress chunk by chunk', await until(() => /running - cycle/.test(st()), 60000));
      await until(() => win.getHdlTrace() && win.getHdlTrace().budget > 33000, 60000);
      win.setDipSwitches(0x72);
      const ledSoon = await until(() => win.getLedState() === 0x72, 5000);
      await run;
      let t = win.getHdlTrace();
      check('A switch moved while it runs takes effect while it runs', ledSoon);
      check('…and is on the timeline at the cycle shown (' + JSON.stringify(t.timeline.stim) + ')',
        t.timeline.stim.length === 1 && t.timeline.stim[0].cycle > 30000 && t.budget === 100000);
      const arch = archOf(t), stim = t.timeline.stim.slice();
      win.hdlDiscardTrace();
      win.hdlSetStim(stim);
      check('…and the recording is the one a run from reset with that timeline makes',
        archOf(await win.hdlBuildTrace(100000, { quiet: true })) === arch);

      await fresh();
      const r2 = win.runHdlSimulation();
      await until(() => win.getHdlTrace() && win.getHdlTrace().budget > 25000, 60000);
      // LED[8], the divided clock, blinks while it runs and is lit when not.
      const clk = () => doc.getElementById('led8').classList.contains('on');
      const blink = new Set();
      for (let i = 0; i < 40; i++) { blink.add(clk()); await sleep(20); }
      win.toggleRunPause();
      await r2;
      await sleep(100);
      check('The divided-clock LED blinks while it runs, and is lit once paused', blink.size === 2 && clk());
      const b1 = win.getHdlTrace().budget;
      check('Pause stops it part-way (' + b1 + ')', b1 < 100000 && /paused/.test(st()));
      await win.runHdlSimulation();
      check('Run then carries on for another Cycles per Run', win.getHdlTrace().budget === b1 + 100000);

      await fresh();
      const bpLine = win.editor.value.split('\n').findIndex(l => /^\s*sw\s+s4/.test(l)) + 1;
      win.toggleBreakpoint(bpLine);
      await win.runHdlSimulation();
      await sleep(300);
      t = win.getHdlTrace();
      check('A breakpoint stops it on its line, in the first chunk (' + t.budget + ' cycles)',
        bpLine > 0 && win.sourceLineForPc(t.steps[win.getHdlIndex()].pc) === bpLine && t.budget < 100000);
      win.toggleBreakpoint(bpLine);

      await fresh();
      win.setClkDivBits(16);                         // 1.53 kHz
      win.setRunPace('real');
      const r3 = win.runHdlSimulation();
      await until(() => /running - cycle/.test(st()), 60000);
      await sleep(1500);
      const shownAt = win.getHdlTrace().steps[win.getHdlIndex()].cyc;
      win.setDipSwitches(0x5a);
      const ledRt = await until(() => win.getLedState() === 0x5a, 3000);
      win.toggleRunPause();
      await r3;
      check('At Real time it is shown at the clock (cycle ' + shownAt + ' after about 1.5 s)', shownAt > 1000 && shownAt < 5000);
      check('…and a switch moved then shows within 3 s', ledRt);
      win.setRunPace('max');
      win.setClkDivBits(5);

      await fresh();
      win.setHdlTrace(false);
      const r4 = win.runHdlSimulation();
      await until(() => win.getHdlTrace() && win.getHdlTrace().budget > 33000, 60000);
      win.setDipSwitches(0x33);
      const ledNt = await until(() => win.getLedState() === 0x33, 5000);
      await r4;
      check('Without the trace too', ledNt);
      check('…and the summary leaves out an instruction count it does not have', !/0 instructions/.test(st()) && /100,000 cycles/.test(doc.body.textContent));
      win.setHdlTrace(true);

      await fresh();
      win.setHdlDumpVcd(true);
      win.setHdlWaveTop(true);
      win.setHdlCycles(20000);
      await win.runHdlSimulation();
      const wv = win.getHdlLastVcd(), wa = archOf(win.getHdlTrace());
      win.hdlDiscardTrace();
      await win.hdlBuildTrace(20000, { quiet: true });
      check('With the waveform on, a run in chunks records the waveform and recording one run would',
        wa === archOf(win.getHdlTrace()) && vcdSame(win, wv, win.getHdlLastVcd()));

      // A longer run keeps only about the last 50,000 cycles of the
      // waveform, and what it keeps is what a run from reset records there.
      // What the page shows while it runs is carried on from one chunk to the
      // next; it must be what showing that point from scratch shows.
      await fresh();
      win.setHdlCycles(90000);
      const seen = [];
      const r5 = win.runHdlSimulation();
      await until(() => {
        const t = win.getHdlTrace();
        if (t && win.getHdlIndex() > 0 && t.budget > 25000 * (seen.length + 1))
          seen.push({ i: win.getHdlIndex(), regs: Array.from(win.getRegs()).join(), led: win.getLedState() });
        return seen.length >= 3;
      }, 120000);
      await r5;
      const again = seen.map(s => { win.hdlSeek(s.i); return Array.from(win.getRegs()).join() === s.regs && win.getLedState() === s.led; });
      check('What it shows while it runs is that point of the recording (' + seen.map(s => s.i).join(', ') + ')',
        seen.length === 3 && again.every(Boolean));
      const span = v => {
        const p = win.parseVcd(v), tick = win.waveTicksPerCycle(p);
        const at = +/\$enddefinitions[\s\S]*?^#(\d+)$/m.exec(v)[1];
        return { p, at, cycles: (p.endTime - at) / tick };
      };
      const ch = span(win.getHdlLastVcd());
      win.hdlDiscardTrace();
      await win.hdlBuildTrace(90000, { quiet: true });
      const rs = span(win.getHdlLastVcd());
      const from = Math.max(ch.at, rs.at);
      const tailOf = (p, id) => {
        const c = p.changes.get(id) || { times: [], values: [] };
        let k = 0;
        while (k < c.times.length && c.times[k] <= from) k++;
        return (k ? c.values[k - 1] : '') + '|' + c.times.slice(k).join() + '|' + c.values.slice(k).join();
      };
      check('A 90,000-cycle run keeps the waveform of its last ' + Math.round(ch.cycles) + ' cycles',
        ch.cycles >= 50000 && ch.cycles <= 62500 && rs.cycles >= 50000 && rs.cycles <= 62500);
      check('…the same as a run from reset over the cycles both keep',
        ch.p.vars.length === rs.p.vars.length && ch.p.vars.every(v => tailOf(ch.p, v.id) === tailOf(rs.p, v.id)));
      win.setHdlWaveTop(false);
    }

    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.error(e);
    failed++;
  }
  console.log('\n===========================================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}, 500);
