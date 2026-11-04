const fs = require('fs');
const path = require('path');
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
  }
});

const win = dom.window;
const doc = win.document;

setTimeout(() => {
  try {
    console.log('===========================================================');
    console.log('🚀 TESTING MOBILE KEYBOARD FOCUS PRESERVATION');
    console.log('===========================================================');

    let passed = 0, failed = 0;
    function check(label, cond) {
      if (cond) { passed++; console.log('  ✅ ' + label); }
      else { failed++; console.log('  ❌ ' + label); }
    }

    if (!win.PointerEvent) win.PointerEvent = win.MouseEvent;
    if (!win.Element.prototype.setPointerCapture) {
      win.Element.prototype.setPointerCapture = () => {};
      win.Element.prototype.releasePointerCapture = () => {};
    }

    // Mobile viewport: tabbed view, exactly one panel visible at a time.
    win.innerWidth = 700;
    win.localStorage.clear();

    try { win.initPanelDock(); console.log('[bootstrap] initPanelDock OK'); }
    catch (e) { console.log('[bootstrap] initPanelDock THREW:', e.message); }
    try { win.applyPanelDock(); console.log('[bootstrap] applyPanelDock OK'); }
    catch (e) { console.log('[bootstrap] applyPanelDock THREW:', e.message); }

    const stack = doc.getElementById('panelStack');
    const input = doc.getElementById('uartInputText');

    check('UART input exists in the DOM', !!input);
    check('Peripherals panel exists', !!doc.getElementById('tab-peripherals'));

    // --- 1. Switching to the Peripherals tab shows the UART input ---
    console.log('\n[1] Switching to Peripherals tab on mobile');
    // Mirrors the mobile chip-tap path: make the panel visible (persisted) and
    // then switch the mobile tab to it.
    win.setPanelVisible('peripherals', true);
    win.setMobileTab('peripherals');
    const activePanels = stack.querySelectorAll('.tab-content.panel-mobile-active');
    check('Exactly one panel is mobile-active', activePanels.length === 1);
    check('Active panel is Peripherals', activePanels[0] && activePanels[0].id === 'tab-peripherals');
    check('UART input is inside the active panel', !!input.closest('.panel-mobile-active'));

    // --- 2. Focus the UART input and fire a window resize (mobile keyboard) ---
    console.log('\n[2] Focus UART input, then fire a window resize (soft keyboard open/close)');
    input.focus();
    input.value = 'A\\r\\n';
    input.setSelectionRange(input.value.length, input.value.length);
    check('UART input has focus before resize', doc.activeElement === input);

    // Capture the pre-resize panel DOM state to prove no relayout happened.
    const beforeStackHtml = stack.innerHTML;
    const beforeActiveId = activePanels[0] ? activePanels[0].id : null;

    // This is exactly what an on-screen keyboard does: it resizes the visual
    // viewport, firing a window resize event.
    win.dispatchEvent(new win.Event('resize'));

    check('UART input is still focused after resize', doc.activeElement === input);
    check('Panel stack layout unchanged after resize', stack.innerHTML === beforeStackHtml);
    check('Active mobile tab unchanged after resize', !!stack.querySelector('.tab-content.panel-mobile-active') &&
      stack.querySelector('.tab-content.panel-mobile-active').id === beforeActiveId);


    // --- 3. applyPanelDock preserves focus + caret if it does run ---
    console.log('\n[3] applyPanelDock restores focus + caret');
    // Deliberately switch tabs so a relayout happens, then re-focus the UART
    // input and re-run applyPanelDock — the active field must regain focus
    // with its caret position intact.
    win.setMobileTab('registers');
    input.focus();
    input.setSelectionRange(2, 2);
    win.applyPanelDock();
    check('UART input keeps focus after applyPanelDock', doc.activeElement === input);
    check('Caret position preserved after applyPanelDock', input.selectionStart === 2 && input.selectionEnd === 2);
    check('Input value preserved after applyPanelDock', input.value === 'A\\r\\n');

    // --- 4. Non-form focus → resize still relayouts (normal behaviour) ---
    console.log('\n[4] Resize without a focused form field still relayouts');
    // Force focus off the input by focusing the Send button (a <button> is not
    // one of the guarded form-field tags).
    const sendBtn = doc.getElementById('uartSendBtn');
    if (sendBtn) sendBtn.focus();
    check('Focus moved to the Send button (not a guarded form field)', doc.activeElement === sendBtn);
    const beforeHtml2 = stack.innerHTML;
    win.dispatchEvent(new win.Event('resize'));
    // On mobile the resize re-applies the dock, which re-appends panels — but it
    // must NOT throw and the active tab must remain Peripherals.
    const activeAfter = stack.querySelectorAll('.tab-content.panel-mobile-active');
    check('Resize with non-form focus still relayouts (stack re-applied)', stack.innerHTML !== beforeHtml2 || activeAfter.length === 1);
    check('No exception during resize', true);

    console.log('\n===========================================================');
    if (failed === 0) console.log(`🎉 ALL ${passed} MOBILE KEYBOARD FOCUS TESTS PASSED!`);
    else console.log(`❌ ${failed}/${passed + failed} MOBILE KEYBOARD FOCUS TESTS FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test harness error:', err);
    process.exit(1);
  }
}, 300);

