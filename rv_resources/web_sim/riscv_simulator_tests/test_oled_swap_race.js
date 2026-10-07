// test_oled_swap_race.js
// A present is instant here and OLED_STATUS always reads 0, so a program that
// draws without polling looks correct. On the board it either leaks pixels into
// the frame being presented or loses them to the copy. The page cannot model
// that cheaply, so it says so instead - these are the checks that it does.

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
console.log('🚀 TESTING THE OLED PRESENT / DRAW RACE WARNING');
console.log('===========================================================');

const htmlPath = path.resolve(__dirname, '../riscv_simulator.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
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
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
    window.Range.prototype.getClientRects = () => [];
    window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.Element.prototype.getClientRects = () => [];
    window.Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    if (window.HTMLCanvasElement) {
      window.HTMLCanvasElement.prototype.getContext = () => ({
        createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
        putImageData: () => {},
        fillRect: () => {},
        clearRect: () => {}
      });
    }
    installExamplesFetch(window);
  }
});

const win = dom.window;
const doc = win.document;

let passed = 0, failed = 0;
function check(name, ok) {
  if (ok) { console.log('  ✅ ' + name); passed++; }
  else { console.log('  ❌ ' + name); failed++; }
}

const WARN = /pixels were written after a present/;
const consoleText = () => doc.getElementById('console').textContent;
function freshRun() {
  doc.getElementById('console').innerHTML = '';
  win.eval('oledResetPages();');
}

// The low four bits of OLED_CTRL pick the trigger, and 0 means a write to
// OLED_DATA is what paints. Which channel the colour ends up in does not
// matter here; the checks only need a pixel to land.
const SETUP = `
.text
main:
    li t0, 0xFFFF0000
    li t1, 0x20
    sw t1, 0x2C(t0)         # OLED_CTRL: paint on a data write
    li t2, 10
    sw t2, 0x20(t0)         # OLED_COL
    sw zero, 0x24(t0)       # OLED_ROW
    li t3, 0xF800
    sw t3, 0x28(t0)         # OLED_DATA, paints
    li t1, 0x08
    sw t1, 0x2C(t0)         # present
`;
const TAIL = `
    sw t3, 0x28(t0)         # draw again
    sw t3, 0x28(t0)
    sw t3, 0x28(t0)
halt:
    j halt
`;
const POLL = `
wait:
    lw t4, 0x30(t0)
    andi t4, t4, 1
    bne t4, zero, wait
`;

// The absence checks below are only worth anything if the draws after the
// present actually ran, so every case confirms the pixel landed.
function painted() {
  return win.eval('(() => { const b = oledPages[oledBackPage], i = (0 * 96 + 10) * 4; ' +
                  'return b[i] !== 0 || b[i + 1] !== 0 || b[i + 2] !== 0; })()');
}

function runSource(src, steps) {
  freshRun();
  win.setLanguageMode('asm');
  win.editor.value = src;
  win.assembleOnly();
  for (let i = 0; i < steps; i++) win.stepOnce();
}

setTimeout(async () => {
  try {
    console.log('\n[1] The JS engine, drawing straight after a present');
    runSource(SETUP + TAIL, 40);
    const unpolled = consoleText();
    check('the console warns', WARN.test(unpolled));
    check('and warns once, not once per pixel',
      (unpolled.match(new RegExp(WARN.source, 'g')) || []).length === 1);
    check('the warning names OLED_STATUS as the fix', /Poll OLED_STATUS/.test(unpolled));
    check('and gives the hardware delay in instructions', /24,576 instructions/.test(unpolled));
    check('the program really did paint after the present', painted());

    console.log('\n[2] The same program with the poll a board needs');
    runSource(SETUP + POLL + TAIL, 60);
    check('the poll loop exits and the program paints', painted());
    check('says nothing', !WARN.test(consoleText()));

    console.log('\n[3] A program that never presents is single buffered, and silent');
    runSource(SETUP.replace(/li t1, 0x08\n\s*sw t1, 0x2C\(t0\).*/s, '') + TAIL, 40);
    check('it paints', painted());
    check('says nothing', !WARN.test(consoleText()));

    console.log('\n[4] The same rule over an HDL recording, which replays its own events');
    freshRun();
    win.eval('hdlApplyPer("B", []); hdlApplyPer("O", ["0", "5", "3", "ff0000"]);');
    check('a present then a pixel warns', WARN.test(consoleText()));
    freshRun();
    win.eval('hdlApplyPer("B", []); hdlApplyPer("P", ["0"]); hdlApplyPer("O", ["0", "5", "3", "ff0000"]);');
    check('a present, a status read, then a pixel does not', !WARN.test(consoleText()));
    freshRun();
    win.eval('hdlApplyPer("B", []); hdlApplyPer("O", ["0", "5", "3", "ff0000"]);');
    win.eval('hdlResetPeripheralState(); hdlApplyPer("B", []); hdlApplyPer("O", ["0", "6", "3", "ff0000"]);');
    check('a re-seek replays the events without repeating the warning',
      (consoleText().match(new RegExp(WARN.source, 'g')) || []).length === 1);

    console.log('\n[5] The testbench reports the status read the replay needs');
    const withDbuf = win.hdlBuildTestbench({ doubleBuffer: true, regBankPath: null });
    const without = win.hdlBuildTestbench({ doubleBuffer: false, regBankPath: null });
    check('a double-buffered Wrapper emits @@P', /@@P/.test(withDbuf));
    check('keyed off the two signals the fixed Wrapper declares',
      /dut\.MemRead && dut\.dec_OLED_STATUS/.test(withDbuf));
    check('a Wrapper without the swap ports emits neither @@P nor @@B',
      !/@@P/.test(without) && !/@@B/.test(without));

    console.log('\n===========================================================');
    if (failed) {
      console.log(`❌ ${failed} CHECK(S) FAILED (${passed} passed)`);
      process.exit(1);
    }
    console.log(`🎉 ALL ${passed} OLED SWAP RACE TESTS PASSED!`);
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}, 600);
