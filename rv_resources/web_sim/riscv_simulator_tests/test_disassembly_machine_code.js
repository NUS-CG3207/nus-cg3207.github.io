// test_disassembly_machine_code.js
// Verification of the Disassembly Machine-code column rendering:
//   - Byte mode  → bytes shown separately (space-separated) in memory order
//   - Word mode  → one whole 8-digit little-endian hex word per 4-byte chunk
//   - Binary mode groups the 8 digits of each byte together and separates bytes
//     with spaces in Byte mode, underscores in Word mode (no mid-byte wrap)
//   - The toolbar shows "LSB to the left" (Byte) / "LSB to the right" (Word)

const fs = require('fs');
const path = require('path');
const { installExamplesFetch } = require('./examples_fetch');
let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  try {
    JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM;
  } catch (e2) {
    JSDOM = require('/home/rajesh/.gemini/antigravity-ide/brain/7780d698-8baa-4d51-9b54-596f69dcec55/scratch/node_modules/jsdom').JSDOM;
  }
}

console.log('===========================================================');
console.log('🚀 TESTING DISASSEMBLY MACHINE-CODE BYTE/BINARY RENDERING');
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
        clearRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8Array(4) }),
        measureText: () => ({ width: 0 })
      });
    }
    installExamplesFetch(window); // before the page's own fetch() for the Example menu
  }
});

const win = dom.window;
const doc = win.document;

setTimeout(async () => {
  try {
    let passed = 0, failed = 0;
    function check(label, cond) {
      if (cond) { passed++; console.log('  ✅ ' + label); }
      else { failed++; console.log('  ❌ ' + label); }
    }

    win.setLanguageMode('asm');
    await win.loadExample('fib');
    win.assembleOnly();
    win.setDisasmViewMode('word');

    const showHex = doc.getElementById('showHex');
    const showBin = doc.getElementById('showBinary');
    const hint = doc.getElementById('disasmOrderHint');
    if (!showHex || !showBin || !hint) throw new Error('Disassembly toolbar missing');
    function row0Text() {
      const c = doc.querySelectorAll('#disassemblyDisplay .bytes');
      return c[0] ? c[0].textContent.trim() : '';
    }

    // --- 1. Word mode ---
    console.log('\n[1] Word mode (default): one whole 8-digit little-endian word');
    win.setDisasmViewMode('word');
    showHex.checked = true; showBin.checked = false; win.updateDisassembly();
    check('Hint = "LSB to the right" in word mode', hint.textContent === 'LSB to the right');
    check('Hex word mode = whole 8-digit hex word', /^[0-9a-f]{8}$/.test(row0Text()));
    check('Hex word mode has no spaces inside the word', !row0Text().includes(' '));

    showHex.checked = false; showBin.checked = true; win.updateDisassembly();
    check('Binary word mode = 32 binary digits', /^[01]{32}$/.test(row0Text().replace(/_/g, '')));
    check('Binary word mode separates bytes with underscores', row0Text().split('_').length === 4);
    check('Each binary byte group is exactly 8 digits', row0Text().split('_').every(g => g.length === 8));
    // Verify the numeric value is preserved (little-endian: LSB on the right).
    const binVal = parseInt(row0Text().replace(/_/g, ''), 2);
    const mc = win.machineCode && win.machineCode[0] && win.machineCode[0].bytes;
    const knownVal = (mc && ((mc[3] << 24) | (mc[2] << 16) | (mc[1] << 8) | mc[0]) >>> 0);
    check('Binary word value equals the little-endian word value', knownVal !== undefined && binVal === knownVal);

    // --- 2. Byte mode ---
    console.log('\n[2] Byte mode: separate bytes, space-separated, LSB on the left');
    win.setDisasmViewMode('bytes');
    showHex.checked = true; showBin.checked = false; win.updateDisassembly();
    check('Hint = "LSB to the left" in byte mode', hint.textContent === 'LSB to the left');
    check('Hex byte mode = 2-digit hex bytes separated by spaces', /^([0-9a-f]{2} ){3}[0-9a-f]{2}$/.test(row0Text()));

    showHex.checked = false; showBin.checked = true; win.updateDisassembly();
    check('Binary byte mode = 8-digit bytes separated by spaces', /^([01]{8} ){3}[01]{8}$/.test(row0Text()));
    check('Binary byte groups stay intact (no mid-byte wrap)', row0Text().split(' ').every(g => g.length === 8));

    // --- 3. Hex + Binary together ---
    console.log('\n[3] Hex and Binary both enabled');
    showHex.checked = true; showBin.checked = true;
    win.setDisasmViewMode('word'); win.updateDisassembly();
    const bothWord = row0Text();
    check('Word mode hex+bin = hex word + space + underscore binary', /^[0-9a-f]{8} [01]{8}_[01]{8}_[01]{8}_[01]{8}$/.test(bothWord));
    win.setDisasmViewMode('bytes'); win.updateDisassembly();
    const bothByte = row0Text();
    check('Byte mode hex+bin = hex bytes + space + spaced binary bytes', /^([0-9a-f]{2} ){3}[0-9a-f]{2} ([01]{8} ){3}[01]{8}$/.test(bothByte));


    // --- 4. Toggle buttons stay in sync with the mode ---
    console.log('\n[4] Toolbar Byte/Word buttons reflect the active mode');
    win.setDisasmViewMode('bytes');
    check('Byte button active after setDisasmViewMode(bytes)', doc.getElementById('disasmViewModeBytes').classList.contains('active'));
    check('Word button inactive after bytes', !doc.getElementById('disasmViewModeWord').classList.contains('active'));
    win.setDisasmViewMode('word');
    check('Word button active after setDisasmViewMode(word)', doc.getElementById('disasmViewModeWord').classList.contains('active'));
    check('Byte button inactive after word', !doc.getElementById('disasmViewModeBytes').classList.contains('active'));

    // --- 5. CSS: bytes cell allows wrapping only between byte groups ---
    console.log('\n[5] Bytes-cell CSS keeps the 8 digits of each byte contiguous');
    const styleEls = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n');
    check('CSS uses word-break: normal (no mid-byte break-all)', /\.code-list \.bytes\s*\{[^}]*word-break:\s*normal/.test(styleEls));
    check('CSS removed the fixed width that forced mid-byte wraps', !/\.code-list \.bytes\s*\{[^}]*width:\s*12ch/.test(styleEls));

    console.log('\n===========================================================');
    if (failed === 0) {
      console.log(`🎉 ALL ${passed} DISASSEMBLY MACHINE-CODE TESTS PASSED!`);
      process.exit(0);
    } else {
      console.log(`💥 ${failed} DISASSEMBLY MACHINE-CODE TEST(S) FAILED (${passed} passed)`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Disassembly Machine-code Test Failed:', err);
    process.exit(1);
  }
}, 400);

