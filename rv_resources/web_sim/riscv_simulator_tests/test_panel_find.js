// Panel row filter: the 🔍 button in each panel header narrows that panel's
// rows. Peripherals has controls rather than rows, so it has no filter.
const fs = require('fs');
const path = require('path');
let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  JSDOM = require(path.resolve(__dirname, 'node_modules/jsdom')).JSDOM;
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
        putImageData: () => {}, fillRect: () => {}, clearRect: () => {},
        drawImage: () => {}, getImageData: () => ({ data: new Uint8Array(4) }),
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
    console.log('🚀 TESTING PANEL ROW FILTER');
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
    win.innerWidth = 1400;
    win.localStorage.clear();

    try { win.initPanelDock(); } catch (e) { console.log('[bootstrap] initPanelDock:', e.message); }
    try { win.applyPanelDock(); } catch (e) { console.log('[bootstrap] applyPanelDock:', e.message); }

    const findBtn = (name) => {
      const el = doc.getElementById('tab-' + name);
      return el && el.querySelector(':scope > .panel-hdr [data-panel-act="find"]');
    };
    const findBar = (name) => doc.getElementById('panelFind-' + name);
    const findInput = (name) => { const b = findBar(name); return b && b.querySelector('input'); };
    const countText = (name) => {
      const b = findBar(name);
      const c = b && b.querySelector('.panel-find-count');
      return c ? c.textContent : null;
    };
    // Drive the filter the way a user does: type into the box, don't call the
    // setter. That covers the input listener as well as the filter itself.
    const type = (name, text) => {
      const input = findInput(name);
      input.value = text;
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    };

    // --- 1. Which panels get a filter ---
    console.log('\n[1] Filter button presence');
    ['registers', 'memory', 'disassembly', 'locals'].forEach(n => {
      check(`${n} has a 🔍 button`, !!findBtn(n));
      check(`${n} has a filter bar`, !!findBar(n));
    });
    check('peripherals has NO 🔍 button', !findBtn('peripherals'));
    check('peripherals has NO filter bar', !findBar('peripherals'));

    check('the bar starts hidden', findBar('registers').hidden === true);
    // .panel-find sets display:flex, and a class selector outranks the UA's
    // [hidden] rule, so the closed state needs its own rule. Assert the CSS
    // text rather than computed style: jsdom does not cascade UA sheets.
    check('CSS spells out the closed state so display:flex cannot leak through',
      html.includes('.panel-find[hidden]'));
    check('🔍 sits to the left of the detach button', (() => {
      const acts = doc.querySelector('#tab-registers > .panel-hdr .panel-hdr-actions');
      const order = Array.from(acts.children).map(b => b.getAttribute('data-panel-act'));
      return order.indexOf('find') === 0 && order.indexOf('float') === 1;
    })());

    // --- 2. Registers ---
    console.log('\n[2] Registers filter');
    win.setPanelVisible('registers', true);
    win.updateRegisters();
    const regRows = () => doc.querySelectorAll('#regBody tr').length;
    check('all 32 registers render unfiltered', regRows() === 32);

    win.togglePanelFind('registers');
    check('🔍 reveals the bar', findBar('registers').hidden === false);

    type('registers', 'sp');
    check('filtering to "sp" leaves exactly 1 row', regRows() === 1);
    check('the surviving row is x2/sp',
      doc.querySelector('#regBody tr').textContent.includes('sp'));
    check('count reads "1 of 32"', countText('registers') === '1 of 32');
    check('the 🔍 button marks itself active', findBtn('registers').classList.contains('active'));

    // Matching is case-insensitive and reaches the numeric columns too.
    type('registers', 'X1');
    check('"X1" matches x1 case-insensitively (and x10-x19, x21...)', regRows() >= 1);
    check('"X1" does not match everything', regRows() < 32);

    type('registers', 'zzzz');
    check('a filter matching nothing leaves 0 rows', regRows() === 0);
    check('count reads "0 of 32"', countText('registers') === '0 of 32');

    // A refresh from elsewhere (a step, an edit) must not drop the filter.
    win.updateRegisters();
    check('filter survives an unrelated updateRegisters()', regRows() === 0);
    win.refreshPanel('registers');
    check('filter survives refreshPanel()', regRows() === 0);

    type('registers', '');
    check('clearing the box restores all 32 rows', regRows() === 32);
    check('count is blank when no filter is set', countText('registers') === '');
    check('🔍 button is no longer active', !findBtn('registers').classList.contains('active'));

    // --- 3. Close clears ---
    console.log('\n[3] Closing the bar clears the filter');
    type('registers', 'sp');
    check('filtered again', regRows() === 1);
    win.togglePanelFind('registers');
    check('🔍 hides the bar', findBar('registers').hidden === true);
    check('closing restored all rows', regRows() === 32);
    check('the input was emptied', findInput('registers').value === '');

    // --- 4. Memory ---
    console.log('\n[4] Memory filter');
    win.setPanelVisible('memory', true);
    doc.getElementById('memAddr').value = '00000000';
    doc.getElementById('memRows').value = '16';
    win.updateMemoryView();
    const memRows = () => doc.querySelectorAll('#memView > div').length;
    const memTotal = memRows();
    check('memory renders the requested row window', memTotal === 16);

    win.togglePanelFind('memory');
    type('memory', '0x00000000');
    check('filtering to one address leaves 1 row', memRows() === 1);
    check('count reflects the window, not the whole segment',
      countText('memory') === '1 of ' + memTotal);

    type('memory', '');
    check('clearing restores the full window', memRows() === memTotal);
    win.togglePanelFind('memory');

    // --- 4b. Memory rows are findable by the names shown on them ---
    console.log('\n[4b] Memory: labels and MMIO register names are searchable');
    win.editor.value = [
      '.text', 'main:', '  addi t0, x0, 1', '  jal x0, main',
      '.data', 'myvar:', '  .word 0xdeadbeef'
    ].join('\n');
    win.assembleOnly();
    win.memGo('data');
    win.togglePanelFind('memory');
    const dataTotal = memRows();
    type('memory', 'myvar');
    check('a data label finds its row (was invisible to the filter before)',
      memRows() === 1 && memRows() < dataTotal);
    type('memory', 'deadbeef');
    check('the hex run is still findable', memRows() === 1);
    type('memory', '');
    win.togglePanelFind('memory');

    // --- 5. Disassembly ---
    console.log('\n[5] Disassembly filter');
    win.setPanelVisible('disassembly', true);
    win.editor.value = [
      '.text',
      'main:',
      '  addi t0, x0, 5',
      '  addi t1, x0, 7',
      'loop:',
      '  add  t2, t0, t1',
      '  jal  ra, helper',
      '  beq  t0, t1, loop',
      'helper:',
      '  jalr x0, 0(ra)'
    ].join('\n');
    win.assembleOnly();
    win.updateDisassembly();
    // Count by the address cell so the table's own header row is excluded.
    const disasmRows = () => doc.querySelectorAll('#disassemblyDisplay tr:not(.disasm-label-row) td.addr').length;
    const labelRows = () => doc.querySelectorAll('#disassemblyDisplay tr.disasm-label-row').length;
    const total = disasmRows();
    check('disassembly renders every instruction', total >= 6);
    check('label heading rows render when unfiltered', labelRows() >= 3);

    win.togglePanelFind('disassembly');
    type('disassembly', 'jal');
    const jalRows = disasmRows();
    check('filtering to "jal" keeps only jal/jalr', jalRows === 2);
    check('every surviving row mentions jal',
      Array.from(doc.querySelectorAll('#disassemblyDisplay tr:not(.disasm-label-row) td.addr'))
        .every(td => td.parentElement.textContent.toLowerCase().includes('jal')));
    check('count reads "2 of ' + total + '"', countText('disassembly') === jalRows + ' of ' + total);
    check('a heading is kept for a surviving row, dropped for a filtered-out one',
      labelRows() >= 1 && labelRows() < 3);

    // Labels are the thing people search for, and a label names a block, not
    // just the one instruction sitting exactly on its address.
    type('disassembly', 'loop');
    const loopRows = disasmRows();
    check('searching a label shows the whole block under it, not one row', loopRows === 3);
    check('the label heading comes with it',
      Array.from(doc.querySelectorAll('#disassemblyDisplay tr.disasm-label-row'))
        .some(tr => /loop/.test(tr.textContent)));
    check('the block stops at the next label',
      !Array.from(doc.querySelectorAll('#disassemblyDisplay td.addr'))
        .some(td => td.parentElement.textContent.includes('jalr')));

    type('disassembly', 'helper');
    // Two hits, and both are wanted: the instruction that references the
    // label, and the block sitting under it.
    check('a label search finds both the call site and its target block',
      disasmRows() === 2);
    check('one of them is the jal that names it, the other the block body',
      Array.from(doc.querySelectorAll('#disassemblyDisplay td.addr'))
        .map(td => td.parentElement.textContent).some(t => /jal x1, helper/.test(t)) &&
      Array.from(doc.querySelectorAll('#disassemblyDisplay td.addr'))
        .map(td => td.parentElement.textContent).some(t => /jalr/.test(t)));

    type('disassembly', '');
    check('clearing restores every instruction', disasmRows() === total);
    check('label headings come back', labelRows() >= 3);

    // --- 6. Locals ---
    console.log('\n[6] Locals filter');
    // Locals is C-mode only; in ASM mode it shows a notice and no rows, and
    // the count must still be honest rather than stale.
    win.togglePanelFind('locals');
    type('locals', 'anything');
    check('locals reports "0 of 0" with no C program loaded',
      countText('locals') === '0 of 0');
    type('locals', '');
    check('clearing locals leaves a blank count', countText('locals') === '');

    // --- 7. Independence ---
    console.log('\n[7] Filters are per-panel');
    type('registers', 'sp');
    check('registers filtered to 1', regRows() === 1);
    check('disassembly untouched by the registers filter', disasmRows() === total);

    console.log('\n===========================================================');
    if (failed === 0) {
      console.log(`🎉 ALL ${passed} PANEL FIND TESTS PASSED!`);
      process.exit(0);
    } else {
      console.log(`💥 ${failed} PANEL FIND TEST(S) FAILED (${passed} passed)`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Panel Find Test Failed:', err);
    process.exit(1);
  }
}, 600);
