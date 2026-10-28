/*
 * Waveform strip - VCD parsing, cycle mapping and cursor lockstep.
 *
 * Two halves. The first feeds parseVcd() a small hand-written VCD, so the
 * parser's own behaviour (nested scopes, widths, x/z, value lookup) is
 * pinned down independently of any simulation. The second runs the REAL
 * Icarus/WASM pipeline over the unmodified RV/*.v sources to produce a
 * genuine VCD, and checks the things that only a real one can show: that
 * the hierarchy reaches into submodules, that the cycle divisor derived
 * from CLK matches the testbench's clock, and that the value the waveform
 * would draw under the cursor is the value the recorded trace says that
 * instruction has.
 *
 * jsdom cannot dynamic-import the Emscripten modules, so Icarus is driven
 * from Node - but the testbench and memory images fed to it are the ones
 * the page itself produced.
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
function check(label, cond) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

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
        setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {},
        lineTo() {}, stroke() {}, fill() {}, closePath() {}, fillText() {}, save() {},
        restore() {}, rect() {}, clip() {}, drawImage() {},
        createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
        putImageData() {},
        getImageData: () => ({ data: new Uint8Array(4) }),
        measureText: () => ({ width: 0 })
      });
    }
  }
});

const win = dom.window, doc = win.document;

// A minimal Icarus driver, mirroring what the page does.
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
  const realErr = errs.filter(l => !/system\.vpi|dynamic linking not enabled/.test(l)).join('\n');
  if (!vvpBytes && realErr) console.log('    compile diagnostics:\n' + realErr);

  return {
    ok: !!vvpBytes,
    // Returns stdout AND the VCD the run dumped, which is what this suite needs.
    async run(plusargs, memFiles) {
      const out = [];
      const vvp = await initVvp({ print: s => out.push(s), printErr: s => out.push(s) });
      vvp.FS.writeFile('/sim.vvp', vvpBytes);
      for (const name of Object.keys(memFiles)) vvp.FS.writeFile('/' + name, memFiles[name]);
      vvp.callMain(['/sim.vvp'].concat(plusargs || []));
      let vcd = null;
      try { vcd = vvp.FS.readFile('/dump.vcd', { encoding: 'utf8' }); } catch (e) { /* not requested */ }
      return { out: out.join('\n'), vcd };
    }
  };
}

// A deliberately awkward hand-written VCD: multi-line $timescale and $var
// (Icarus wraps both), a nested scope, a bus, and an x run.
const TOY_VCD = [
  '$date Tue Sep 8 2026 $end',
  '$version Icarus Verilog $end',
  '$timescale',
  '  1ps',
  '$end',
  '$scope module tb $end',
  '$var wire 1 ! CLK $end',
  '$var reg 1 " RESET $end',
  '$scope module dut $end',
  '$var wire 8 # DATA [7:0] $end',
  '$scope module inner $end',
  '$var',
  '  wire 4 $ DEEP [3:0]',
  '$end',
  '$upscope $end',
  '$upscope $end',
  '$upscope $end',
  '$enddefinitions $end',
  '#0',
  '$dumpvars',
  '0!',
  '1"',
  'bxxxxxxxx #',
  'bxxxx $',
  '$end',
  '#5',
  '1!',
  '#10',
  '0!',
  'b10101010 #',
  '#15',
  '1!',
  '0"',
  '#20',
  '0!',
  'b00001111 #',
  'b0110 $',
  '#25',
  '1!',
  '#30',
  '0!'
].join('\n');

