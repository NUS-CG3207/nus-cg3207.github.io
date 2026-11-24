/*
 * Verilator in the desktop app, through the page's own HDL flow: the
 * Simulator setting, a build (cached by content), runs that record what
 * Icarus records, input changes and Resume, the Wrapper-only waveform, a
 * compile error, Reset during a build, and the status line during a build.
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
const RV = path.join(ROOT, 'RV');
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
function makePage(runner, folder, vl) {
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
        vlLiveRead: async (id, name) => vl.liveRead(id, name),
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

setTimeout(async () => {
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
    check('Icarus keeps 2,000 cycles per run', doc.getElementById('hdlCycles').value === '2000');
    win.setHdlSimulator('verilator');
    check('Verilator defaults to 1,000,000', doc.getElementById('hdlCycles').value === '1000000');
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
    check('The waveform was built on Pause and covers the last 50,000 cycles',
      !!win.getHdlLastVcd() && /#2500000\b|#25000\d{2}/.test(win.getHdlLastVcd().slice(0, 200000)) && win.parseVcd(win.getHdlLastVcd()).vars.length > 50);

    // Pause, paced to a slow clock.
    win.resetAll();
    win.setHdlCycles(2000000);
    win.setClkDivBits(16);                           // 1.53 kHz
    win.setRunPace('real');
    win.setHdlLiveWave('live');
    const paced = win.runHdlSimulation();
    await sleep(1500);
    const midVcd = win.getHdlLastVcd();
    win.toggleRunPause();
    await paced;
    const pt = win.getHdlTrace();
    console.log('    paced to 1.53 kHz for about 1.5 s: ' + pt.budget + ' cycles');
    check('Real time paces the model to the clock (' + pt.budget + ' cycles in ~1.5 s at 1.53 kHz)', pt.budget > 1000 && pt.budget < 4000);
    check('Pause ends the run where it was', /paused/i.test(doc.getElementById('statusBar').textContent) || pt.budget < 4000);
    check('The waveform followed the run while it went', !!midVcd && midVcd.length > 0);

    // Resume, flat out, from where the pause left it.
    win.setRunPace('max');
    win.setClkDivBits(5);
    win.setHdlLiveWave('pause');
    win.setHdlCycles(50000);
    const b0 = pt.budget;
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
