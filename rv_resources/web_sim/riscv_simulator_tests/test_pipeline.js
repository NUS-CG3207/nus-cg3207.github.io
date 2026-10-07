// test_pipeline.js
// The 5-stage pipeline is a cycle-accurate model of the lecture's pipelined
// processor: values flow through the D/E/M/W registers and the hazard unit
// decides forwarding, stalls and flushes each cycle. With every switch
// on it must compute exactly what the functional model computes; with one
// off it must compute the wrong answer that hardware would. These checks hold
// it to both, to the textbook cycle counts for the classic hazards, and
// walk Step, Back, Run and breakpoints through it.

const fs = require('fs');
const path = require('path');
const { installExamplesFetch } = require('./examples_fetch');
let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM;
}

console.log('===========================================================');
console.log('🚀 TESTING THE 5-STAGE PIPELINE');
console.log('===========================================================');

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../riscv_simulator.html'), 'utf8');
const CM6_BUNDLE_SOURCE = fs.readFileSync(path.resolve(__dirname, 'cm6_bundle.min.js'), 'utf8');

const dom = new JSDOM(htmlContent, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost:8080/riscv_simulator.html',
  beforeParse(window) {
    window.__CM6_DISABLE_CDN = true;
    window.addEventListener('DOMContentLoaded', () => {
      try { window.eval(CM6_BUNDLE_SOURCE); } catch (e) { console.error('CM6 inject failed:', e.message); }
    });
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
    window.Range.prototype.getClientRects = () => [];
    window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.Element.prototype.getClientRects = () => [];
    window.Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.HTMLCanvasElement.prototype.getContext = () => ({
      createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
      putImageData: () => {}, fillRect: () => {}, clearRect: () => {}
    });
    installExamplesFetch(window);
  }
});

const win = dom.window;
const doc = win.document;
let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { console.log('  ✅ ' + name); passed++; }
  else { console.log('  ❌ ' + name + (detail ? ' - ' + detail : '')); failed++; }
}
const ev = (src) => win.eval(src);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function assembleSrc(src) {
  win.setLanguageMode('asm');
  win.editor.value = src;
  win.assembleOnly();
  return ev('assembled');
}

function setPipe(on, haz, bp) {
  ev(`jsArch = '${on ? 'pipe' : 'single'}'; pipeMode = ${!!on}; pipeHaz = Object.assign({}, PIPE_HAZ_DEFAULT, ${JSON.stringify(haz || {})});
      pipeBP = Object.assign({}, PIPE_BP_DEFAULT, ${JSON.stringify(bp || {})})`);
}

// Run the pipeline from reset until it finishes; returns the cycle count.
function runPipe(cap = 20000) {
  ev('resetAll()');
  let c = 0;
  while (!ev('pipeDone()') && c++ < cap) ev('pipeStep()');
  return ev('totalCycles');
}

// Every kind of dependency the hazard unit handles, every instruction the
// datapath carries, and some it hands to the functional model.
const HAZ = `
.data
buf:   .word 11, -22, 0x80000001, 0, 0, 0, 0, 0
bytes: .byte 0x81, 0x7f, 0x01, 0xfe
.text
main:
    la s0, buf
    la s1, bytes
    lw t0, 0(s0)
    add t1, t0, t0          # load-use
    lw t2, 4(s0)
    sw t2, 12(s0)           # lw then sw of the same register
    addi t3, t1, 1
    sub t4, t3, t1          # from M
    xor t5, t3, t4          # from M and from W
    or  t6, t5, t3          # from W and from the register file
    lb a1, 0(s1)
    lbu a2, 0(s1)
    lh a3, 2(s1)
    lhu a4, 2(s1)
    add a5, a1, a2          # load-use on a byte load
    sb a5, 16(s0)
    sh a3, 20(s0)
    lui a6, 0xABCDE
    addi a6, a6, 0x123      # uses lui's result from M
    auipc a7, 0x10
    sub a7, a7, a6
    li t0, 7
    li t1, -3
    mul s2, t0, t1
    mulh s3, s2, t1
    mulhsu s4, s2, t1
    mulhu s5, s2, t1
    div s6, s2, t0
    divu s7, s2, t0
    rem s8, s2, t1
    remu s9, s2, t1
    div s10, t0, x0         # by zero
    li t2, 5
loop:
    addi t2, t2, -1
    add s11, s11, t2
    bnez t2, loop           # compares a value forwarded from M
    lw t3, 8(s0)
    beq t3, t3, over        # load-use into a branch
    li s11, 999
over:
    jal ra, func
    la t4, func2
    sw t4, 24(s0)
    lw t5, 24(s0)
    jalr ra, 0(t5)          # load-use into jalr
    fcvt.s.w ft0, t0        # FP goes through the functional model
    fadd.s ft1, ft0, ft0
    fcvt.w.s a0, ft1
    addi a0, a0, 1          # uses what the serial instruction wrote
    addi t6, s0, 28
    li t0, 40
    amoadd.w t1, t0, (t6)   # so do atomics
    lw t2, 28(s0)
    li a7, 1
    mv a0, t2
    ecall                   # print_int needs a0 from the instruction before
    j done
func:
    addi s1, s1, 100
    ret                     # ra from W, the jal two instructions back
func2:
    addi s2, s2, 1
    jalr x0, 0(ra)
done:
    li a7, 10
    ecall
`;

