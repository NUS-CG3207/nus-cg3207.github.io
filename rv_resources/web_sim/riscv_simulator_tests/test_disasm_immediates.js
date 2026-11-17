// test_disasm_immediates.js
// The Native instruction column still shows the operand exactly as it was
// written. An immediate whose encoded field reads more than one way gains a
// marker carrying the other readings, and every reading offered has to be a
// spelling a real assembler accepts - which is the whole point: a 12-bit
// signed field may be written as the signed value or as its full 32-bit two's
// complement, but never as the raw 12 bits read unsigned.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { installExamplesFetch } = require('./examples_fetch');
let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM;
}

console.log('===========================================================');
console.log('🚀 TESTING DISASSEMBLY IMMEDIATE READINGS');
console.log('===========================================================');

const html = fs.readFileSync(path.resolve(__dirname, '../riscv_simulator.html'), 'utf8');
const CM6_BUNDLE_SOURCE = fs.readFileSync(path.resolve(__dirname, 'cm6_bundle.min.js'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost:8080/riscv_simulator.html',
  beforeParse(window) {
    window.__CM6_DISABLE_CDN = true;
    window.addEventListener('DOMContentLoaded', () => {
      try { window.eval(CM6_BUNDLE_SOURCE); } catch (e) { console.error('CM6 inject failed:', e.message); }
    });
    window.requestAnimationFrame = cb => setTimeout(cb, 16);
    window.cancelAnimationFrame = id => clearTimeout(id);
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    window.Range.prototype.getClientRects = () => [];
    window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.Element.prototype.getClientRects = () => [];
    window.Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    if (window.HTMLCanvasElement) {
      window.HTMLCanvasElement.prototype.getContext = () => ({
        createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
        putImageData() {}, fillRect() {}, clearRect() {}
      });
    }
    installExamplesFetch(window);
  }
});

const win = dom.window;
const doc = win.document;

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { console.log('  ✅ ' + name); passed++; }
  else { console.log('  ❌ ' + name + (detail ? ' — ' + detail : '')); failed++; }
}

const SRC = `.text
main:
    addi x5, x0, -1
    sltiu x1, x2, -1
    ori  x13, x5, 255
    addi x6, x0, 5
    lw   x7, -12(x8)
    sw   x7, 20(x8)
    lui  x9, 0xFFFFF
    auipc x10, 1
    slli x11, x5, 31
    add  x12, x5, x6
loop:
    beq  x5, x6, loop
    jal  x1, loop
`;

// An assembler is not part of the test environment; where one is installed the
// readings are fed back through it, which is the only way to be sure they are
// legal rather than merely plausible.
function assembler() {
  try {
    execFileSync('riscv64-unknown-elf-as', ['--version'], { stdio: 'ignore' });
    return 'riscv64-unknown-elf-as';
  } catch (e) { return null; }
}

function assembles(as, line) {
  const f = path.join(require('os').tmpdir(), 'imm_check_' + process.pid + '.s');
  const o = f.replace(/\.s$/, '.o');
  fs.writeFileSync(f, '.text\nloop:\n' + line + '\n');
  try {
    execFileSync(as, ['-march=rv32i', '-mabi=ilp32', f, '-o', o], { stdio: 'ignore' });
    return true;
  } catch (e) { return false; }
  finally { for (const p of [f, o]) { try { fs.unlinkSync(p); } catch (e) {} } }
}

