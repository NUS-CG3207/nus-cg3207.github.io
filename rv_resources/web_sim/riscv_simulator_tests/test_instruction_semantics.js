// Every instruction the simulator claims to support: does it assemble, and
// does executing it produce the right answer?
//
// test_all_instructions_v2.js checks only that a long program assembles with
// no errors. That catches a mnemonic falling out of the table, but not a wrong
// encoding, a wrong decode, or an operand form the assembler has started
// refusing. This suite runs each instruction and checks the result, which
// exercises encoder -> machine code -> decoder -> execution end to end: the
// encoder and the interpreter are separate code paths, so a mistake in either
// shows up as a wrong number here.
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM; }

const html = fs.readFileSync(path.resolve(__dirname, '../riscv_simulator.html'), 'utf8');
const CM6 = fs.readFileSync(path.resolve(__dirname, 'cm6_bundle.min.js'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable',
  url: 'http://localhost:8080/riscv_simulator.html',
  beforeParse(w) {
    w.__CM6_DISABLE_CDN = true;
    w.addEventListener('DOMContentLoaded', () => {
      try { w.eval(CM6); } catch (e) { console.error('CM6 inject failed:', e.message); }
    });
    w.requestAnimationFrame = cb => setTimeout(cb, 16);
    w.cancelAnimationFrame = id => clearTimeout(id);
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    for (const P of [w.Range.prototype, w.Element.prototype]) {
      P.getClientRects = () => [];
      P.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    }
    if (w.HTMLCanvasElement) {
      w.HTMLCanvasElement.prototype.getContext = () => ({
        createImageData: (a, b) => ({ data: new Uint8Array(a * b * 4) }),
        putImageData() {}, fillRect() {}, clearRect() {},
        getImageData: (x, y, a, b) => ({ data: new Uint8Array(a * b * 4) }),
        drawImage() {}, save() {}, restore() {}, beginPath() {}, arc() {},
        fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {},
        fillText() {}, measureText: () => ({ width: 0 }),
        setTransform() {}, translate() {}, scale() {},
      });
    }
  }
});
const win = dom.window;