setTimeout(async () => {
  try {
    // Before anything has opened Settings: its microarchitecture controls act
    // from the start, including from the strip's ⚙ shortcut.
    const bpBox = doc.getElementById('pipeBpOn');
    bpBox.checked = true;
    bpBox.dispatchEvent(new win.Event('change'));
    const archSel = doc.getElementById('simMicroarch');
    archSel.value = 'multi';
    archSel.dispatchEvent(new win.Event('change'));
    check('Settings\' pipeline and microarchitecture controls work before Settings is ever opened',
      ev('pipeBP.on') === true && ev('jsArch') === 'multi');
    bpBox.checked = false;
    bpBox.dispatchEvent(new win.Event('change'));
    archSel.value = 'single';
    archSel.dispatchEvent(new win.Event('change'));

    // [1] All switches on: the pipeline computes what the functional model does.
    console.log('\n[1] With every hazard switch on, the pipeline matches the functional model');
    setPipe(false);
    if (!assembleSrc(HAZ)) throw new Error('hazard program did not assemble');
    const done = ev('labels.done');
    const fTrace = [JSON.stringify(Array.from(ev('regs')))];
    let guard = 0;
    while (ev('pc') !== done && guard++ < 2000) {
      const n = ev('instructionCount');
      win.executeOne();
      if (ev('instructionCount') !== n) fTrace.push(JSON.stringify(Array.from(ev('regs'))));
    }
    const fRegs = Array.from(ev('regs'));
    fRegs[17] = 10;   // the pipeline also runs done's li a7, 10
    const fMem = ev('Array.from({length: 12}, (_, i) => readMem(labels.buf + 4 * i, 4, true))');
    const fFp = ev('Array.from(fpBits)');

    for (const stall of ['all switches on']) {
      setPipe(true);
      ev('resetAll()');
      let bad = null, c = 0;
      while (!ev('pipeDone()') && c++ < 5000) {
        ev('pipeStep()');
        const n = ev('instructionCount');
        const r = JSON.stringify(Array.from(ev('regs')));
        if (n < fTrace.length && r !== fTrace[n] && !bad) bad = `after instruction ${n}, cycle ${c}`;
      }
      check(`[${stall} stall] every retirement leaves the registers the functional model has`, !bad, bad);
      check(`[${stall} stall] the program exits through its ecall`, ev('pipe.exited') === true);
      check(`[${stall} stall] final registers match`, JSON.stringify(Array.from(ev('regs'))) === JSON.stringify(fRegs));
      check(`[${stall} stall] data memory matches`,
        JSON.stringify(ev('Array.from({length: 12}, (_, i) => readMem(labels.buf + 4 * i, 4, true))')) === JSON.stringify(fMem));
      check(`[${stall} stall] FP registers match`, JSON.stringify(ev('Array.from(fpBits)')) === JSON.stringify(fFp));
      check(`[${stall} stall] retired the same instructions, plus the two that exit`,
        ev('instructionCount') === fTrace.length + 1, ev('instructionCount') + ' vs ' + (fTrace.length + 1));
    }

    // The bundled examples, which poll peripherals forever: registers after
    // each of their first 1500 retirements.
    const exDir = path.resolve(__dirname, '../examples/asm');
    for (const f of ['HelloWorld.asm', 'DIP_to_LED.asm', 'Circle_delay_accel.asm', 'ImageDisplay_autoadvance_accel.asm']) {
      setPipe(false);
      assembleSrc(fs.readFileSync(path.join(exDir, f), 'utf8'));
      const trace = [JSON.stringify(Array.from(ev('regs')))];
      for (let i = 0; i < 1500; i++) {
        const n = ev('instructionCount');
        win.executeOne();
        if (ev('instructionCount') !== n) trace.push(JSON.stringify(Array.from(ev('regs'))));
      }
      setPipe(true);
      ev('resetAll()');
      let bad = null, c = 0;
      while (ev('instructionCount') < trace.length - 1 && c++ < 8000) {
        ev('pipeStep()');
        const n = ev('instructionCount');
        if (JSON.stringify(Array.from(ev('regs'))) !== trace[n]) { bad = `instruction ${n}, cycle ${c}`; break; }
      }
      check(`${f}: ${trace.length - 1} retirements match`, !bad && ev('instructionCount') === trace.length - 1, bad);
    }

    // [2] The classic scenarios, cycle for cycle. A program of n instructions
    // with no hazards takes n + 4 cycles to drain.
    console.log('\n[2] Cycle counts for the classic hazards');
    const DATA = '.data\nbuf: .word 5, 0\n.text\nmain: la s0, buf\n';   // la is 2 instructions
    setPipe(true);
    assembleSrc(DATA + '    addi t0, x0, 1\n    addi t1, x0, 2\n    add t2, t0, t1\n');
    check('5 instructions with only forwarded dependencies: 5 + 4 cycles', runPipe() === 9, ev('totalCycles'));
    check('and the result is right', ev('regs[7]') === 3);

    assembleSrc(DATA + '    lw t0, 0(s0)\n    add t1, t0, t0\n');
    check('lw then a use: one stall cycle (4 + 4 + 1)', runPipe() === 9, ev('totalCycles'));
    check('and the use gets the loaded value', ev('regs[6]') === 10);

    assembleSrc(DATA + '    lw t0, 0(s0)\n    nop\n    add t1, t0, t0\n');
    check('lw, one instruction, then a use: no stall', runPipe() === 9, ev('totalCycles'));

    assembleSrc(DATA + '    beq x0, x0, t\n    addi a0, x0, 1\n    addi a0, x0, 2\nt:  addi a1, x0, 3\n');
    check('a taken branch flushes two: 4 retire, in 4 + 4 + 2 cycles',
      runPipe() === 10 && ev('instructionCount') === 4, ev('totalCycles') + ' cycles, ' + ev('instructionCount') + ' retired');
    check('and neither flushed instruction wrote', ev('regs[10]') === 0 && ev('regs[11]') === 3);

    assembleSrc(DATA + '    bne x0, x0, t\n    addi a0, x0, 1\nt:  addi a1, x0, 3\n');
    check('a branch not taken costs nothing', runPipe() === 9, ev('totalCycles'));

    assembleSrc(DATA + '    jal ra, t\n    addi a0, x0, 1\nt:  addi a1, x0, 3\n');
    check('jal is resolved in Execute too: two flushed', runPipe() === 10, ev('totalCycles'));

    // The hazard unit's own signals.
    assembleSrc(DATA + '    addi t0, x0, 7\n    add t1, t0, x0\n    add t2, t0, x0\n    add t3, t0, x0\n');
    ev('resetAll()');
    const sigs = [];
    for (let i = 0; i < 10; i++) { sigs.push(JSON.parse(ev('JSON.stringify(pipeEvaluate())'))); ev('pipeStep()'); }
    check('distance 1: ForwardAE = 10, from M', sigs.some(s => s.forwardAE === '10'));
    check('distance 2: ForwardAE = 01, from W', sigs.some(s => s.forwardAE === '01'));
    check('distance 3: Forward1D, W to D', sigs.some(s => s.forward1D));
    check('all three read 7', ev('regs[6]') === 7 && ev('regs[7]') === 7 && ev('regs[28]') === 7);

    assembleSrc(DATA + '    lw t0, 0(s0)\n    sw t0, 4(s0)\n');
    setPipe(true);
    ev('resetAll()');
    let sawM = false;
    while (!ev('pipeDone()')) { if (ev('pipeEvaluate().forwardM')) sawM = true; ev('pipeStep()'); }
    check('lw then sw of the loaded value: no stall, ForwardM copies it', ev('totalCycles') === 8 && sawM, ev('totalCycles'));
    check('and memory gets the loaded word', ev('readMem(labels.buf + 4, 4, true)') === 5);
    assembleSrc(DATA + '    lw t0, 0(s0)\n    sw x0, 4(t0)\n');
    check('lw then sw using it as the address: that one stalls', runPipe() === 9, ev('totalCycles'));
    assembleSrc(DATA + '    lw x0, 0(s0)\n    add t1, x0, x0\n');
    check('a load into x0 stalls nothing', runPipe() === 8, ev('totalCycles'));
    assembleSrc(DATA + '    lw t0, 0(s0)\n    lui t1, 0x28\n');   // lui's imm puts x5 in its rs1 field
    check('nor does an instruction whose register field only looks like a match', runPipe() === 8, ev('totalCycles'));

    // [3] Each switch, turned off, gives the answer that hardware would.
    console.log('\n[3] Each hazard switch off gives the wrong answer the hardware would');
    assembleSrc(DATA + '    addi t0, x0, 5\n    add t1, t0, t0\n');
    setPipe(true, { fwdE: false });
    runPipe();
    check('no E forwarding: add reads t0 before addi has written it (0)', ev('regs[6]') === 0, ev('regs[6]'));

    assembleSrc(DATA + '    addi t0, x0, 5\n    nop\n    nop\n    add t1, t0, t0\n');
    setPipe(true, { fwdD: false });
    runPipe();
    check('no W-to-D forwarding: distance 3 reads the old register (0)', ev('regs[6]') === 0, ev('regs[6]'));
    setPipe(true);
    runPipe();
    check('with it: 10', ev('regs[6]') === 10);

    assembleSrc(DATA + '    lw t0, 0(s0)\n    add t1, t0, t0\n');
    setPipe(true, { lwStall: false });
    runPipe();
    const addr = ev('labels.buf');
    check('no load-use stall: add is forwarded the address from ALUResultM, not the data',
      (ev('regs[6]') >>> 0) === ((2 * addr) >>> 0), ev('regs[6]'));

    assembleSrc(DATA + '    lw t0, 0(s0)\n    sw t0, 4(s0)\n');
    setPipe(true, { fwdM: false });
    runPipe();
    check('no mem-mem copy: sw is forwarded the load\'s address from ALUResultM and stores that',
      ev('readMem(labels.buf + 4, 4, true)') === ev('labels.buf'), ev('readMem(labels.buf + 4, 4, true)'));

    assembleSrc(DATA + '    beq x0, x0, t\n    addi a0, a0, 1\n    addi a0, a0, 1\nt:  addi a1, x0, 3\n');
    setPipe(true, { flush: false });
    runPipe();
    check('no branch flush: both instructions behind a taken branch execute (a0 = 2)', ev('regs[10]') === 2, ev('regs[10]'));

    // [3c] Branch prediction.
    console.log('\n[3c] Branch prediction');
    for (const bp of [{ on: true }, { on: true, bits: 2 }, { on: true, entries: 4 }]) {
      setPipe(false);
      assembleSrc(HAZ);
      const tr = [JSON.stringify(Array.from(ev('regs')))];
      while (ev('pc') !== ev('labels.done')) { const n = ev('instructionCount'); win.executeOne(); if (ev('instructionCount') !== n) tr.push(JSON.stringify(Array.from(ev('regs')))); }
      setPipe(true, {}, bp);
      ev('resetAll()');
      let bad = null, c = 0;
      while (!ev('pipeDone()') && c++ < 5000) {
        ev('pipeStep()');
        const n = ev('instructionCount');
        if (n < tr.length && JSON.stringify(Array.from(ev('regs'))) !== tr[n] && !bad) bad = `instruction ${n}, cycle ${c}`;
      }
      check(`${JSON.stringify(bp)}: every retirement matches the functional model`, !bad && ev('pipe.exited'), bad);
    }
    for (const f of ['HelloWorld.asm', 'DIP_to_LED.asm', 'Circle_delay_accel.asm']) {
      setPipe(false);
      assembleSrc(fs.readFileSync(path.resolve(__dirname, '../examples/asm', f), 'utf8'));
      const tr = [JSON.stringify(Array.from(ev('regs')))];
      for (let i = 0; i < 1500; i++) { const n = ev('instructionCount'); win.executeOne(); if (ev('instructionCount') !== n) tr.push(JSON.stringify(Array.from(ev('regs')))); }
      setPipe(true, {}, { on: true, bits: 2, entries: 4 });
      ev('resetAll()');
      let bad = null, c = 0;
      while (ev('instructionCount') < tr.length - 1 && c++ < 8000) {
        ev('pipeStep()');
        if (JSON.stringify(Array.from(ev('regs'))) !== tr[ev('instructionCount')]) { bad = `instruction ${ev('instructionCount')}`; break; }
      }
      check(`${f}, 2-bit, 4 entries: ${tr.length - 1} retirements match`, !bad, bad);
    }
    // Ten times round a two-instruction loop: 24 instructions, 4 cycles to drain.
    const LOOP = DATA + '    li t0, 10\nloop: addi t0, t0, -1\n    bnez t0, loop\n    addi a0, x0, 1\n';
    assembleSrc(LOOP);
    setPipe(true);
    check('no prediction: nine taken branches cost two cycles each (24 + 4 + 18)', runPipe() === 46, ev('totalCycles'));
    setPipe(true, {}, { on: true });
    check('1-bit: the first taken and the exit mispredict (24 + 4 + 4)', runPipe() === 32 && ev('pipe.mispredicts') === 2,
      ev('totalCycles') + ' cycles, ' + ev('pipe.mispredicts') + ' mispredicts');
    check('and the loop gives the right answer', ev('regs[5]') === 0 && ev('regs[10]') === 1);
    setPipe(true, {}, { on: true, bits: 2 });
    check('2-bit from 00: two to warm up, one at the exit (24 + 4 + 6)', runPipe() === 34 && ev('pipe.mispredicts') === 3,
      ev('totalCycles') + ' cycles, ' + ev('pipe.mispredicts') + ' mispredicts');

    // An inner loop entered twice: 1-bit pays at every exit and re-entry, 2-bit only at exits.
    const NEST = DATA + '    li s1, 2\nouter: li t0, 4\ninner: addi t0, t0, -1\n    bnez t0, inner\n    addi s1, s1, -1\n    bnez s1, outer\n';
    assembleSrc(NEST);
    setPipe(true, {}, { on: true }); runPipe();
    const m1 = ev('pipe.mispredicts');
    setPipe(true, {}, { on: true, bits: 2 }); runPipe();
    const m2 = ev('pipe.mispredicts');
    check('a nested loop: 1-bit mispredicts 6 times, 2-bit 5, saving the inner re-entry', m1 === 6 && m2 === 5, m1 + ' vs ' + m2);

    assembleSrc(DATA + '    li t0, 3\nl:  addi t0, t0, -1\n    beqz t0, e\n    j l\ne:  addi a0, x0, 1\n');
    setPipe(true, {}, { on: true }); runPipe();
    check('a j backwards is learnt: it mispredicts once, then is free', ev('regs[10]') === 1 && ev('pipe.mispredicts') === 2,
      ev('pipe.mispredicts'));

    assembleSrc(DATA + '    jal ra, f\n    jal ra, f\n    j e\nf:  ret\ne:  addi a0, x0, 1\n');
    setPipe(true, {}, { on: true }); runPipe();
    const seen = [];
    ev('resetAll()');
    while (!ev('pipeDone()')) { const sg = JSON.parse(ev('JSON.stringify(pipeEvaluate())')); if (sg.btaMiss) seen.push(sg.pcNextE); ev('pipeStep()'); }
    check('a ret back to a different caller is a BTA misprediction', seen.length >= 1 && ev('regs[10]') === 1, JSON.stringify(seen));

    // Four entries, and a loop body five words long: the branch shares its
    // entry with the loop's first instruction, and they overwrite each other.
    const ALIAS = DATA + '    li t0, 5\nl:  addi t0, t0, -1\n    nop\n    nop\n    nop\n    bnez t0, l\n    addi a0, x0, 1\n';
    assembleSrc(ALIAS);
    setPipe(true, {}, { on: true, entries: 16 }); runPipe();
    const m16 = ev('pipe.mispredicts');
    setPipe(true, {}, { on: true, entries: 4 }); runPipe();
    const m4 = ev('pipe.mispredicts');
    check('16 entries: the loop mispredicts only on entry and exit', m16 === 2, m16);
    check('4 entries, untagged: the branch and the addi sharing its entry ping-pong, twice an iteration',
      m4 > 2 * 3 && ev('regs[10]') === 1 && ev('regs[5]') === 0, m4);

    assembleSrc(LOOP);
    setPipe(true, {}, { on: true });
    ev('resetAll()');
    for (let i = 0; i < 12; i++) win.stepOnce();
    const bht12 = ev('JSON.stringify([Array.from(pipe.bht.pr), Array.from(pipe.bht.bta), pipe.mispredicts])');
    for (let i = 0; i < 8; i++) win.stepOnce();
    for (let i = 0; i < 8; i++) win.stepBack();
    check('Back restores the BHT and the mispredict count',
      ev('JSON.stringify([Array.from(pipe.bht.pr), Array.from(pipe.bht.bta), pipe.mispredicts])') === bht12);
    check('the stats bar counts mispredicts', /Mispredicts: \d+/.test(doc.getElementById('statsBar').textContent));
    if (!doc.body.classList.contains('dp-open')) win.toggleDpDock();
    ev('dpOnModeChange()');
    check('with prediction on, the strip shows the drawing with the Branch Predictor',
      doc.body.classList.contains('dp-bp') && ev('dpSvg().id') === 'dpPipeBpSvg' && !doc.body.classList.contains('dp-view-timeline'));
    ev('resetAll()');
    let sawMiss = false, sawTable = false;
    for (let i = 0; i < 12; i++) {
      win.stepOnce();
      if (ev('dpSvg().querySelector(\'[data-e="bp"]\').classList.contains("dp-glow-ctrl")')) sawMiss = true;
      if (doc.querySelectorAll('#dpEnc .pdp-bht tbody tr').length === 16) sawTable = true;
    }
    check('a misprediction lights the predictor, and the side column lists the BHT', sawMiss && sawTable);
    check('the Fetch and Execute entries are marked in it', doc.querySelectorAll('#dpEnc .pdp-bht .dp-ctl-on').length >= 1);
    win.dpToggleView();
    check('and the timeline marks the mispredicted instruction', doc.querySelectorAll('#dpTimeline .pdp-tl-miss').length >= 1);
    win.dpToggleView();
    setPipe(true);
    ev('dpOnModeChange()');
    check('prediction off: the drawing without it is back', !doc.body.classList.contains('dp-bp') && ev('dpSvg().id') === 'dpPipeSvg');

    // [4] Step, Back and Run.
    console.log('\n[4] Step is one clock cycle; Back and Run work cycle by cycle');
    setPipe(true);
    assembleSrc(HAZ);
    ev('resetAll()');
    const fresh = ev('JSON.stringify({r: Array.from(regs), pc, c: totalCycles, i: instructionCount})');
    const states = [];
    for (let i = 0; i < 40; i++) {
      win.stepOnce();
      states.push(ev('JSON.stringify({r: Array.from(regs), pc, c: totalCycles, i: instructionCount, m: readMem(labels.buf + 12, 4, true), D: pipe.D && pipe.D.seq, W: pipe.W && pipe.W.seq})'));
    }
    check('each Step is one cycle', ev('totalCycles') === 40);
    check('Statement Stepping does not change that', (() => {
      ev('statementStepping = true'); const c0 = ev('totalCycles'); win.stepOnce(); const c1 = ev('totalCycles');
      ev('statementStepping = false'); win.stepBack(); return c1 === c0 + 1;
    })());
    for (let i = 0; i < 20; i++) win.stepBack();
    check('Back 20 returns to exactly the state 20 cycles in',
      ev('JSON.stringify({r: Array.from(regs), pc, c: totalCycles, i: instructionCount, m: readMem(labels.buf + 12, 4, true), D: pipe.D && pipe.D.seq, W: pipe.W && pipe.W.seq})') === states[19]);
    for (let i = 0; i < 20; i++) win.stepOnce();
    check('and stepping forward again repeats the same 20 cycles',
      ev('JSON.stringify({r: Array.from(regs), pc, c: totalCycles, i: instructionCount, m: readMem(labels.buf + 12, 4, true), D: pipe.D && pipe.D.seq, W: pipe.W && pipe.W.seq})') === states[39]);
    for (let i = 0; i < 40; i++) win.stepBack();
    check('Back to the start restores reset state',
      ev('JSON.stringify({r: Array.from(regs), pc, c: totalCycles, i: instructionCount})') === fresh);

    ev('resetAll()');
    win.runProgram();
    for (let i = 0; i < 100 && ev('running'); i++) await sleep(20);
    check('Run finishes the program', ev('programFinished') === true);
    check('with the same registers as stepping', JSON.stringify(Array.from(ev('regs'))) === JSON.stringify(fRegs));
    check('and the stats bar shows CPI', /CPI: \d+\.\d\d/.test(doc.getElementById('statsBar').textContent),
      doc.getElementById('statsBar').textContent);

    const overLine = win.editor.value.split('\n').findIndex(l => /^over:/.test(l)) + 2;   // jal ra, func
    ev('resetAll()');
    ev(`breakpoints = new Set([${overLine}])`);
    win.runProgram();
    for (let i = 0; i < 100 && ev('running'); i++) await sleep(20);
    check('a breakpoint stops the run with its instruction in Execute',
      !ev('programFinished') && ev('sourceLineForPc(pipe.E.pc)') === overLine, ev('pipe.E && sourceLineForPc(pipe.E.pc)'));
    ev('breakpoints = new Set()');

    ev('resetAll()');
    while (!ev('programFinished') && ev('totalCycles') < 5000) win.stepOnce();
    check('stepping to the end marks the program finished', ev('programFinished') === true && ev('pipe.exited') === true);
    check('Step is then disabled', doc.getElementById('btnStep').disabled === true);
    win.stepBack();
    check('Back from the end un-finishes it', ev('programFinished') === false && !doc.getElementById('btnStep').disabled);

    // [5] The diagram and the timeline.
    console.log('\n[5] The pipelined diagram and the timeline');
    for (const [v, id] of [['full', 'dpPipeSvg'], ['bp', 'dpPipeBpSvg']]) {
      const missing = ev(`(() => {
        const svg = document.getElementById('${id}'), t = PDP_DRAW.${v}, bad = [];
        for (const [n, r] of Object.entries(t.routes)) r.segs.forEach(i => { if (!svg.querySelector('[data-e="' + i + '"]')) bad.push(n + ':' + i); });
        for (const [n, m] of Object.entries(t.muxes)) if (!svg.querySelector('[data-e="' + m.e + '"]')) bad.push(n);
        for (const [n, i] of Object.entries(t.blocks)) if (!svg.querySelector('[data-e="' + i + '"]')) bad.push(n);
        return bad;
      })()`);
      check(`${v}: every route piece, mux and block is in its drawing`, missing.length === 0, missing.slice(0, 5).join(', '));
    }
    for (const bp of [{}, { on: true }, { on: true, bits: 2, entries: 4 }]) {
      setPipe(true, {}, bp);
      assembleSrc(HAZ);
      ev('resetAll(); window.__u = []');
      for (let c = 0; c < 160 && !ev('pipeDone()'); c++) {
        ev(`(() => { const m = pdpEvaluate();
          pdpRoutes(m).forEach(([n]) => { if (!pdpTable().routes[n]) window.__u.push(n); });
          pdpHazardRoutes(m).forEach(([n]) => { if (!pdpTable().routes[n]) window.__u.push(n); });
          pdpMuxes(m).forEach(([n, sel]) => { const mx = pdpTable().muxes[n]; if (!mx || !mx.ins[sel]) window.__u.push(n + '/' + sel); });
        })()`);
        ev('pipeStep()');
      }
      const unknown = ev('window.__u');
      check(`${JSON.stringify(bp)}: every route, mux and input the renderer asks for exists`, unknown.length === 0, unknown.slice(0, 6).join(', '));
    }
    setPipe(true);

    // A program the diagram cannot draw still runs; the diagram is simply off.
    if (!doc.body.classList.contains('dp-open')) win.toggleDpDock();
    win.updateToolbarButtonStates();
    const viz = doc.getElementById('btnViz');
    check('HAZ uses FP and atomics: the Datapath button is disabled, and says where',
      viz.disabled && /line \d+/.test(viz.title) && /fcvt|amoadd|mul|lb|lh|sb|sh|ecall/.test(viz.title), viz.title);
    check('and the strip is off', !doc.body.classList.contains('dp-open'));

    ev('dpOnModeChange()');
    assembleSrc(DATA + '    lw t0, 0(s0)\n    add t1, t0, t0\n    beq x0, x0, t\n    addi a0, x0, 1\nt:  addi a1, x0, 3\n');
    win.updateToolbarButtonStates();
    check('a program it can draw brings the strip back, as it was asked for', doc.body.classList.contains('dp-open') &&
      !viz.disabled && viz.classList.contains('viz-on'));
    check('the strip shows the pipelined drawing', doc.body.classList.contains('dp-pipe') && ev('dpSvg().id') === 'dpPipeSvg');
    const lit = () => ev('dpSvg().querySelectorAll(".pl-lit").length');
    check('cycle 1 is drawn whole before anything is pressed', lit() > 5 &&
      ev('dpOverlayEl().querySelectorAll(".pdp-stage-label").length') === 5);
    check('each stage has its instruction above it, a bubble where there is none',
      /lui|auipc|addi/.test(ev('dpOverlayEl().querySelector(".pdp-stage-label").textContent')) &&
      doc.querySelectorAll('#dpPipeSvg .pdp-bubble').length === 4);
    check('the encodings column lists all five stages, oldest first',
      doc.querySelectorAll('#dpEnc .pdp-enc-row').length === 5 &&
      doc.querySelector('#dpEnc .pdp-enc-head b').textContent === 'W');
    win.dpNext();
    check('▶ clocks exactly one cycle', ev('totalCycles') === 1);
    win.dpNext(); win.dpNext();
    check('and the new cycle is drawn at once, with no phases to step through, and no second cycle count in the header',
      lit() > 20 && doc.getElementById('dpPhase').textContent === '' &&
      doc.getElementById('dpInstr').textContent === '');
    win.dpNext();
    check('the load-use stall is explained as soon as the cycle is shown', /lwStall/.test(doc.getElementById('dpCaption').textContent),
      doc.getElementById('dpCaption').textContent.slice(0, 200));
    check('and the stall lines are lit', ev('dpSvg().querySelectorAll(".pl-lit[data-pl=H]").length') > 0);
    win.dpPrev();
    check('◀ goes back one cycle', ev('totalCycles') === 3);
    win.dpPlay();
    await sleep(2100);
    const played = ev('totalCycles');
    win.dpPlay();
    await sleep(1000);
    check('▶▶ keeps clocking until pressed again', played >= 5 && ev('totalCycles') === played, played + ' then ' + ev('totalCycles'));

    check('the strip header shows the pipeline controls: settings and a Diagram/Timeline switch',
      !!doc.getElementById('dpPipeCfgBtn') && doc.getElementById('dpViewDiagram').classList.contains('active'));
    doc.getElementById('dpPipeCfgBtn').click();
    check('⚙ opens Settings on the JS Simulation tab, where the pipeline\'s switches are',
      doc.getElementById('settingsOverlay').classList.contains('open') &&
      doc.getElementById('settingsContent-simulator').classList.contains('active'));
    win.closeSettingsModal();
    win.dpToggleView();
    check('Timeline highlights its half of the switch', doc.getElementById('dpViewTimeline').classList.contains('active'));
    check('rows no longer in the pipeline are dimmed, the ones in it are not',
      doc.querySelectorAll('#dpTimeline tr.pdp-tl-gone').length >= 1 &&
      doc.querySelectorAll('#dpTimeline tbody tr:not(.pdp-tl-gone)').length >= 1 &&
      doc.querySelectorAll('#dpTimeline tbody tr:not(.pdp-tl-gone)').length <= 5);
    check('Timeline replaces the diagram', doc.body.classList.contains('dp-view-timeline'));
    const cyc0 = ev('totalCycles');
    win.dpNext();
    check('in the timeline ▶ clocks a cycle', ev('totalCycles') === cyc0 + 1);
    const rows = doc.querySelectorAll('#dpTimeline tbody tr').length;
    check('one row per instruction seen', rows >= 5, String(rows));
    check('the stalled cycle is marked', doc.querySelectorAll('#dpTimeline .pdp-tl-stall').length >= 2);
    win.dpPrev();
    check('and ◀ steps back a cycle', ev('totalCycles') === cyc0);
    const liveTh = doc.querySelector('#dpTimeline th.pdp-tl-live');
    check('the live column is headed "next", so the numbered cycles match the log',
      liveTh && liveTh.textContent === 'next' &&
      Number(liveTh.previousElementSibling.textContent) === ev('totalCycles'),
      liveTh && liveTh.previousElementSibling.textContent);
    for (let i = 0; i < 8; i++) win.dpNext();
    const tlRows = () => Array.from(doc.querySelectorAll('#dpTimeline tbody tr'));
    const bubCells = tr => Array.from(tr.querySelectorAll('.pdp-tl-bub')).map(td => td.textContent).join('');
    const nopRow = tlRows().find(tr => tr.firstElementChild.textContent === 'bubble (nop)');
    check('the load-use stall\'s nop has a row of its own, through E, M and W',
      nopRow && bubCells(nopRow) === 'EMW', nopRow && bubCells(nopRow));
    const quashed = tlRows().filter(tr => / → bubble \(nop\)$/.test(tr.firstElementChild.textContent));
    check('the two instructions the taken branch quashed carry on as bubbles',
      quashed.length === 2 && bubCells(quashed[0]) === 'EMW' && bubCells(quashed[1]) === 'DEMW' &&
      /addi x10/.test(quashed[0].firstElementChild.textContent),
      quashed.map(tr => tr.firstElementChild.textContent + ':' + bubCells(tr)).join(' | '));
    for (let i = 0; i < 8; i++) win.dpPrev();
    win.dpToggleView();


    const marks = ev('Array.from(document.querySelectorAll(".cm-pipe-stage")).map(e => e.textContent)');
    check('the editor marks the stages in its gutter', marks.length >= 3, JSON.stringify(marks));
    check('the disassembly badges them too', doc.querySelectorAll('#disassemblyDisplay .disasm-stage').length >= 3);

    // On a phone the step controls float.
    win.innerWidth = 700;
    ev('applyPanelDock(); updateDatapathPanelAvailability()');
    win.toggleVisualisation();
    const bar = doc.getElementById('floatSteps');
    const barBtns = () => Array.from(bar.querySelectorAll('button'));
    check('phone, datapath tab: ◀ ▶ ▶▶ float, and the strip header drops its own',
      ev('mobileTab') === 'datapath' && !bar.hidden && bar.dataset.mode === 'dp' &&
      doc.body.classList.contains('float-dp') && barBtns().every(b => !b.hidden),
      `${ev('mobileTab')} hidden=${bar.hidden} mode=${bar.dataset.mode}`);
    doc.body.classList.remove('dp-open');
    ev('updateFloatSteps()');
    check('it does not depend on the desktop strip having been opened', !bar.hidden && doc.body.classList.contains('float-dp'));
    const findBtn = doc.getElementById('mobileFindBtn');
    ev("setPanelVisible('registers', true); setMobileTab('registers')");
    const regsFind = !findBtn.hidden;
    ev("setPanelVisible('peripherals', true); setMobileTab('peripherals')");
    check('the tab strip\'s 🔍 filters the tabs that have rows, and is gone from the others', regsFind && findBtn.hidden);
    ev("setMobileTab('datapath')");
    const cyc1 = ev('totalCycles');
    barBtns()[1].click();
    check('the floating ▶ clocks one cycle', ev('totalCycles') === cyc1 + 1);
    barBtns()[0].click();
    check('and ◀ goes back one', ev('totalCycles') === cyc1);
    win.dpSetView('timeline');
    const phoneRows = Array.from(doc.querySelectorAll('#dpTimeline tbody tr'));
    const firstCells = phoneRows.map(tr => Array.from(tr.children).slice(1).findIndex(td => td.textContent));
    check('phone timeline: only what is in flight, from the cycle the oldest entered, without addresses',
      phoneRows.length >= 1 && phoneRows.length <= 6 && !doc.querySelector('#dpTimeline .pdp-tl-gone') &&
      !doc.querySelector('#dpTimeline .pdp-tl-addr') && Math.min(...firstCells) === 0,
      phoneRows.map(tr => tr.firstElementChild.textContent).join(' | '));
    win.dpSetView('diagram');
    ev("setMobileTab('registers')");
    check('another tab with the toolbar in view: no floating bar, header controls back',
      bar.hidden && !doc.body.classList.contains('float-dp'));
    ev('floatStepsWanted = true; updateFloatSteps()');
    check('toolbar Step scrolled away while pipelined: the strip\'s cycle controls float',
      !bar.hidden && bar.dataset.mode === 'dp');
    ev('pipeSetMode(false)');
    ev('floatStepsWanted = true; updateFloatSteps()');
    check('single-cycle, same: the toolbar\'s Back and Step, with no ▶▶',
      !bar.hidden && bar.dataset.mode === 'tb' && barBtns()[1].textContent === '⏭' && barBtns()[2].hidden,
      `hidden=${bar.hidden} mode=${bar.dataset.mode} tab=${ev('mobileTab')} arch=${ev('jsArch')} dpVis=${ev('panelDock.datapath.visible')}`);
    const pc0 = ev('pc');
    barBtns()[1].click();
    check('and ⏭ steps an instruction', ev('pc') !== pc0 && ev('totalCycles') === 1);
    ev('floatStepsWanted = false');
    win.innerWidth = 1400;
    ev('applyPanelDock(); updateDatapathPanelAvailability(); updateFloatSteps()');
    check('desktop: no floating bar', bar.hidden && !doc.body.classList.contains('float-dp'));
    ev('pipeSetMode(true)');

    doc.querySelector('#dpPipeBpSvg [data-e="bp"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    const bpOv = doc.getElementById('bpFigOverlay');
    check('clicking the Branch Predictor block opens the drawing of what is inside it',
      bpOv.classList.contains('open') && !!bpOv.querySelector('svg[viewBox]') && /BHT/.test(bpOv.textContent));
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    check('and Escape closes it', !bpOv.classList.contains('open'));

    // Switching back is a reset; the single-cycle strip returns.
    win.pipeSetMode(false);
    check('single-cycle again: reset, and the single-cycle drawing is back',
      ev('totalCycles') === 0 && !doc.body.classList.contains('dp-pipe') && ev('dpSvg().id') === 'dpSvg');
    check('with no stage marks left', doc.querySelectorAll('.cm-pipe-stage').length === 0);
    check('and the CPI readout gone', !/CPI/.test(doc.getElementById('statsBar').textContent));

    // [6] The three JS microarchitectures.
    console.log('\n[6] Single-cycle, multi-cycle and pipelined cycle counts');
    const THREE = '.data\nbuf: .word 5\n.text\nmain: la s0, buf\n    lw t0, 0(s0)\n    sw t0, 4(s0)\n    addi t1, t0, 1\n';
    const cyclesAfter = n => { ev('resetAll()'); for (let i = 0; i < n; i++) win.stepOnce(); return ev('totalCycles'); };
    ev("setJsArch('single')");
    assembleSrc(THREE);
    check('single-cycle: one cycle per instruction', cyclesAfter(5) === 5 && ev('instructionCount') === 5);
    ev("setJsArch('multi')");
    check('multi-cycle: each category\'s count from the table (load 2, store 2)', cyclesAfter(5) === 7, String(ev('totalCycles')));
    check('with its own tag and a CPI', /Cycles: 7 multi/.test(doc.getElementById('statsBar').textContent) &&
      /CPI: 1\.40/.test(doc.getElementById('statsBar').textContent), doc.getElementById('statsBar').textContent);
    win.updateToolbarButtonStates();
    check('multi-cycle has no drawing: the Datapath button is off and says why',
      viz.disabled && /not available in Multi-cycle/.test(viz.title) && !doc.body.classList.contains('dp-open'), viz.title);
    check('and the settings select offers all three', ev("Array.from(document.getElementById('simMicroarch').options).map(o => o.value).join()") === 'single,multi,pipe');
    ev("setJsArch('single')");
    win.updateToolbarButtonStates();
    check('back to single-cycle: the button returns', !viz.disabled);

    // [7] Statement Stepping, pipelined: a step ends when the statement's
    // last instruction has left Write-back.
    console.log('\n[7] Statement Stepping in the pipeline');
    ev("setJsArch('pipe')");
    assembleSrc(THREE);
    ev('resetAll(); statementStepping = true');
    const s0buf = ev("labels['buf']") >>> 0;
    win.stepOnce();
    check('stepping over la (two instructions): 6 cycles, s0 set, the lw after it not yet retired',
      ev('totalCycles') === 6 && (ev('regs[8]') >>> 0) === s0buf && ev('regs[5]') === 0,
      `cycles=${ev('totalCycles')} s0=${(ev('regs[8]') >>> 0).toString(16)} t0=${ev('regs[5]')}`);
    win.stepOnce();
    check('the next step retires the lw, one cycle later, and t0 holds the loaded 5',
      ev('totalCycles') === 7 && ev('regs[5]') === 5, `cycles=${ev('totalCycles')} t0=${ev('regs[5]')}`);
    win.stepBack();
    check('Back undoes the whole statement step', ev('totalCycles') === 6 && ev('regs[5]') === 0);
    win.dpNext();
    check('the strip\'s ▶ still clocks one cycle with Statement Stepping on', ev('totalCycles') === 7);
    ev("statementStepping = false; setJsArch('single')");

    // [8] The clock: CLK_DIV_BITS as on the board, and Run paced to it.
    console.log('\n[8] The clock, and real time');
    const hzOf = n => { win.setClkDivBits(n); return ev('cpuHz()'); };
    check('CLK_DIV_BITS divides 100 MHz by 2^(N+1), or not at all at 0',
      hzOf(0) === 100e6 && hzOf(5) === 1562500 && Math.abs(hzOf(26) - 0.745) < 0.001);
    win.setClkDivBits(3);
    const uartBox = doc.getElementById('uartCharInstr');
    check('the UART\'s character time follows the clock (540 cycles at 6.25 MHz)',
      ev('uartGapInstr()') === 540 && uartBox.value === '540' && uartBox.disabled);
    win.setClkDivBits(5);
    check('and is 135 at the default divider', ev('uartGapInstr()') === 135);
    check('the stats bar shows the time those cycles take, then the cycles, then the instructions', /^\s*[\d.]+ (µs|ms|s)\s*\|\s*Cycles: \d+ \w+\s*\|\s*Instr/.test(doc.getElementById('statsBar').textContent),
      doc.getElementById('statsBar').textContent);
    assembleSrc('.text\nmain: addi t0, x0, 0\nloop: addi t0, t0, 1\n    jal x0, loop\n');
    win.setClkDivBits(17);                       // 381 Hz
    win.setRunPace('real');
    ev('resetAll()');
    win.runProgram();
    await sleep(600);
    const paced = ev('totalCycles');
    win.toggleRunPause();
    check('Real time at 381 Hz: about 229 cycles in 0.6 s', paced >= 120 && paced <= 300, String(paced));
    win.setRunPace('max');
    ev('resetAll()');
    win.runProgram();
    await sleep(300);
    const fast = ev('totalCycles');
    win.toggleRunPause();
    check('Max speed runs far past it', fast > 50000, String(fast));
    win.setClkDivBits(5);
  } catch (e) {
    console.log('  ❌ threw: ' + (e.stack || e.message));
    failed++;
  }
  console.log('\n===========================================================');
  console.log(`📊 PIPELINE: ${passed} passed, ${failed} failed`);
  console.log('===========================================================');
  process.exit(failed ? 1 : 0);
}, 1500);