setTimeout(async () => {
  try {
    console.log('===========================================================');
    console.log('📈 TESTING WAVEFORMS (VCD parsing + cursor lockstep)');
    console.log('===========================================================');

    // ---------------------------------------------------------------
    console.log('\n[1] parseVcd on a hand-written VCD');
    const p = win.parseVcd(TOY_VCD);

    check('$timescale is read across the line break', p.timescale === '1ps');
    check('all 4 variables are found', p.vars.length === 4);

    const paths = p.vars.map(v => v.path);
    check('top-level signals carry the scope name', paths.includes('tb.CLK') && paths.includes('tb.RESET'));
    check('a submodule signal carries its full dotted path', paths.includes('tb.dut.DATA'));
    check('a doubly-nested signal does too, even declared across lines',
      paths.includes('tb.dut.inner.DEEP'));

    check('widths are recorded', p.byPath.get('tb.CLK').width === 1 &&
      p.byPath.get('tb.dut.DATA').width === 8 && p.byPath.get('tb.dut.inner.DEEP').width === 4);
    check('$upscope pops back out (nothing lands under inner by mistake)',
      p.vars.filter(v => v.path.startsWith('tb.dut.inner.')).length === 1);

    check('the scope tree mirrors the hierarchy', (() => {
      const dut = p.root.children.get('tb') && p.root.children.get('tb').children.get('dut');
      return !!(dut && dut.children.get('inner'));
    })());

    check('endTime is the last timestamp', p.endTime === 30);

    // Value lookup
    const clk = p.byPath.get('tb.CLK').id;
    const data = p.byPath.get('tb.dut.DATA').id;
    check('a value before any change reads back as the initial dump',
      win.waveValueAt(p, clk, 0) === '0');
    check('value lookup takes the last change at or before the time',
      win.waveValueAt(p, clk, 7) === '1' && win.waveValueAt(p, clk, 12) === '0');
    check('a bus value is found the same way',
      win.waveValueAt(p, data, 12) === 'b10101010');
    check('a time past the end holds the final value',
      win.waveValueAt(p, data, 9999) === 'b00001111');

    check('a binary bus formats as hex', win.waveFormatValue('b10101010', 8) === 'aa');
    check('a narrower bus formats as hex too', win.waveFormatValue('b0110', 4) === '6');
    check('an all-x bus stays symbolic rather than reading as 0',
      win.waveFormatValue('bxxxxxxxx', 8) === 'x');
    check('a scalar passes through', win.waveFormatValue('1', 1) === '1');

    // Cycle divisor: CLK toggles every 5 units, so a period is 10.
    check('the cycle divisor comes from CLK\'s own period', win.waveTicksPerCycle(p) === 10);

    console.log('\n[2] A VCD with no CLK falls back rather than dividing by zero');
    const noClk = win.parseVcd([
      '$timescale 1ns $end', '$scope module tb $end',
      '$var wire 1 ! SOMETHING $end', '$upscope $end', '$enddefinitions $end',
      '#0', '0!', '#7', '1!'
    ].join('\n'));
    check('a sane default divisor is used', win.waveTicksPerCycle(noClk) === 10);
    check('the signal is still parsed', noClk.vars.length === 1);

    // ---------------------------------------------------------------
    console.log('\n[3] Dock availability follows the engine mode');
    // There is no toolbar button any more: in HDL mode the strip is always on
    // the page, folded to its own title bar when closed, and that bar is how it
    // comes back.
    const dockEl = doc.getElementById('waveDock');
    const foldBtn = doc.getElementById('waveFoldBtn');
    check('the toolbar button reads Waveform in HDL mode', (() => {
      win.setSimEngineMode('hdl'); const t = doc.getElementById('btnViz').textContent; win.setSimEngineMode('js'); return /Waveform/.test(t);
    })());
    win.setSimEngineMode('js');
    win.updateWaveAvailability();
    check('the strip is absent in JS mode', !doc.body.classList.contains('hdl-mode'));
    check('the strip is closed in JS mode', !doc.body.classList.contains('wave-open'));
    win.setSimEngineMode('hdl');
    check('present in HDL mode', doc.body.classList.contains('hdl-mode'));
    check('off leaves no inline height to fight the layout',
      doc.body.classList.contains('wave-open') || dockEl.style.flex === '');

    console.log('\n[4] Empty states say what to do instead of showing a blank canvas');
    win.setHdlDumpVcd(false);
    if (!doc.body.classList.contains('wave-open')) win.toggleWaveDock();
    const dock = doc.getElementById('waveDock');
    check('the strip opens', doc.body.classList.contains('wave-open'));
    check('with VCD off it says so and offers to turn it on',
      dock.classList.contains('wave-empty') &&
      /VCD/.test(doc.getElementById('waveNotice').textContent) &&
      !!doc.getElementById('waveNotice').querySelector('button'));
    win.setHdlDumpVcd(true);
    check('with VCD on but nothing run, it asks for a run',
      dock.classList.contains('wave-empty') &&
      /Run the program/.test(doc.getElementById('waveNotice').textContent));

    console.log('\n[4a] Registers and memory are read-only in HDL mode');
    // HDL state is replayed from the recording on every seek, so an edit would
    // be silently discarded on the next Step. It must not look editable.
    win.setSimEngineMode('js');
    win.updateRegisters();
    check('in JS mode register cells are editable',
      doc.querySelectorAll('#regBody .reg-editable').length > 0);
    doc.getElementById('memAddr').value = '00002000';
    doc.getElementById('memRows').value = '8';
    win.memGo('data');
    check('in JS mode data memory has editable cells',
      doc.querySelectorAll('#memView [contenteditable="true"], #memView .word-cell:not(.readonly-code)').length > 0);

    win.setSimEngineMode('hdl');
    win.updateRegisters();
    check('in HDL mode no register cell is editable',
      doc.querySelectorAll('#regBody .reg-editable').length === 0);
    check('and they say why', /Read-only in HDL mode/.test(
      doc.querySelector('#regBody .readonly-code').getAttribute('title')));
    win.memGo('data');
    check('in HDL mode data memory has no editable cell',
      doc.querySelectorAll('#memView [contenteditable="true"], #memView .word-cell:not(.readonly-code)').length === 0);
    check('memory says why too', /Read-only in HDL mode/.test(
      doc.querySelector('#memView .readonly-code').getAttribute('title') || ''));

    // Even if a stale row or a shortcut reaches an edit entry point.
    win.startRegEdit(doc.createElement('td'));
    check('the edit entry points refuse in HDL mode',
      /Read-only in HDL mode/.test(doc.getElementById('statusBar').textContent));

    // The legend must not still advertise "Editable" over cells that are not.
    const legendText = () => doc.querySelector('.mem-legend').textContent.replace(/\s+/g, ' ').trim();
    for (const seg of ['code', 'data', 'stack', 'mmio']) {
      win.memGo(seg);
      check(`the ${seg} legend drops the editability note in HDL mode`,
        !/Editable|Read only/.test(legendText()));
    }
    check('and its separator goes with it', doc.getElementById('memLegendSep').hidden === true);
    win.setSimEngineMode('js');
    win.memGo('data');
    check('back in JS mode the note returns', /Editable/.test(legendText()));
    check('and so does the separator', doc.getElementById('memLegendSep').hidden === false);
    win.setSimEngineMode('hdl');

    console.log('\n[4d] UART receive: one byte, and it can be lost');
    win.setSimEngineMode('js');
    win.setLanguageMode('asm');
    win.resetAll();
    const U = 0xFFFF0000;
    const rxValid = () => win.readMem(U + 0x00, 4, true) & 1;
    const rxRead  = () => win.readMem(U + 0x04, 4, false) & 0xFF;
    const st = () => win.getUartRxState();

    // Deliver straight into the holding register, bypassing the console UI.
    win.setUartSendMode('paste');
    check('nothing is waiting to begin with', rxValid() === 0 && st().full === false);
    check('a read with nothing waiting returns 0 and consumes nothing',
      rxRead() === 0 && st().full === false);

    // One byte in, one byte out.
    win.writeMem(U + 0x04, 0x41, 4);      // writing UART_RX queues a byte, as the panel does
    win.uartTickDelivery();
    check('after delivery the register holds it and RX_VALID is 1',
      st().full === true && st().byte === 0x41 && rxValid() === 1);
    check('reading the valid flag does not consume the byte',
      rxValid() === 1 && st().full === true);
    check('reading UART_RX returns the byte', rxRead() === 0x41);
    check('and clears RX_VALID', rxValid() === 0 && st().full === false);

    // Overrun: a byte arriving while one is unread is lost, oldest kept.
    win.writeMem(U + 0x04, 0x42, 4);
    win.uartTickDelivery();
    win.writeMem(U + 0x04, 0x43, 4);
    win.uartTickDelivery();
    check('a byte arriving while one is unread is dropped',
      st().full === true && st().byte === 0x42);
    check('the older byte is the one that survives, as TOP_Nexys keeps it',
      rxRead() === 0x42);
    check('the drop was counted so the console can report it',
      win.getUartRxState().dropped >= 1);

    win.resetAll();
    check('reset clears both sides',
      win.getUartRxState().full === false && win.getUartPending().length === 0);

    console.log('\n[4c] OLED double buffering');
    win.setSimEngineMode('js');
    win.setLanguageMode('asm');
    const OLED = 0xFFFF0000;
    const px = (c, r) => {
      const b = win.getOledBuffer();
      const i = (r * 96 + c) * 4;
      return [b[i], b[i + 1], b[i + 2]].join(',');
    };
    const draw = (c, r, v) => {
      win.writeMem(OLED + 0x20, c, 4);
      win.writeMem(OLED + 0x24, r, 4);
      win.writeMem(OLED + 0x28, v, 4);
    };
    const present = () => win.writeMem(OLED + 0x2C, 0x08, 4);

    win.resetAll();
    win.writeMem(OLED + 0x2C, 0x10, 4);          // 16-bit, vary_pixel_data
    draw(10, 10, 0xF800);
    check('before any present, a write shows immediately',
      px(10, 10) === '248,0,0');

    present();
    check('the first present leaves the drawn frame on screen',
      px(10, 10) === '248,0,0');

    draw(11, 10, 0x07E0);
    check('after a present, a new write is not on screen yet',
      px(11, 10) === '0,0,0');
    check('and the previous frame is untouched', px(10, 10) === '248,0,0');

    present();
    check('the second present shows it', px(11, 10) === '0,252,0');
    check('and the copy kept the pixel drawn before it', px(10, 10) === '248,0,0');

    // The whole point of the copy: partial updates keep working.
    draw(11, 10, 0x001F);
    present();
    check('a partial update leaves every other pixel alone',
      px(10, 10) === '248,0,0' && px(11, 10) === '0,0,248');

    // Bit 3 presents; it must not be taken as a mode.
    win.writeMem(OLED + 0x2C, 0x04, 4);          // 8-bit, autoadvance_col
    win.writeMem(OLED + 0x20, 0, 4);
    win.writeMem(OLED + 0x24, 20, 4);
    win.writeMem(OLED + 0x28, 0xE0, 4);
    present();
    win.writeMem(OLED + 0x28, 0x1C, 4);
    win.writeMem(OLED + 0x28, 0x03, 4);
    present();
    check('a present does not disturb the configured mode',
      px(0, 20) === '224,0,0' && px(1, 20) === '0,224,0' && px(2, 20) === '0,0,192');

    check('swap status lives at its own address, OLED_STATUS',
      win.readMem(OLED + 0x30, 4, true) === 0);
    check('OLED_CTRL stays write-only and is not the status register',
      win.readMem(OLED + 0x2C, 4, true) === 0x04);
    check('OLED_STATUS ignores writes, as a read-only register should', (() => {
      win.writeMem(OLED + 0x30, 0xFF, 4);
      return win.readMem(OLED + 0x30, 4, true) === 0;
    })());

    win.resetAll();
    check('reset goes back to a single blank page', px(10, 10) === '0,0,0');
    win.writeMem(OLED + 0x2C, 0x10, 4);          // reset cleared the mode too
    draw(10, 10, 0xF800);
    check('and a write shows immediately again after reset',
      px(10, 10) === '248,0,0');
    win.resetAll();

    console.log('\n[4b] Signal picker wiring');
    const picker = doc.getElementById('wavePicker');
    check('the picker starts hidden', picker.hidden === true);
    // Same specificity trap as .panel-find: a class selector setting
    // display:flex outranks the UA's [hidden] rule, so the closed state has
    // to be spelled out. jsdom does not cascade UA sheets, so assert the rule.
    check('CSS spells out the picker\'s closed state', html.includes('.wave-picker[hidden]'));
    check('the picker overlays rather than reflowing the strip',
      /\.wave-picker\s*\{[^}]*position:\s*absolute/.test(html));

    win.toggleWavePicker();
    check('+ Signal opens it', picker.hidden === false);
    check('the button marks itself active',
      doc.getElementById('waveAddBtn').classList.contains('active'));
    check('with no VCD it says where the list comes from',
      /VCD dump/.test(doc.getElementById('wavePickerList').textContent));
    win.toggleWavePicker();
    check('+ Signal closes it again', picker.hidden === true);

    check('zoom and fit controls exist',
      /onclick="waveZoom\(2\)"/.test(html) && /onclick="waveZoom\(0\.5\)"/.test(html) &&
      /onclick="waveFit\(\)"/.test(html));
    check('pan controls sit to the left of them',
      html.indexOf('onclick="wavePan(-1)"') < html.indexOf('onclick="wavePan(1)"') &&
      html.indexOf('onclick="wavePan(1)"') < html.indexOf('onclick="waveZoom(2)"'));
    check('the canvas advertises click, wheel and drag',
      /id="waveCanvas"[^>]*title="[^"]*[Cc]lick[^"]*wheel[^"]*drag/.test(html));

    // ---------------------------------------------------------------
    console.log('\n[5] A real Icarus run: submodule signals and cursor lockstep');
    win.hdlSetSources(DESIGN.map(n => ({ name: n, src: fs.readFileSync(path.join(RV, n), 'utf8') })));
    win.editor.value = [
      '.text', 'main:',
      '  addi t0, x0, 5',
      '  addi t1, x0, 7',
      '  add  t2, t0, t1',
      '  lui  t3, 0xFFFF0',
      '  sw   t2, 0x60(t3)',
      'halt:', '  jal  x0, halt'
    ].join('\n');
    win.assembleOnly();

    const tb = win.hdlBuildTestbench({ regBankPath: win.hdlDiscoverRegBank() });
    const icarus = await makeIcarus(tb);
    check('the generated testbench compiles', icarus.ok);

    if (icarus.ok) {
      const { out, vcd } = await icarus.run(['+CYCLES=60', '+TRACE=2', '+VCD'], win.hdlMemFiles());
      check('the run dumped a VCD', !!vcd && vcd.length > 0);

      const rp = win.parseVcd(vcd);
      check('the real VCD parses into signals', rp.vars.length > 50);
      check('its timescale is read', /ps|ns/.test(rp.timescale));

      // The whole point of $dumpvars(0, ...): everything, at every depth.
      const rpaths = rp.vars.map(v => v.path);
      check('the DUT\'s own ports are there', rpaths.some(s => /^cg3207_hdl_tb\.dut\.PC$/.test(s)));
      check('signals inside the core (dut.RV1) are there',
        rpaths.some(s => /^cg3207_hdl_tb\.dut\.RV1\./.test(s)));
      check('signals inside a submodule of the core (the ALU) are there',
        rpaths.some(s => /^cg3207_hdl_tb\.dut\.RV1\.ALU1\./.test(s)));
      const maxDepth = Math.max(...rp.vars.map(v => v.path.split('.').length));
      check('the hierarchy reaches at least 4 levels deep (got ' + maxDepth + ')', maxDepth >= 4);

      // Derived, not assumed: the testbench's clock is 10ns and the VCD is
      // in ps, so a cycle is 10000 ticks. Deriving it is what stops an
      // edited clock from silently sliding the cursor.
      const tpc = win.waveTicksPerCycle(rp);
      check('the cycle divisor is derived from the real CLK (got ' + tpc + ')',
        tpc === 10000 || tpc === 10);

      // Lockstep: at every recorded step, the PC the waveform holds at the
      // cursor's cycle must be the PC the trace attributes to that step.
      const trace = win.hdlParseTrace(out);
      check('the run recorded instructions', trace.steps.length >= 5);
      const pcVar = rp.byPath.get('cg3207_hdl_tb.dut.PC');
      check('PC is addressable by its full path', !!pcVar);
      if (pcVar && trace.steps.length) {
        let agree = 0, tested = 0;
        for (let i = 0; i < Math.min(6, trace.steps.length); i++) {
          const s = trace.steps[i];
          const raw = win.waveValueAt(rp, pcVar.id, s.cyc * tpc);
          const wave = win.waveFormatValue(raw, pcVar.width).padStart(8, '0');
          tested++;
          if (wave === s.pc.toString(16).padStart(8, '0')) agree++;
        }
        check(`the waveform's PC matches the trace's PC at every cursor cycle (${agree}/${tested})`,
          agree === tested && tested > 0);
      }

      // ---------------------------------------------------------------
      console.log('\n[6] Panning the viewport over that real VCD');
      // Hand the page the VCD the run just produced, so the viewport maths
      // runs against a real end cycle rather than an invented one.
      win.__vcdUnderTest = vcd;
      win.eval('hdlLastVcd = window.__vcdUnderTest; waveEnsureParsed();');
      const st = () => win.getWaveState();
      check('the page parsed the VCD it was handed', !!st().parsed);

      win.waveFit();
      const fitted = st();
      check('Fit starts at cycle 0', fitted.start === 0);
      const end = fitted.span - 1;
      check('Fit spans the whole run (got ' + fitted.span + ')', fitted.span > 20);

      win.waveSetSpan(10, 0);
      check('a 10-cycle window can be set at the left edge',
        st().span === 10 && st().start === 0);

      win.wavePan(1);
      check('one press right moves half a window', st().start === 5);
      win.wavePan(1);
      check('presses accumulate', st().start === 10);
      check('panning does not change the zoom', st().span === 10);
      win.wavePan(-1); win.wavePan(-1);
      check('panning back returns to where it started', st().start === 0);
      win.wavePan(-1);
      check('panning left at cycle 0 stops there rather than going negative',
        st().start === 0);

      for (let i = 0; i < 200; i++) win.wavePan(1);
      const far = st();
      check('panning right stops with the last cycle on screen (start ' +
        far.start + ' + span ' + far.span + ' vs end ' + end + ')',
        far.start + far.span - 1 >= end && far.start <= end);
      check('and never scrolls past it', far.start === Math.max(0, end - far.span + 1));
    }

    console.log('\n===========================================================');
    if (failed === 0) {
      console.log(`🎉 ALL ${passed} WAVEFORM TESTS PASSED!`);
      process.exit(0);
    } else {
      console.log(`💥 ${failed} WAVEFORM TEST(S) FAILED (${passed} passed)`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Waveform Test Failed:', err);
    process.exit(1);
  }
}, 800);
