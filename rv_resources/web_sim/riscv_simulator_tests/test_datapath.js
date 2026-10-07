// test_datapath.js
// The Datapath strip animates the lecture's single-cycle diagram with values
// it computes itself, from the course's Decoder/Extend/ALU/PC_Logic tables.
// These checks hold that model to the simulator instruction by instruction,
// make sure every wire it lights exists in the embedded drawing, and walk the
// phase controls: the clock edge must execute exactly one instruction.

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
console.log('🚀 TESTING THE DATAPATH ANIMATION');
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

// Every row of the decoder table, every ALU operation and each branch both
// ways, with operands of both signs so the signed and unsigned compares differ.
const COVERAGE = `
.data
buf: .word 0x80000001, 0, 0, 0
.text
main:
    li t0, -7
    li t1, 5
    add a0, t0, t1
    sub a0, t0, t1
    sll a0, t1, t1
    slt a0, t0, t1
    sltu a0, t0, t1
    xor a0, t0, t1
    srl a0, t0, t1
    sra a0, t0, t1
    or a0, t0, t1
    and a0, t0, t1
    addi a0, t0, -100
    slti a0, t0, 3
    sltiu a0, t0, 3
    xori a0, t0, 0x55
    ori a0, t0, 0x55
    andi a0, t0, 0x55
    slli a0, t0, 3
    srli a0, t0, 3
    srai a0, t0, 3
    lui a1, 0xABCDE
    auipc a2, 0x12
    la s0, buf
    lw a3, 0(s0)
    sw a3, 8(s0)
    beq t0, t1, l1
    beq t0, t0, l1
    nop
l1: bne t0, t0, l2
    bne t0, t1, l2
    nop
l2: blt t1, t0, l3
    blt t0, t1, l3
    nop
l3: bge t0, t1, l4
    bge t1, t0, l4
    nop
l4: bltu t0, t1, l5
    bltu t1, t0, l5
    nop
l5: bgeu t1, t0, l6
    bgeu t0, t1, l6
    nop
l6: jal ra, f
    la t2, g
    jalr ra, 0(t2)
halt: j halt
f:  ret
g:  addi a4, x0, 1
    ret
`;

