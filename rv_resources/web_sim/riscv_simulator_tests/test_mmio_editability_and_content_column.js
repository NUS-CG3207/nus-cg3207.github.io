// test_mmio_editability_and_content_column.js
// Covers three related fixes to the Memory and Registers panels:
//   1. Read-only MMIO registers (DIP, PB, ...) are not editable in the
//      Memory view, and a write to one - from a program or from the view -
//      is ignored, the same way real hardware ignores it. UART_RX stays
//      editable on purpose (see MMIO_REGISTERS in riscv_simulator.html).
//   2. An MMIO edit is now visible immediately (Peripherals DOM built at
//      boot, not lazily on first tab visit) instead of only after the next
//      Step.
//   3. The Memory panel's Content column is ASCII in Byte mode and DEC (with
//      a signed/unsigned switch) in Word mode; the Registers panel's
//      Content (Dec) column has the same switch.

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
console.log('🚀 TESTING MMIO EDITABILITY & MEMORY/REGISTERS CONTENT COLUMN');
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
        putImageData: () => {}, fillRect: () => {}, clearRect: () => {}
      });
    }
    installExamplesFetch(window); // before the page's own fetch() for the Example menu
  }
});

const win = dom.window;
const doc = win.document;

setTimeout(() => {
  try {
    // --- [1] Peripherals DOM exists from boot, no tab visit required ---
    if (!doc.getElementById('led0')) throw new Error('#led0 should exist right after boot, before any Peripherals tab visit');
    console.log('✅ Peripherals DOM is built at boot (initPeripherals() no longer lazy-only)');

    // --- [2] A WO register write sticks and is visible immediately ---
    win.writeMem(0xFFFF0060, 0x05, 1); // LED = 0b101
    win.eval("lastChangedMem=[{addr:0xFFFF0060,size:1}]; updateMemoryView(); updatePeripherals();");
    if (!doc.getElementById('led0').classList.contains('on')) throw new Error('LED0 should be on after writing 0x05 to PERIPH_LED');
    if (doc.getElementById('led1').classList.contains('on')) throw new Error('LED1 should be off after writing 0x05 to PERIPH_LED');
    if (!doc.getElementById('led2').classList.contains('on')) throw new Error('LED2 should be on after writing 0x05 to PERIPH_LED');
    console.log('✅ MMIO write to LED (WO) sticks and is visible without stepping');

    // --- [3] A RO register write is ignored ---
    win.eval('dipSwitches = 0x1234;');
    win.writeMem(0xFFFF0064, 0xFFFF, 2);
    if (win.eval('dipSwitches') !== 0x1234) throw new Error('DIP is read-only; a write to it must be ignored');
    win.eval('pbState = 0x5;');
    win.writeMem(0xFFFF0068, 0x7, 1);
    if (win.eval('pbState') !== 0x5) throw new Error('PB is read-only; a write to it must be ignored');
    console.log('✅ MMIO write to DIP/PB (RO) is ignored, matching real hardware');

    // --- [4] The registry drives read-only-ness correctly, with the UART_RX exception ---
    if (win.eval('mmioReadOnlyMessage(0xFFFF0064)') === null) throw new Error('DIP should report read-only');
    if (win.eval('mmioReadOnlyMessage(0xFFFF0060)') !== null) throw new Error('LED should report writable');
    if (win.eval('mmioReadOnlyMessage(0xFFFF0004)') !== null) throw new Error('UART_RX is a deliberate exception and should report writable');
    if (win.eval("mmioRegisterAt(0xFFFF0064).name") !== 'DIP') throw new Error('mmioRegisterAt(DIP) should resolve to the DIP entry');
    console.log('✅ MMIO_REGISTERS registry classifies RO/WO correctly, UART_RX exception included');

    // --- [5] Read-only MMIO cells are not editable in the DOM (byte mode) ---
    win.eval("document.getElementById('memAddr').value='0xFFFF0060'; document.getElementById('memRows').value='2';");
    win.setMemViewMode('bytes');
    const dipByteCell = doc.querySelector(`[data-addr="${0xFFFF0064}"]`);
    if (!dipByteCell || dipByteCell.getAttribute('contenteditable') === 'true') {
      throw new Error('DIP byte cell must not be contenteditable');
    }
    const ledByteCell = doc.querySelector(`[data-addr="${0xFFFF0060}"]`);
    if (!ledByteCell || ledByteCell.getAttribute('contenteditable') !== 'true') {
      throw new Error('LED byte cell must be contenteditable');
    }
    console.log('✅ Read-only MMIO cells render non-editable in Byte mode; writable ones stay editable');

    // --- [6] Memory panel Content column label + sign toggle track Byte/Word mode ---
    win.setMemViewMode('word');
    if (doc.getElementById('memContentColLabel').textContent.trim() !== 'Content (DEC)') {
      throw new Error('Word mode should label the third column Content (DEC)');
    }
    if (doc.getElementById('memDecSignToggleWrap').hidden !== false) throw new Error('Sign toggle should be visible in Word mode');
    win.setMemViewMode('bytes');
    if (doc.getElementById('memContentColLabel').textContent.trim() !== 'Content (ASCII)') {
      throw new Error('Byte mode should label the third column Content (ASCII)');
    }
    if (doc.getElementById('memDecSignToggleWrap').hidden !== true) throw new Error('Sign toggle should be hidden in Byte mode');
    console.log('✅ Content column label and sign toggle track Byte/Word mode');

    // --- [7] MMIO register name is shown as a label above its own cell ---
    win.setMemViewMode('word');
    const memHtml = doc.getElementById('memView').innerHTML;
    if (!memHtml.includes('LED (WO)')) throw new Error('MMIO row should show "LED (WO)" as a label above its cell');
    if (!memHtml.includes('DIP (RO)')) throw new Error('MMIO row should show "DIP (RO)" as a label above its cell');
    if (/DIP RO 0xFFFF0064/.test(memHtml)) {
      throw new Error('MMIO label should not include the address any more (old joined-chip format)');
    }
    console.log('✅ MMIO register name/access renders as a label above its cell, no address');

    // --- [8] Sign toggle changes the rendered decimal (Data segment, Word mode) ---
    win.memGo('data');
    const dataBase = win.eval('dataBase');
    win.eval(`document.getElementById('memAddr').value='0x${dataBase.toString(16)}'; document.getElementById('memRows').value='2';`);
    win.writeMem(dataBase, 0xFFFFFFFF, 4);
    win.setMemViewMode('word');
    win.setMemDecSigned(true);
    win.updateMemoryView();
    const signedText = doc.querySelector('.val-dec').textContent.trim();
    win.setMemDecSigned(false);
    win.updateMemoryView();
    const unsignedText = doc.querySelector('.val-dec').textContent.trim();
    if (signedText !== '-1') throw new Error(`Signed Word-mode DEC should read -1, got "${signedText}"`);
    if (unsignedText !== '4294967295') throw new Error(`Unsigned Word-mode DEC should read 4294967295, got "${unsignedText}"`);
    console.log('✅ Memory panel sign toggle switches Content (DEC) between signed and unsigned');

    // --- [9] Registers panel has the same sign toggle ---
    win.eval('regs[5] = -1;');
    win.setRegDecSigned(true);
    win.updateRegisters();
    const regRowSigned = doc.querySelectorAll('#regBody tr')[5].querySelectorAll('td')[3].textContent.trim();
    win.setRegDecSigned(false);
    win.updateRegisters();
    const regRowUnsigned = doc.querySelectorAll('#regBody tr')[5].querySelectorAll('td')[3].textContent.trim();
    if (regRowSigned !== '-1') throw new Error(`Registers panel signed Dec should read -1, got "${regRowSigned}"`);
    if (regRowUnsigned !== '4294967295') throw new Error(`Registers panel unsigned Dec should read 4294967295, got "${regRowUnsigned}"`);
    console.log('✅ Registers panel Content (Dec) has the same signed/unsigned switch');

    console.log('\n===========================================================');
    console.log('🎉 ALL MMIO EDITABILITY / CONTENT COLUMN TESTS PASSED!');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}, 500);