setTimeout(async () => {
  try {
    win.setLanguageMode('asm');
    win.editor.value = SRC;
    win.assembleOnly();
    const rows = win.machineCode.filter(m => m.bytes && !m.error);
    const by = Object.fromEntries(rows.map(m => [m.native, m]));
    const readingsOf = n => win.eval('nativeImmReadings')(by[n] && by[n].imm) || [];
    const tokenOf = n => (by[n] && by[n].immFrom >= 0) ? by[n].native.slice(by[n].immFrom, by[n].immTo) : null;
    const flat = n => readingsOf(n).map(r => r[0] + ' ' + r[1]).join(' · ');

    console.log('\n[1] The marker covers the immediate operand and nothing else');
    check('a plain I-type immediate', tokenOf('addi x5, x0, -1') === '-1');
    check('a load offset, not the base register', tokenOf('lw x7, -12(x8)') === '-12');
    check('a store offset', tokenOf('sw x7, 20(x8)') === '20');
    check('a shift amount', tokenOf('slli x11, x5, 31') === '31');
    check('a U-type immediate, as the source spelled it', tokenOf('lui x9, 0xFFFFF') === '0xFFFFF');
    check('a branch target label', tokenOf('beq x5, x6, loop') === 'loop');
    check('an R-type instruction has no immediate to mark', by['add x12, x5, x6'].immFrom === -1);

    console.log('\n[2] What each field reads as');
    check('a negative 12-bit field offers all three readings',
      flat('addi x5, x0, -1') === 'signed -1 · hex 0xffffffff · unsigned 4294967295', flat('addi x5, x0, -1'));
    check('sltiu is no different — the field is the same',
      flat('sltiu x1, x2, -1') === 'signed -1 · hex 0xffffffff · unsigned 4294967295');
    check('a negative load offset', flat('lw x7, -12(x8)') === 'signed -12 · hex 0xfffffff4 · unsigned 4294967284');
    check('a positive field has no distinct signed reading',
      flat('ori x13, x5, 255') === 'decimal 255 · hex 0xff');
    check('a shift amount is never signed', flat('slli x11, x5, 31') === 'decimal 31 · hex 0x1f');
    check('lui says what it loads', flat('lui x9, 0xFFFFF') === 'decimal 1048575 · hex 0xfffff · loads 0xfffff000');
    check('auipc says what it adds', flat('auipc x10, 1') === 'decimal 1 · hex 0x1 · adds 0x00001000');
    const loopAddr = by['beq x5, x6, loop'].address >>> 0;   // loop: sits on the beq itself
    check('a branch gives the target and the distance',
      flat('beq x5, x6, loop') ===
      'target 0x' + loopAddr.toString(16).padStart(8, '0') + ' · offset +0 bytes from this instruction',
      flat('beq x5, x6, loop'));
    check('a jump resolves to the same target',
      readingsOf('jal x1, loop')[0][1] === readingsOf('beq x5, x6, loop')[0][1]);

    console.log('\n[3] Nothing is marked where there is nothing to add');
    check('a single-digit immediate is left alone', readingsOf('addi x6, x0, 5').length === 0);
    check('and an R-type instruction is too', readingsOf('add x12, x5, x6').length === 0);

    console.log('\n[4] The column itself is unchanged');
    win.switchTab('disassembly');
    await new Promise(r => setTimeout(r, 200));
    const cells = [...doc.querySelectorAll('.code-list td.native')];
    const texts = cells.map(c => c.textContent.trim());
    for (const m of rows) {
      const cell = texts.find(t => t.startsWith(m.native));
      if (!cell) { check('cell text still reads "' + m.native + '"', false, 'row not found'); break; }
    }
    check('every row still reads exactly as it did',
      rows.every(m => texts.some(t => t === m.native || t.startsWith(m.native + ' '))));
    const marked = [...doc.querySelectorAll('.disasm-imm')];
    const expectMarked = rows.filter(m => readingsOf(m.native).length).length;
    check('only the rows with something to say are marked',
      marked.length === expectMarked && expectMarked === rows.length - 2,
      'marked ' + marked.length + ' of ' + rows.length);
    check('the readings survive the attribute round-trip',
      marked.every(s => { try { return JSON.parse(decodeURIComponent(s.dataset.imm)).length > 0; } catch (e) { return false; } }));
    // A native tooltip would be drawn beside the popover, so there must not be one.
    check('no title attribute, so the browser draws no second tooltip',
      marked.every(s => !s.hasAttribute('title')));
    check('the readings are still on aria-label for anything reading the page',
      marked.every(s => (s.getAttribute('aria-label') || '').length > 0));

    console.log('\n[5] The popover, which is the only affordance a phone has');
    const el = () => doc.getElementById('immPopover');
    const span = marked.find(s => s.textContent === '-12');
    const fire = (t, ev, opts) => t.dispatchEvent(new (ev === 'keydown' ? win.KeyboardEvent : win.MouseEvent)(ev, Object.assign({ bubbles: true }, opts)));
    fire(span, 'click');
    check('a tap opens it', el() && !el().hidden);
    check('carrying the same readings',
      el().textContent.replace(/\s+/g, ' ').includes('unsigned 4294967284'));
    fire(span, 'click');
    check('a second tap closes it', el().hidden);
    fire(span, 'click'); fire(doc.body, 'click');
    check('a tap elsewhere closes it', el().hidden);
    fire(span, 'click'); fire(doc, 'keydown', { key: 'Escape' });
    check('Escape closes it', el().hidden);
    fire(span, 'mouseover');
    check('hover opens it too, for a mouse', !el().hidden);

    console.log('\n[6] Every reading offered is a spelling an assembler accepts');
    const as = assembler();
    if (!as) {
      console.log('  ⏭  no riscv assembler installed — skipped');
    } else {
      const cases = [
        ['addi x5, x0, ', 'addi x5, x0, -1'],
        ['sltiu x1, x2, ', 'sltiu x1, x2, -1'],
        ['ori x13, x5, ', 'ori x13, x5, 255'],
        ['slli x11, x5, ', 'slli x11, x5, 31'],
        ['lui x9, ', 'lui x9, 0xFFFFF']
      ];
      for (const [prefix, native] of cases) {
        for (const [kind, value] of readingsOf(native)) {
          if (kind === 'loads' || kind === 'adds') continue;   // a result, not an operand
          const line = prefix + value;
          check(`${line}  (${kind})`, assembles(as, line));
        }
      }
      // The reading that is deliberately never offered, because it is the one
      // spelling a real assembler rejects.
      check('the raw 12-bit field read unsigned is rejected, and is never offered',
        !assembles(as, 'addi x5, x0, 4095') &&
        !readingsOf('addi x5, x0, -1').some(r => r[1] === '4095'));
      check('a signed shift amount is rejected, and is never offered',
        !assembles(as, 'slli x11, x5, -1') &&
        !readingsOf('slli x11, x5, 31').some(r => String(r[1]).startsWith('-')));
      check('a signed lui immediate is rejected, and is never offered',
        !assembles(as, 'lui x9, -0x1') &&
        !readingsOf('lui x9, 0xFFFFF').some(r => String(r[1]).startsWith('-')));
    }

    console.log('\n===========================================================');
    if (failed) { console.log(`❌ ${failed} CHECK(S) FAILED (${passed} passed)`); process.exit(1); }
    console.log(`🎉 ALL ${passed} DISASSEMBLY IMMEDIATE TESTS PASSED!`);
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}, 600);