// ---------------------------------------------------------------- the cases
//
// Each case is [name, setup, body, checks]. `setup` runs first (usually `li`s
// to put known values in registers), then `body` is the instruction under
// test. `checks` maps a register name or a memory address to its expected
// value, compared as a signed 32-bit int.
//
// Expected values are worked out from the RISC-V spec, not from the
// simulator - a check that agrees with the implementation by construction
// would test nothing.
const R = (n) => n;                         // readability at the call sites
const CASES = [
  // ---- RV32I register-register --------------------------------------
  ['add',   'li t0, 17\nli t1, 25',            'add t2, t0, t1',   { t2: 42 }],
  ['add negative', 'li t0, -17\nli t1, 25',    'add t2, t0, t1',   { t2: 8 }],
  ['add wraps',  'li t0, 0x7FFFFFFF\nli t1, 1','add t2, t0, t1',   { t2: -2147483648 }],
  ['sub',   'li t0, 25\nli t1, 17',            'sub t2, t0, t1',   { t2: 8 }],
  ['sub below zero', 'li t0, 17\nli t1, 25',   'sub t2, t0, t1',   { t2: -8 }],
  ['sub to zero',  'li t0, 25\nli t1, 25',     'sub t2, t0, t1',   { t2: 0 }],
  ['sub wraps',  'li t0, -2147483648\nli t1, 1','sub t2, t0, t1',  { t2: 2147483647 }],
  ['and',   'li t0, 0xF0F0\nli t1, 0xFF00',    'and t2, t0, t1',   { t2: 0xF000 }],
  ['or',    'li t0, 0xF0F0\nli t1, 0x0F0F',    'or t2, t0, t1',    { t2: 0xFFFF }],
  ['xor',   'li t0, 0xF0F0\nli t1, 0xFF00',    'xor t2, t0, t1',   { t2: 0x0FF0 }],
  ['sll',   'li t0, 1\nli t1, 31',             'sll t2, t0, t1',   { t2: -2147483648 }],
  ['sll masks shamt to 5 bits', 'li t0, 1\nli t1, 33', 'sll t2, t0, t1', { t2: 2 }],
  ['srl',   'li t0, -1\nli t1, 28',            'srl t2, t0, t1',   { t2: 15 }],
  ['sra',   'li t0, -16\nli t1, 2',            'sra t2, t0, t1',   { t2: -4 }],
  ['slt true',  'li t0, -1\nli t1, 1',         'slt t2, t0, t1',   { t2: 1 }],
  ['slt false', 'li t0, 1\nli t1, -1',         'slt t2, t0, t1',   { t2: 0 }],
  ['slt equal is not less', 'li t0, 5\nli t1, 5', 'slt t2, t0, t1', { t2: 0 }],
  ['sltu unsigned', 'li t0, -1\nli t1, 1',     'sltu t2, t0, t1',  { t2: 0 }],
  ['sltu true', 'li t0, 1\nli t1, -1',         'sltu t2, t0, t1',  { t2: 1 }],
  ['sltu equal is not less', 'li t0, 5\nli t1, 5', 'sltu t2, t0, t1', { t2: 0 }],

  // ---- RV32I register-immediate -------------------------------------
  ['addi',  'li t0, 17',                       'addi t2, t0, 25',  { t2: 42 }],
  ['addi negative imm', 'li t0, 17',           'addi t2, t0, -25', { t2: -8 }],
  ['addi imm max', 'li t0, 0',                 'addi t2, t0, 2047',{ t2: 2047 }],
  ['addi imm min', 'li t0, 0',                 'addi t2, t0, -2048',{ t2: -2048 }],
  ['andi',  'li t0, 0xFF',                     'andi t2, t0, 0x0F',{ t2: 0x0F }],
  ['ori',   'li t0, 0xF0',                     'ori t2, t0, 0x0F', { t2: 0xFF }],
  ['xori',  'li t0, 0xFF',                     'xori t2, t0, 0x0F',{ t2: 0xF0 }],
  ['xori -1 inverts', 'li t0, 0',              'xori t2, t0, -1',  { t2: -1 }],
  ['slti true',  'li t0, -5',                  'slti t2, t0, 0',   { t2: 1 }],
  ['slti false', 'li t0, 5',                   'slti t2, t0, 0',   { t2: 0 }],
  ['slti equal is not less', 'li t0, 5',       'slti t2, t0, 5',   { t2: 0 }],
  ['slti one below', 'li t0, 4',               'slti t2, t0, 5',   { t2: 1 }],
  ['sltiu',  'li t0, -1',                      'sltiu t2, t0, 1',  { t2: 0 }],
  ['sltiu equal is not less', 'li t0, 5',      'sltiu t2, t0, 5',  { t2: 0 }],
  ['sltiu one below', 'li t0, 4',              'sltiu t2, t0, 5',  { t2: 1 }],
  ['slli',  'li t0, 3',                        'slli t2, t0, 4',   { t2: 48 }],
  ['slli by 31', 'li t0, 1',                   'slli t2, t0, 31',  { t2: -2147483648 }],
  ['srli',  'li t0, -1',                       'srli t2, t0, 28',  { t2: 15 }],
  ['srai',  'li t0, -16',                      'srai t2, t0, 2',   { t2: -4 }],
  ['srai of positive', 'li t0, 16',            'srai t2, t0, 2',   { t2: 4 }],
  ['shift by 0 is identity', 'li t0, -12345',  'srai t2, t0, 0',   { t2: -12345 }],
  ['srli by 0 is identity',  'li t0, -12345',  'srli t2, t0, 0',   { t2: -12345 }],
  ['slli by 0 is identity',  'li t0, -12345',  'slli t2, t0, 0',   { t2: -12345 }],
  ['srai keeps the sign', 'li t0, -1',         'srai t2, t0, 31',  { t2: -1 }],
  ['srli does not',       'li t0, -1',         'srli t2, t0, 31',  { t2: 1 }],

  // ---- upper immediates ---------------------------------------------
  ['lui',   '',                                'lui t2, 0x12345',  { t2: 0x12345000 }],
  ['lui then addi', '',   'lui t2, 0x12345\naddi t2, t2, 0x678',   { t2: 0x12345678 }],
  ['auipc adds to PC', '', 'auipc t2, 0',      { t2: 'PC_OF_BODY' }],

  // ---- loads and stores ---------------------------------------------
  ['sw then lw', 'la t0, buf\nli t1, 0x12345678',
   'sw t1, 0(t0)\nlw t2, 0(t0)',               { t2: 0x12345678 }],
  ['sh then lh sign-extends', 'la t0, buf\nli t1, 0xFFFF8765',
   'sh t1, 0(t0)\nlh t2, 0(t0)',               { t2: -30875 }],          // 0x8765 signed
  ['sh then lhu zero-extends', 'la t0, buf\nli t1, 0xFFFF8765',
   'sh t1, 0(t0)\nlhu t2, 0(t0)',              { t2: 0x8765 }],
  ['sb then lb sign-extends', 'la t0, buf\nli t1, 0xFFFFFF85',
   'sb t1, 0(t0)\nlb t2, 0(t0)',               { t2: -123 }],            // 0x85 signed
  ['sb then lbu zero-extends', 'la t0, buf\nli t1, 0xFFFFFF85',
   'sb t1, 0(t0)\nlbu t2, 0(t0)',              { t2: 0x85 }],
  ['store offset', 'la t0, buf\nli t1, 99',
   'sw t1, 8(t0)\nlw t2, 8(t0)',               { t2: 99 }],
  ['negative offset', 'la t0, buf\naddi t0, t0, 16\nli t1, 77',
   'sw t1, -4(t0)\nlw t2, -4(t0)',             { t2: 77 }],
  ['bytes are little-endian', 'la t0, buf\nli t1, 0x12345678',
   'sw t1, 0(t0)\nlbu t2, 0(t0)',              { t2: 0x78 }],

  // ---- branches: taken sets t2 to 1, not taken leaves it 0 -----------
  ['beq taken',      'li t0, 5\nli t1, 5\nli t2, 0',  'beq t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['beq not taken',  'li t0, 5\nli t1, 6\nli t2, 0',  'beq t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bne taken',      'li t0, 5\nli t1, 6\nli t2, 0',  'bne t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['blt signed',     'li t0, -1\nli t1, 1\nli t2, 0', 'blt t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bltu unsigned',  'li t0, -1\nli t1, 1\nli t2, 0', 'bltu t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bge equal',      'li t0, 5\nli t1, 5\nli t2, 0',  'bge t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bge greater',    'li t0, 6\nli t1, 5\nli t2, 0',  'bge t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bge less',       'li t0, 4\nli t1, 5\nli t2, 0',  'bge t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['blt equal is not taken', 'li t0, 5\nli t1, 5\nli t2, 0', 'blt t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bltu equal is not taken', 'li t0, 5\nli t1, 5\nli t2, 0', 'bltu t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bne equal is not taken', 'li t0, 5\nli t1, 5\nli t2, 0', 'bne t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bgeu equal',     'li t0, 5\nli t1, 5\nli t2, 0',  'bgeu t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgt equal is not taken', 'li t0, 5\nli t1, 5\nli t2, 0', 'bgt t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['ble equal is taken', 'li t0, 5\nli t1, 5\nli t2, 0', 'ble t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgez of zero',   'li t0, 0\nli t2, 0',  'bgez t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgtz of zero is not taken', 'li t0, 0\nli t2, 0', 'bgtz t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bltz of zero is not taken', 'li t0, 0\nli t2, 0', 'bltz t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 0 }],
  ['bgeu unsigned',  'li t0, -1\nli t1, 1\nli t2, 0', 'bgeu t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['branch backwards', 'li t0, 0\nli t1, 5',
   '.Lloop:\naddi t0, t0, 1\nblt t0, t1, .Lloop\nmv t2, t0',  { t2: 5 }],

  // ---- jumps ---------------------------------------------------------
  ['jal skips',   'li t2, 0', 'jal ra, .Lafter\nli t2, 99\n.Lafter:',         { t2: 0 }],
  ['jal links',   'li t2, 0', 'jal ra, .Lafter\n.Lafter:\nsub t2, ra, ra',    { t2: 0 }],
  ['jalr',        'li t2, 0\nla t0, .Ltarget', 'jalr ra, 0(t0)\nli t2, 99\n.Ltarget:', { t2: 0 }],
  ['call and ret','li t2, 0',
   'call fn\nj .Ldone\nfn:\nli t2, 7\nret\n.Ldone:',                          { t2: 7 }],

  // ---- M extension ---------------------------------------------------
  ['mul',    'li t0, 6\nli t1, 7',                'mul t2, t0, t1',    { t2: 42 }],
  ['mul negative', 'li t0, -6\nli t1, 7',         'mul t2, t0, t1',    { t2: -42 }],
  ['mulh',   'li t0, 0x40000000\nli t1, 4',       'mulh t2, t0, t1',   { t2: 1 }],
  ['mulhu',  'li t0, -1\nli t1, 2',               'mulhu t2, t0, t1',  { t2: 1 }],
  ['div',    'li t0, 100\nli t1, 7',              'div t2, t0, t1',    { t2: 14 }],
  ['div truncates toward zero', 'li t0, -100\nli t1, 7', 'div t2, t0, t1', { t2: -14 }],
  ['divu',   'li t0, -1\nli t1, 2',               'divu t2, t0, t1',   { t2: 2147483647 }],
  ['rem',    'li t0, 100\nli t1, 7',              'rem t2, t0, t1',    { t2: 2 }],
  ['rem takes the dividend sign', 'li t0, -100\nli t1, 7', 'rem t2, t0, t1', { t2: -2 }],
  ['remu',   'li t0, 100\nli t1, 7',              'remu t2, t0, t1',   { t2: 2 }],
  ['remu is unsigned', 'li t0, -1\nli t1, 7',    'remu t2, t0, t1',   { t2: 3 }],
  ['div exact',  'li t0, 49\nli t1, 7',          'div t2, t0, t1',    { t2: 7 }],
  ['rem exact is zero', 'li t0, 49\nli t1, 7',   'rem t2, t0, t1',    { t2: 0 }],
  ['mulh of two negatives', 'li t0, -1\nli t1, -1', 'mulh t2, t0, t1', { t2: 0 }],
  ['mulhsu', 'li t0, -1\nli t1, 2',              'mulhsu t2, t0, t1', { t2: -1 }],
  ['div by zero gives -1', 'li t0, 5\nli t1, 0',  'div t2, t0, t1',    { t2: -1 }],
  ['rem by zero gives the dividend', 'li t0, 5\nli t1, 0', 'rem t2, t0, t1', { t2: 5 }],

  // ---- x0 ------------------------------------------------------------
  ['x0 reads as zero', 'li t2, 5',               'add t2, x0, x0',     { t2: 0 }],
  ['writes to x0 are discarded', '',   'addi x0, x0, 5\nadd t2, x0, x0', { t2: 0 }],

  // ---- pseudo-instructions -------------------------------------------
  ['nop',   'li t2, 4',                          'nop',                { t2: 4 }],
  ['mv',    'li t0, 42',                         'mv t2, t0',          { t2: 42 }],
  ['not',   'li t0, 0',                          'not t2, t0',         { t2: -1 }],
  ['neg',   'li t0, 42',                         'neg t2, t0',         { t2: -42 }],
  ['seqz true',  'li t0, 0',                     'seqz t2, t0',        { t2: 1 }],
  ['seqz false', 'li t0, 3',                     'seqz t2, t0',        { t2: 0 }],
  ['seqz of one', 'li t0, 1',                    'seqz t2, t0',        { t2: 0 }],
  ['seqz of -1',  'li t0, -1',                   'seqz t2, t0',        { t2: 0 }],
  ['snez',  'li t0, 3',                          'snez t2, t0',        { t2: 1 }],
  ['snez of one', 'li t0, 1',                    'snez t2, t0',        { t2: 1 }],
  ['snez of zero', 'li t0, 0',                   'snez t2, t0',        { t2: 0 }],
  ['sltz',  'li t0, -3',                         'sltz t2, t0',        { t2: 1 }],
  ['sltz of zero', 'li t0, 0',                   'sltz t2, t0',        { t2: 0 }],
  ['sgtz',  'li t0, 3',                          'sgtz t2, t0',        { t2: 1 }],
  ['sgtz of zero', 'li t0, 0',                   'sgtz t2, t0',        { t2: 0 }],
  ['not of -1', 'li t0, -1',                     'not t2, t0',         { t2: 0 }],
  ['neg of zero', 'li t0, 0',                    'neg t2, t0',         { t2: 0 }],
  ['mv of zero', 'li t0, 0\nli t2, 9',           'mv t2, t0',          { t2: 0 }],
  ['li small',  '',                              'li t2, 42',          { t2: 42 }],
  ['li negative', '',                            'li t2, -42',         { t2: -42 }],
  ['li 32-bit', '',                              'li t2, 0x12345678',  { t2: 0x12345678 }],
  ['li with a low bit 11 set', '',               'li t2, 0x00000FFF',  { t2: 0x00000FFF }],
  ['li 0x80000000', '',                          'li t2, 0x80000000',  { t2: -2147483648 }],
  ['la then lw', 'li t1, 0xABCD\nla t0, buf\nsw t1, 0(t0)',
   'la t3, buf\nlw t2, 0(t3)',                                         { t2: 0xABCD }],
  ['beqz taken',  'li t0, 0\nli t2, 0', 'beqz t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bnez taken',  'li t0, 1\nli t2, 0', 'bnez t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['blez taken',  'li t0, 0\nli t2, 0', 'blez t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgez taken',  'li t0, 0\nli t2, 0', 'bgez t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bltz taken',  'li t0, -1\nli t2, 0','bltz t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgtz taken',  'li t0, 1\nli t2, 0', 'bgtz t0, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgt',   'li t0, 5\nli t1, 3\nli t2, 0', 'bgt t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['ble',   'li t0, 3\nli t1, 5\nli t2, 0', 'ble t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bgtu',  'li t0, -1\nli t1, 3\nli t2, 0','bgtu t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['bleu',  'li t0, 3\nli t1, -1\nli t2, 0','bleu t0, t1, .Lhit\nj .Lend\n.Lhit:\nli t2, 1\n.Lend:', { t2: 1 }],
  ['j',     'li t2, 0',                     'j .Lskip\nli t2, 99\n.Lskip:',  { t2: 0 }],
  ['jr',    'li t2, 0\nla t0, .Ltgt',       'jr t0\nli t2, 99\n.Ltgt:',      { t2: 0 }],

  // ---- the load/store-to-symbol forms the assembler now polices -------
  ['lw from a symbol uses rd', 'li t1, 0x5A5A\nla t0, buf\nsw t1, 0(t0)',
   'lw t2, buf',                                                       { t2: 0x5A5A }],
  ['sw to a symbol with a named scratch register', 'li t1, 0x1234',
   'sw t1, buf, t3\nlw t2, buf',                                       { t2: 0x1234 }],
];

const REG_INDEX = {
  zero: 0, ra: 1, sp: 2, gp: 3, tp: 4, t0: 5, t1: 6, t2: 7, s0: 8, s1: 9,
  a0: 10, a1: 11, a2: 12, a3: 13, a4: 14, a5: 15, a6: 16, a7: 17,
  s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23, s8: 24, s9: 25,
  s10: 26, s11: 27, t3: 28, t4: 29, t5: 30, t6: 31,
};

setTimeout(() => {
  let passed = 0;
  const failures = [];

  const buildProgram = (setup, body) =>
    '.text\nmain:\n' +
    (setup ? setup.split('\n').map(l => '  ' + l).join('\n') + '\n' : '') +
    '__body:\n' +
    body.split('\n').map(l => (l.trim().endsWith(':') ? l : '  ' + l)).join('\n') +
    '\n__halt:\n  j __halt\n' +
    '.data\nbuf: .word 0, 0, 0, 0, 0, 0, 0, 0\n';

  for (const [name, setup, body, checks] of CASES) {
    const src = buildProgram(setup, body);
    try {
      win.editor.value = src;
      win.assembleOnly();

      const mc = win.eval('machineCode') || [];
      const errs = mc.filter(m => m.error);
      if (errs.length) {
        failures.push(`${name}: did not assemble — ${errs[0].error}`);
        continue;
      }
      if (!win.eval('assembled')) {
        failures.push(`${name}: assembleOnly() left the program unassembled`);
        continue;
      }

      // Run to the halt loop, or until the step budget is spent.
      const haltAddr = win.eval('labels')['__halt'];
      const bodyAddr = win.eval('labels')['__body'];
      let steps = 0;
      while (steps < 400) {
        win.stepOnce();
        steps++;
        if ((win.eval('pc') >>> 0) === (haltAddr >>> 0)) break;
      }
      if (steps >= 400) {
        failures.push(`${name}: never reached the halt loop in 400 steps`);
        continue;
      }

      let ok = true;
      for (const [where, want] of Object.entries(checks)) {
        const expected = want === 'PC_OF_BODY' ? (bodyAddr | 0) : (want | 0);
        const got = win.regs[REG_INDEX[where]] | 0;
        if (got !== expected) {
          failures.push(`${name}: ${where} = ${got} (0x${(got >>> 0).toString(16)}), ` +
                        `expected ${expected} (0x${(expected >>> 0).toString(16)})`);
          ok = false;
        }
      }
      if (ok) passed++;
    } catch (e) {
      failures.push(`${name}: threw — ${e.message}`);
    }
  }

  console.log(`\n${passed} of ${CASES.length} instruction cases produced the expected result.`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  ❌ ' + f);
    console.log('\n===========================================================');
    console.log(`❌ ${failures.length} INSTRUCTION SEMANTICS FAILURE(S)`);
    console.log('===========================================================');
    process.exit(1);
  }
  console.log('\n===========================================================');
  console.log(`🎉 ALL ${CASES.length} INSTRUCTION SEMANTICS CASES PASSED!`);
  console.log('===========================================================');
  process.exit(0);
}, 2500);