setTimeout(async () => {
  try {
    // [1] The drawing has every element the animation refers to.
    console.log('\n[1] Every wire, mux and block the model names is in the embedded diagram');
    const missing = ev(`(() => {
      const bad = [];
      const has = (i, tag) => { const el = dpSvg().querySelector('[data-e="' + i + '"]');
        if (!el || (tag && el.tagName.toLowerCase() !== tag)) bad.push(i); };
      for (const [n, r] of Object.entries(DP_ROUTES)) { r.segs.forEach(i => has(i, 'path'));
        if (r.pts.length < 2) bad.push(n); }
      for (const m of Object.values(DP_MUXES)) has(m.e, 'path');
      for (const i of Object.values(DP_BLOCKS)) has(i);
      for (const l of Object.values(DP_CLOCKS)) l.forEach(i => has(i, 'path'));
      return bad;
    })()`);
    check('all route segments, muxes, blocks and clocks exist', missing.length === 0, JSON.stringify(missing));

    // [2] The model against the simulator, one instruction at a time.
    console.log('\n[2] The datapath model predicts what the simulator then does');
    if (!assembleSrc(COVERAGE)) throw new Error('coverage program did not assemble');
    const rows = new Set(), ops = new Set(), branches = new Set();
    const bad = [];
    let n = 0;
    const halt = ev('labels.halt');
    while (ev('pc') !== halt && n++ < 200) {
      const m = JSON.parse(ev('JSON.stringify(dpEvaluate())'));
      if (m.unsupported) { bad.push('unsupported: ' + m.text); win.executeOne(); continue; }
      rows.add(m.ctrl.row);
      if (m.ctrl.row === 'DP Reg' || m.ctrl.row === 'DP Imm') ops.add(m.ctrl.ALUControl);
      if (m.ctrl.row === 'branch') branches.add(m.f3 + ':' + m.pcSrc);
      win.executeOne();
      const pcNow = ev('pc') >>> 0;
      if (pcNow !== m.pcIn) bad.push(`${m.text}: PC ${pcNow.toString(16)}, model ${m.pcIn.toString(16)}`);
      if (m.ctrl.RegWrite === '1' && m.rd !== 0) {
        const v = ev(`regs[${m.rd}]`) >>> 0;
        if (v !== m.result) bad.push(`${m.text}: x${m.rd} ${v.toString(16)}, model ${m.result.toString(16)}`);
      }
      if (m.ctrl.MemWrite === '1') {
        const w = ev(`readMem(${m.aluResult}, 4, true)`) >>> 0;
        if (w !== m.rd2) bad.push(`${m.text}: M ${w.toString(16)}, model ${m.rd2.toString(16)}`);
      }
    }
    check('the program ran to halt', ev('pc') === halt);
    check('every prediction matched: next PC, register write, memory write', bad.length === 0, bad.slice(0, 4).join('; '));
    check('all nine decoder rows exercised', rows.size === 9, Array.from(rows).join(', '));
    check('all ten ALU operations exercised', ops.size === 10, Array.from(ops).join(', '));
    check('each branch condition both taken and not taken', branches.size === 12, Array.from(branches).join(', '));

    // [3] A program the diagram cannot draw still runs; the diagram is off.
    console.log('\n[3] A program with an instruction the diagram does not draw turns it off');
    if (!doc.body.classList.contains('dp-open')) win.toggleDpDock();
    const viz = doc.getElementById('btnViz');
    for (const src of ['mul a0, a1, a2', 'lb a0, 0(a1)', 'sb a0, 0(a1)', 'ecall', 'fadd.s ft0, ft1, ft2', 'amoadd.w a0, a1, (a2)']) {
      assembleSrc('.text\nmain: addi a1, x0, 3\n  ' + src + '\nhalt: j halt\n');
      win.updateToolbarButtonStates();
      check(`${src}: button disabled, naming line 3`, viz.disabled && /line 3/.test(viz.title) && !doc.body.classList.contains('dp-open'), viz.title);
    }
    win.stepOnce(); win.stepOnce();
    check('and the program still runs', ev('instructionCount') === 2);
    assembleSrc('.text\nmain: li t0, 3\n    addi t0, t0, 4\nhalt: j halt\n');
    win.updateToolbarButtonStates();
    check('a drawable program re-enables it, and the strip comes back on its own', !viz.disabled &&
      doc.body.classList.contains('dp-open') && viz.classList.contains('viz-on'));
    win.toggleVisualisation();
    check('the toolbar button hides it', !doc.body.classList.contains('dp-open') && !viz.classList.contains('viz-on'));
    win.toggleVisualisation();
    check('and shows it again', doc.body.classList.contains('dp-open'));

    // [4] The controls. Each ▶ runs one phase; the one after the clock edge
    // executes exactly one instruction, even with Statement Stepping on.
    console.log('\n[4] Phases step forward and back, and the clock edge executes one instruction');
    assembleSrc('.text\nmain: li t0, 3\n    addi t0, t0, 4\n    addi t0, t0, 5\nhalt: j halt\n');
    if (!doc.body.classList.contains('dp-open')) win.toggleDpDock();
    ev('statementStepping = true');
    const phase = () => doc.getElementById('dpPhase').textContent;
    check('a fresh instruction waits at phase 0', (ev('dpPhase') === 0 && phase() === ''), phase());
    const advance = async () => { win.dpNext(); win.dpNext(); await sleep(5); };
    await advance();
    check('the first ▶ fetches', phase() === '1/9 Fetch', phase());
    check('fetch lights the PC and Instr wires',
      ev('dpSvg().querySelectorAll(".dp-lit-data").length') >= 2);
    check('and parks their values beside them', ev('document.getElementById("dpOverlay").children.length') >= 2);
    const clockSteps = () => Array.from(doc.querySelectorAll('#dpClock .dp-clk-step'));
    check('the clock beside the drawing holds the nine steps, by pipeline stage, all in one period',
      clockSteps().map(g => g.textContent).join('') === 'FDDDEMWWW', clockSteps().map(g => g.textContent).join(''));
    check('with the current step lit', clockSteps()[0].classList.contains('now') &&
      !doc.getElementById('dpClock').classList.contains('dp-clk-edge'));
    const names = ['Fetch'];
    for (let k = 2; k <= 9; k++) { await advance(); names.push(phase().replace(/^\d\/9 /, '')); }
    check('the steps: Decode (Decoder, Register Read, Extend), Execute, Memory, Writeback (Register Write, PC Increment, Retire)',
      names.join(' | ') === 'Fetch | Decode · Decoder | Decode · Register Read | Decode · Extend | Execute · ALU and PC Logic | ' +
        'Memory | Writeback · Register Write | Writeback · PC Increment | Writeback · Retire', names.join(' | '));
    check('the ninth phase is the clock edge', phase() === '9/9 Writeback · Retire', phase());
    check('and there the clock\'s next rising edge is lit', doc.getElementById('dpClock').classList.contains('dp-clk-edge') &&
      clockSteps()[8].classList.contains('now') && clockSteps()[7].classList.contains('done'));
    check('nothing has executed yet', ev('instructionCount') === 0 && ev('regs[5]') === 0);
    win.dpPrev();
    check('◀ goes back one phase without executing anything', /^8\/9/.test(phase()) && ev('instructionCount') === 0, phase());
    await advance();
    win.dpNext();
    check('▶ at the edge executes exactly one instruction', ev('instructionCount') === 1 && ev('regs[5]') === 3,
      `count ${ev('instructionCount')}, t0 ${ev('regs[5]')}`);
    check('and the next instruction starts at phase 0', (ev('dpPhase') === 0 && phase() === '') &&
      /addi x5, x5, 4/.test(doc.getElementById('dpInstr').textContent), doc.getElementById('dpInstr').textContent);
    ev('statementStepping = false');

    await win.dpPlay();
    await sleep(5);
    check('▶▶ plays the phases and then executes', ev('instructionCount') === 2 && ev('regs[5]') === 7,
      `count ${ev('instructionCount')}, t0 ${ev('regs[5]')}`);

    // [5] The toolbar and the panels keep it in step.
    console.log('\n[5] Step, Back and register edits reach the diagram');
    await advance(); await advance();
    win.stepOnce();
    check('a toolbar Step resets to the new instruction', (ev('dpPhase') === 0 && phase() === '') && ev('dpModel.pc') === ev('pc'));
    win.stepBack();
    check('a toolbar Back resets to the instruction before', ev('dpModel.pc') === ev('pc') && (ev('dpPhase') === 0 && phase() === ''));
    const arrow = k => { doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
                         doc.dispatchEvent(new win.KeyboardEvent('keyup', { key: k, bubbles: true })); };
    const n0 = ev('instructionCount');
    arrow('ArrowRight');
    check('with the datapath shown, → takes one phase, not an instruction',
      ev('dpPhase') === 1 && ev('instructionCount') === n0, `phase ${ev('dpPhase')}`);
    arrow('ArrowLeft');
    check('and ← one phase back', ev('dpPhase') === 0);
    win.stepOnce();
    const pcAfter = ev('pc');
    arrow('ArrowLeft');
    check('← at the first phase goes back to the instruction before, at its last phase',
      ev('pc') !== pcAfter && ev('dpPhase') === ev('dpPhaseList.length') && ev('instructionCount') === n0);
    win.stepOnce(); win.stepBack();
    await advance(); await advance(); await advance(); await advance();
    ev('commitRegEditModal')(5, '100');
    check('a register edit re-evaluates in place, keeping the phase',
      ev('dpModel.rd1') === 100 && /^4\/9/.test(phase()), `rd1 ${ev('dpModel.rd1')}, ${phase()}`);

    // [6] A trunk is lit by whichever of its branches is used, and a branch
    // that is not used stays dashed all the way from its junction.
    console.log('\n[6] Branching nets light exactly the path that is used');
    // The drawing's own segments ran straight through junctions; none may now.
    const through = ev(`(() => {
      const bad = [];
      const segs = [];
      dpSvg().querySelectorAll('path[data-e]').forEach(el => {
        const stroke = el.getAttribute('stroke');
        if (stroke !== '#000000' && stroke !== '#0070C0') return;
        if (parseFloat(el.getAttribute('stroke-width')) <= 3.5) return;
        const d = el.getAttribute('d');
        if (/[a-zA-LN-Z]/.test(d.replace(/^M/, ''))) return;   // shapes, not wires
        const n = d.match(/-?[\\d.]+(?:e-?\\d+)?/g).map(Number);
        const t = (el.getAttribute('transform') || '').match(/matrix\\(([^)]*)\\)/);
        const M = t ? t[1].split(/[ ,]+/).map(Number) : [1, 0, 0, 1, 0, 0];
        const pts = [];
        for (let k = 0; k + 1 < n.length; k += 2) {
          pts.push([M[0] * n[k] + M[2] * n[k + 1] + M[4], M[1] * n[k] + M[3] * n[k + 1] + M[5]]);
        }
        segs.push({ id: el.getAttribute('data-e'), pts });
      });
      // Strictly inside the run, by more than a line width: the drawing
      // overshoots some corners by a few units, and a corner is not a junction.
      const inside = (p, a, b) =>
        (Math.abs(a[1] - b[1]) < 4 && Math.abs(p[1] - a[1]) < 4 &&
         Math.min(a[0], b[0]) + 8 < p[0] && p[0] < Math.max(a[0], b[0]) - 8) ||
        (Math.abs(a[0] - b[0]) < 4 && Math.abs(p[0] - a[0]) < 4 &&
         Math.min(a[1], b[1]) + 8 < p[1] && p[1] < Math.max(a[1], b[1]) - 8);
      for (const w of segs) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) for (const v of segs) {
        if (v === w || v.id === '95') continue;   // the instruction bus is lit whole, always
        for (let k = 0; k + 1 < v.pts.length; k++) {
          if (inside(p, v.pts[k], v.pts[k + 1])) bad.push(w.id + ' ends inside ' + v.id);
        }
      }
      return bad;
    })()`);
    check('no wire segment runs through a junction', through.length === 0, through.join('; '));

    const litAt = async (src, phaseCount) => {
      assembleSrc('.data\nv: .word 7\n.text\nmain: ' + src + '\nhalt: j halt\n');
      if (!doc.body.classList.contains('dp-open')) win.toggleDpDock();
      for (let k = 0; k < phaseCount; k++) await advance();
      return (id) => {
        const el = ev(`dpSvg().querySelector('[data-e="${id}"]')`);
        return el ? (Array.from(el.classList).find(c => c.startsWith('dp-lit-')) || 'none').replace('dp-lit-', '') : 'missing';
      };
    };
    let lit = await litAt('addi x5, x6, 12', 9);
    check('addi: ALUResult is red up to where it branches to the MemtoReg mux',
      lit('94a') === 'data' && lit(103) === 'data' && lit('94b') === 'unused',
      `94a ${lit('94a')}, 103 ${lit(103)}, 94b ${lit('94b')}`);
    check('addi: ExtImm is red from Extend up to the SrcB mux, dashed down to the PC adder',
      lit(109) === 'data' && lit('229a') === 'data' && lit('229b') === 'unused' && lit(191) === 'unused',
      `109 ${lit(109)}, 229a ${lit('229a')}, 229b ${lit('229b')}, 191 ${lit(191)}`);
    check('addi: PC is red to the instruction memory and to PC+4, dashed towards the ALU',
      lit('76a') === 'data' && lit('76b') === 'data' && lit('195a') === 'data' &&
      lit('195b') === 'unused' && lit(199) === 'unused',
      `76b ${lit('76b')}, 195a ${lit('195a')}, 195b ${lit('195b')}, 199 ${lit(199)}`);
    check('addi: RD2 is dashed from the register file on', lit('239a') === 'unused' && lit(192) === 'unused');
    lit = await litAt('add x5, x6, x7', 9);
    check('add: ALUSrcA x0 keeps bit 0 blue and only bit 1 grey',
      lit('206a') === 'ctrl' && lit('206b') === 'ctrl' && lit(166) === 'x',
      `206a ${lit('206a')}, 206b ${lit('206b')}, 166 ${lit(166)}`);
    check('add: RD2 is red to the SrcB mux, dashed only down to WriteData',
      lit('239a') === 'data' && lit('239b') === 'data' && lit(192) === 'unused');
    lit = await litAt('la x5, v\n    lw x6, 0(x5)', 0);
    win.stepOnce(); win.stepOnce();
    for (let k = 0; k < 9; k++) await advance();
    check('lw: ALUResult is red to the data memory and dashed to the MemtoReg mux',
      lit('94a') === 'data' && lit('94b') === 'data' && lit(103) === 'unused',
      `94b ${lit('94b')}, 103 ${lit(103)}`);
    lit = await litAt('la x5, v\n    jalr x1, 0(x5)', 0);
    win.stepOnce(); win.stepOnce();
    for (let k = 0; k < 9; k++) await advance();
    check('jalr: RD1 is red to the PC base mux and dashed into the ALU; PC feeds the ALU',
      lit('87a') === 'data' && lit(230) === 'data' && lit('87b') === 'unused' &&
      lit('195b') === 'data' && lit('195a') === 'unused',
      `87b ${lit('87b')}, 230 ${lit(230)}, 195a ${lit('195a')}, 195b ${lit('195b')}`);

    // [7] The encoding card: the format's fields, the bits in them, and the
    // immediate Extend gathers from those bits.
    console.log('\n[7] The instruction is shown split into its format\'s fields');
    const formats = [
      ['add x7, x5, x6', 'R-type', ['funct7', 'rs2', 'rs1', 'funct3', 'rd', 'opcode']],
      ['addi x5, x6, -12', 'I-type', ['imm[11:0]', 'rs1', 'funct3', 'rd', 'opcode']],
      ['srai x7, x5, 3', 'I-type', ['funct7', 'shamt', 'rs1', 'funct3', 'rd', 'opcode']],
      ['sw x6, -12(x5)', 'S-type', ['imm[11:5]', 'rs2', 'rs1', 'funct3', 'imm[4:0]', 'opcode']],
      ['beq x5, x6, main', 'B-type', ['imm[12|10:5]', 'rs2', 'rs1', 'funct3', 'imm[4:1|11]', 'opcode']],
      ['lui x10, 0xABCDE', 'U-type', ['imm[31:12]', 'rd', 'opcode']],
      ['jal x1, main', 'J-type', ['imm[20|10:1|11|19:12]', 'rd', 'opcode']],
    ];
    for (const [src, type, names] of formats) {
      assembleSrc('.text\nmain: ' + src + '\nhalt: j halt\n');
      const enc = doc.getElementById('dpEnc');
      const got = Array.from(enc.querySelectorAll('.dp-enc-name')).map(e => e.textContent);
      const bits = Array.from(enc.querySelectorAll('.dp-enc-bit')).map(e => e.textContent).join('');
      const word = (ev('readMem(pc, 4, true)') >>> 0).toString(2).padStart(32, '0');
      check(`${src}: ${type}, fields ${names.join(' ')}`,
        !enc.hidden && enc.textContent.includes(type) && JSON.stringify(got) === JSON.stringify(names),
        JSON.stringify(got));
      check(`${src}: the 32 bits shown are the instruction word`, bits === word, bits + ' vs ' + word);
    }
    assembleSrc('.text\nmain: beq x5, x6, main\nhalt: j halt\n');
    check('the B-type immediate is gathered to 0 (a branch to itself)',
      /Extend \(ImmSrc 111\)[^=]*0x00000000 = 0/.test(doc.getElementById('dpEnc').textContent));
    assembleSrc('.text\nmain: nop\n    beq x5, x6, main\nhalt: j halt\n');
    win.stepOnce();
    check('and to -4 a word further on', /0xfffffffc = -4/.test(doc.getElementById('dpEnc').textContent));
    check('the branch\'s funct3 is named',
      Array.from(doc.querySelectorAll('#dpEnc .dp-enc-table td')).some(td => td.textContent === 'beq'));

    console.log('\n[7b] Below it, the Decoder\'s control table with this instruction\'s row lit');
    const rowsOf = () => Array.from(doc.querySelectorAll('#dpEnc .dp-ctl-table tbody tr'));
    check('the table has the lecture\'s nine rows, in its order',
      rowsOf().map(r => r.children[1].textContent).join(',') === 'DP Reg,DP Imm,load,store,branch,jal,auipc,lui,jalr');
    const want = [['add x7, x5, x6', 'DP Reg'], ['srai x7, x5, 3', 'DP Imm'], ['lw x6, 0(x5)', 'load'], ['sw x6, 0(x5)', 'store'],
      ['bne x5, x6, main', 'branch'], ['jal x1, main', 'jal'], ['auipc x5, 1', 'auipc'], ['lui x5, 1', 'lui'], ['jalr x0, 0(x1)', 'jalr']];
    for (const [src, row] of want) {
      assembleSrc('.text\nmain: ' + src + '\nhalt: j halt\n');
      const lit = rowsOf().filter(r => r.classList.contains('dp-ctl-on')).map(r => r.children[1].textContent);
      check(`${src}: only the ${row} row is lit`, lit.length === 1 && lit[0] === row, JSON.stringify(lit));
    }
    assembleSrc('.text\nmain: srai x7, x5, 3\nhalt: j halt\n');
    check('a DP row also shows the ALUControl it works out to',
      /= 1011 \(sra\)/.test(doc.querySelector('#dpEnc .dp-ctl-on').textContent), doc.querySelector('#dpEnc .dp-ctl-on').textContent);
    const memtoReg = row => rowsOf().find(r => r.children[1].textContent === row).children[3].textContent;
    check('MemtoReg is x for store and branch, as the single-cycle table has it', memtoReg('store') === 'x' && memtoReg('branch') === 'x');

    // [8] HDL mode draws waveforms in that slot; the datapath stands down.
    console.log('\n[8] HDL mode switches it off');
    win.setSimEngineMode('hdl');
    if (win.closeSettingsModal) win.closeSettingsModal();
    check('its buttons are disabled in HDL mode', doc.getElementById('dpNextBtn').disabled);
    win.setSimEngineMode('js');
    check('and come back in the JS engine', !doc.getElementById('dpNextBtn').disabled);
  } catch (e) {
    console.log('  ❌ threw: ' + (e && e.stack ? e.stack : e));
    failed++;
  }
  console.log('\n===========================================================');
  console.log(failed ? `❌ ${failed} DATAPATH CHECK(S) FAILED, ${passed} passed` : `🎉 ALL ${passed} DATAPATH CHECKS PASSED`);
  console.log('===========================================================');
  process.exit(failed ? 1 : 0);
}, 1500);
