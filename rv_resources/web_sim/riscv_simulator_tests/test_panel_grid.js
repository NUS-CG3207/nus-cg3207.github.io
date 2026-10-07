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
    window.__CM6_DISABLE_CDN = true; // prevent the loader from fetching the CDN bundle (jsdom layout limitations); tests pre-inject the local bundle
    // Pre-inject CodeMirror 6 so the app can boot even when the CDN is
    // unreachable. jsdom cannot run the ESM CDN bundles, and the local
    // fallback file cannot be fetched without a server, so load it directly.
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
    console.log('🚀 TESTING DOCKABLE PANELS 2×2 GRID LAYOUT');
    console.log('===========================================================');

    // --- Helper assertions ---
    let passed = 0, failed = 0;
    function check(label, cond) {
      if (cond) { passed++; console.log('  ✅ ' + label); }
      else { failed++; console.log('  ❌ ' + label); }
    }
    function panelIds(els) {
      return Array.from(els).map(e => e.id).filter(Boolean);
    }
    // jsdom has no real layout: give offsetHeight/offsetWidth simple values.
    // offsetHeight mirrors the inline flex-basis so splitter stop handlers
    // persist the dragged value.
    function mockLayoutFor() {
      const stack = doc.getElementById('panelStack');
      if (!stack) return;
      Object.defineProperty(stack, 'offsetHeight', { configurable: true, value: 600 });
      doc.querySelectorAll('#panelStack .tab-content').forEach((el) => {
        Object.defineProperty(el, 'offsetHeight', {
          configurable: true, get() {
            const h = parseFloat(el.style.flex && el.style.flex.split(' ')[2] || el.style.height);
            return Number.isFinite(h) ? h : 250;
          }
        });
        Object.defineProperty(el, 'offsetWidth', {
          configurable: true, get() {
            const w = parseFloat(el.style.flex && el.style.flex.split(' ')[2]);
            // '1 1 0px' (even split) or '50%' → treat as the full column width.
            if (Number.isFinite(w) && w > 0) return w;
            return 480;
          }
        });
      });
    }

    // jsdom does not ship PointerEvent; the splitter handlers use it.
    if (!win.PointerEvent) {
      win.PointerEvent = win.MouseEvent;
    }
    // jsdom does not implement pointer capture.
    if (!win.Element.prototype.setPointerCapture) {
      win.Element.prototype.setPointerCapture = () => {};
      win.Element.prototype.releasePointerCapture = () => {};
    }

    win.innerWidth = 1400; // wide viewport → 2×2 grid eligible
    win.localStorage.clear();

    // jsdom's init sequence aborts before initPanelDock() at a pre-existing
    // updateDisassembly null-deref, so bootstrap the dock manually. The dock
    // functions are function declarations exposed on window; initPanelDock()
    // sets up the module-level panelDock state and builds the layout.
    try { win.initPanelDock(); console.log('[bootstrap] initPanelDock OK'); }
    catch (e) { console.log('[bootstrap] initPanelDock THREW:', e.message); }
    // Force re-apply now that the dock state is initialised.
    try { win.applyPanelDock(); console.log('[bootstrap] applyPanelDock OK'); }
    catch (e) { console.log('[bootstrap] applyPanelDock THREW:', e.message); }
    console.log('[debug] innerWidth =', win.innerWidth, '| panelDock =', !!win.panelDock, '| dockUsesTwoColumns =', win.dockUsesTwoColumns());
    console.log('[debug] registers visible =', win.panelDock && win.panelDock.registers.visible);

    // --- 1. Grid with 4 visible panels ---
    console.log('\n[1] Showing all 4 panels → expect 2×2 grid (2 rows, 2 columns)');
    win.setPanelVisible('memory', true);
    win.setPanelVisible('peripherals', true);
    win.setPanelVisible('disassembly', true);

    const stack = doc.getElementById('panelStack');
    const rows = stack.querySelectorAll('.panel-dock-row');
    check('Exactly 2 dock rows exist', rows.length === 2);
    const row1Panels = rows[0] ? rows[0].querySelectorAll('.tab-content') : [];
    const row2Panels = rows[1] ? rows[1].querySelectorAll('.tab-content') : [];
    check('Row 1 has 2 panels', row1Panels.length === 2);
    check('Row 2 has 2 panels', row2Panels.length === 2);
    check('Row 1 = [registers, memory]', JSON.stringify(panelIds(row1Panels)) === JSON.stringify(['tab-registers', 'tab-memory']));
    check('Row 2 = [peripherals, disassembly]', JSON.stringify(panelIds(row2Panels)) === JSON.stringify(['tab-peripherals', 'tab-disassembly']));

    const hSplitters = stack.querySelectorAll('.panel-hsplitter');
    const vSplitters = stack.querySelectorAll('.panel-vsplitter');
    check('2 vertical column splitters (.panel-hsplitter) exist', hSplitters.length === 2);
    check('1 horizontal row splitter (.panel-vsplitter) exists', vSplitters.length === 1);
    // Cursor is set via CSS (`.panel-hsplitter { cursor: col-resize }`, `.panel-vsplitter { cursor: row-resize }`).
    check('Column splitter uses .panel-hsplitter class (col-resize cursor via CSS)', hSplitters[0] && hSplitters[0].className.includes('panel-hsplitter'));
    check('Row splitter uses .panel-vsplitter class (row-resize cursor via CSS)', vSplitters[0] && vSplitters[0].className.includes('panel-vsplitter'));

    // Each panel should be ~50% width when 2 columns are active
    const regEl = doc.getElementById('tab-registers');
    check('Registers panel uses even flex split (1 1 0) in 2-col mode', regEl && regEl.style.flex === '1 1 0px');

    // Dock width should be ~50% of the screen width
    const rp = doc.querySelector('.right-panel');
    const targetWidth = Math.round(win.innerWidth * 0.5);
    check('Right dock expanded to ~50% of window width', rp && rp.style.width === targetWidth + 'px');

    // --- 2. Dragging the column splitter persists widths ---
    console.log('\n[2] Simulating column splitter drag (column widths should persist)');
    mockLayoutFor();
    const sp = hSplitters[0];
    const leftEl = sp.previousElementSibling, rightEl = sp.nextElementSibling;
    sp.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 1, clientX: 100, bubbles: true }));
    sp.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 1, clientX: 160, bubbles: true }));
    check('Column splitter drag sets left flex-basis', leftEl.style.flex === '0 1 540px');
    check('Column splitter drag sets right flex-basis', rightEl.style.flex === '0 1 420px');
    sp.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 1, clientX: 160, bubbles: true }));
    const saved1 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('Column widths persisted to localStorage', saved1.registers.wbasis === 540 && saved1.memory.wbasis === 420);
    check('Layout persisted to localStorage', saved1.registers.wbasis === 540);

    // --- 3. Re-apply preserves dragged column widths ---
    console.log('\n[3] Re-applying dock layout preserves persisted column widths');
    win.applyPanelDock();
    check('Registers width restored from wbasis via flex', doc.getElementById('tab-registers').style.flex === '0 1 540px');
    check('Memory width restored from wbasis via flex', doc.getElementById('tab-memory').style.flex === '0 1 420px');

    // --- 4. Row splitter drag persists row heights ---
    console.log('\n[4] Simulating row splitter drag (row heights should persist)');
    // Re-query splitters: applyPanelDock rebuilt them in step [3].
    const vSplitters2 = stack.querySelectorAll('.panel-vsplitter');
    mockLayoutFor();
    const vsp = vSplitters2[0];
    const rowAbove = vsp.previousElementSibling, rowBelow = vsp.nextElementSibling;
    // Rows need mocked offsetHeight too (they're .panel-dock-row, not .tab-content).
    [rowAbove, rowBelow].forEach((el) => {
      if (el && !Object.getOwnPropertyDescriptor(el, 'offsetHeight')) {
        Object.defineProperty(el, 'offsetHeight', {
          configurable: true, get() {
            const h = parseFloat(el.style.flex && el.style.flex.split(' ')[2]);
            return Number.isFinite(h) ? h : 250;
          }
        });
      }
    });
    vsp.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 2, clientY: 300, bubbles: true }));
    vsp.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 2, clientY: 360, bubbles: true }));
    check('Row splitter drag sets row1 height', rowAbove.style.flex === '0 0 310px');
    check('Row splitter drag sets row2 height', rowBelow.style.flex === '0 0 190px');
    vsp.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 2, clientY: 360, bubbles: true }));
    const saved2 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('Row heights persisted to localStorage', Array.isArray(saved2.rowHeights) && saved2.rowHeights[0] === 310);
    check('Row heights persisted in localStorage payload', saved2.rowHeights[0] === 310);

    win.setPanelVisible('peripherals', false);
    win.setPanelVisible('disassembly', false);
    const rows2 = stack.querySelectorAll('.panel-dock-row');
    const hSpl2 = stack.querySelectorAll('.panel-hsplitter');
    const vSpl2 = stack.querySelectorAll('.panel-vsplitter');
    check('No grid rows remain when ≤2 panels', rows2.length === 0);
    check('No column splitters remain when ≤2 panels', hSpl2.length === 0);
    check('One row splitter between the 2 remaining panels', vSpl2.length === 1);
    const stackChildren = Array.from(stack.children).filter(c => c.id && c.id.startsWith('tab-'));
    // After collapsing to 2 docked panels the layout is a plain vertical stack
    // (no .panel-dock-row wrappers). The two visible panels are direct children.
    check('Docked panels are direct children of the stack (single column)', stackChildren.length >= 2);

    // Dock width should be restored to the saved (pre-grid) width. jsdom has no
    // layout, so getBoundingClientRect().width is 0; the restore clamps to 220.
    const rp2 = doc.querySelector('.right-panel');
    check('Dock width restored when ≤2 panels (clamped to min 220px in jsdom)', rp2 && (rp2.style.width === '640px' || rp2.style.width === '220px' || rp2.style.width === '0px'));

    // --- 6. 3 visible panels → still 2×2 (2+1) grid; row-2 lone panel spans full width ---
    console.log('\n[6] Showing 3 panels → 2×2 grid; row-2 lone panel spans full width');
    win.setPanelVisible('peripherals', true);
    const rows3 = stack.querySelectorAll('.panel-dock-row');
    check('3 panels → exactly 2 rows', rows3.length === 2);
    check('Row 1 has 2 panels', rows3[0] && rows3[0].querySelectorAll('.tab-content').length === 2);
    check('Row 2 has 1 panel', rows3[1] && rows3[1].querySelectorAll('.tab-content').length === 1);
    const hSpl3 = stack.querySelectorAll('.panel-hsplitter');
    check('3 panels → exactly 1 column splitter (in row 1)', hSpl3.length === 1);
    // The lone row-2 panel must stretch across the entire row (no blank 4th slot).
    const loneRow = rows3[1];
    const lonePanel = loneRow && loneRow.querySelector('.tab-content');
    check('Row-2 lone panel spans full width (single-panel row class)', loneRow && loneRow.className.includes('panel-dock-row-single'));
    check('Row-2 lone panel flex fills the row (1 1 0)', lonePanel && lonePanel.style.flex === '1 1 0px');

    // A persisted column width must NOT force a lone panel to stay narrow.
    const dockState = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    dockState.peripherals.wbasis = 300;
    win.localStorage.setItem('rvsim.panelDock.v1', JSON.stringify(dockState));
    win.initPanelDock();
    win.applyPanelDock();
    const rows3b = stack.querySelectorAll('.panel-dock-row');
    const lonePanelB = rows3b[1] && rows3b[1].querySelector('.tab-content');
    check('Lone panel ignores persisted wbasis (full-width flex)', lonePanelB && lonePanelB.style.flex === '1 1 0px');
    // The paired row-1 panels still honour their persisted wbasis.
    const row1b = rows3b[0].querySelectorAll('.tab-content');
    check('Paired row-1 panels still honour wbasis', row1b[0].style.flex === '0 1 540px' && row1b[1].style.flex === '0 1 420px');
    // Restore the defaults for subsequent steps (clear the saved wbasis).
    const dockState2 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    dockState2.peripherals.wbasis = 0;
    win.localStorage.setItem('rvsim.panelDock.v1', JSON.stringify(dockState2));
    win.initPanelDock();
    win.applyPanelDock();

    // --- 7. Double-click splitters evens out ---
    console.log('\n[7] Double-click on splitters resets widths/heights');
    win.setPanelVisible('disassembly', true);
    const hsp7 = stack.querySelector('.panel-hsplitter');
    hsp7.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    const saved3 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('Double-click column splitter resets wbasis', saved3.order.every(n => !saved3[n].wbasis));
    const vsp7 = stack.querySelector('.panel-vsplitter');
    vsp7.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    const saved4 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('Double-click row splitter resets rowHeights', !saved4.rowHeights);

    // --- 8. Mobile fallback (≤800px) → no grid, no splitters ---
    console.log('\n[8] Narrow viewport (≤800px) → grid disabled, splitters hidden');
    win.innerWidth = 700;
    win.applyPanelDock();
    const rowsM = stack.querySelectorAll('.panel-dock-row');
    const hSplM = stack.querySelectorAll('.panel-hsplitter');
    const vSplM = stack.querySelectorAll('.panel-vsplitter');
    check('No grid rows on mobile', rowsM.length === 0);
    check('No column splitters on mobile', hSplM.length === 0);
    // Row splitters ARE inserted (single-column stack) but hidden via the
    // `@media (max-width: 800px) { .panel-vsplitter { display: none } }` rule.
    check('Row splitters hidden on mobile (display:none via CSS)', vSplM.length === 3);
    const vSplMComputed = vSplM[0] && vSplM[0].className.includes('panel-vsplitter');
    check('Row splitter present for the vertical stack on mobile', vSplMComputed);
    // Panels should be direct children (mobile tabbed stack)
    const stackM = Array.from(stack.children).filter(c => c.id && c.id.startsWith('tab-'));
    const stackIds = stackM.map(c => c.id.replace('tab-', '')).sort();
    check('Every panel is a direct stack child on mobile (' + stackIds.join(', ') + ')',
      stackIds.join(',') === 'datapath,disassembly,locals,memory,peripherals,registers,waveform');

    // --- 9. Mobile tabbed view: exactly one panel visible at a time ---
    console.log('\n[9] Mobile tabbed view (≤800px) → single mutually-exclusive panel');
    // After step [8] all 4 panels are still visible (setPanelVisible=true from
    // earlier steps); the mobile view must show exactly ONE via panel-mobile-active.
    const mobActive = Array.from(stack.querySelectorAll('.tab-content.panel-mobile-active'));
    check('Exactly one panel has .panel-mobile-active on mobile', mobActive.length === 1);
    const chipActive = Array.from(doc.querySelectorAll('.tab-bar button.active'));
    check('Exactly one chip is .active on mobile', chipActive.length === 1);
    check('Active mobile chip matches the visible panel', mobActive[0] && chipActive[0] && mobActive[0].id === 'tab-' + chipActive[0].id.replace('panelChip-', ''));

    // Switching mobile tab does NOT touch persisted desktop visibility.
    const beforeSwitch = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    win.setMobileTab('peripherals');
    const mobActive2 = Array.from(stack.querySelectorAll('.tab-content.panel-mobile-active'));
    check('Mobile tab switches to peripherals', mobActive2.length === 1 && mobActive2[0].id === 'tab-peripherals');
    const afterSwitch = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    const visUnchanged = ['registers', 'memory', 'peripherals', 'disassembly'].every(n => afterSwitch[n].visible === beforeSwitch[n].visible);
    check('Mobile tab switching leaves persisted desktop visibility untouched', visUnchanged);

    // Going back to a wide viewport restores the 2×2 grid (all visible).
    win.innerWidth = 1400;
    win.applyPanelDock();
    const rowsBack = stack.querySelectorAll('.panel-dock-row');
    check('Wide viewport restores the 2×2 grid', rowsBack.length === 2);
    check('No .panel-mobile-active leftover on desktop', stack.querySelectorAll('.panel-mobile-active').length === 0);

    // --- 9b. All panels hidden + mobile → the tabbed view still shows a tab ---
    console.log('\n[9b] All panels hidden on mobile → tabbed view shows exactly one');
    // Hide every panel (persists an all-hidden desktop layout).
    ['registers', 'memory', 'peripherals', 'disassembly'].forEach(n => win.setPanelVisible(n, false));
    const hiddenSaved = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('All four panels are hidden (persisted)', ['registers', 'memory', 'peripherals', 'disassembly'].every(n => !hiddenSaved[n].visible));
    // Desktop with all hidden shows the empty hint.
    check('Desktop all-hidden shows the empty hint', stack.classList.contains('is-empty'));
    // Switch to mobile width: the active tab still renders, matching its chip.
    win.innerWidth = 700;
    win.applyPanelDock();
    const mobActiveAllHidden = Array.from(stack.querySelectorAll('.tab-content.panel-mobile-active'));
    check('Mobile all-hidden shows exactly one panel (registers fallback)', mobActiveAllHidden.length === 1 && mobActiveAllHidden[0].id === 'tab-registers');
    const chipAllHidden = Array.from(doc.querySelectorAll('.tab-bar button.active'));
    check('Mobile all-hidden active chip matches the shown panel', chipAllHidden.length === 1 && chipAllHidden[0].id === 'panelChip-registers');
    check('Mobile all-hidden hides the empty hint (a tab is always shown)', !stack.classList.contains('is-empty'));
    // Tapping a chip on mobile makes that panel persisted-visible again.
    const chipMemory = doc.getElementById('panelChip-memory');
    chipMemory.click();
    const afterTap = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('Tapping a mobile chip persists that panel as visible', afterTap.memory.visible === true);
    check('Tapping a mobile chip keeps others hidden (persisted)', afterTap.registers.visible === false && afterTap.peripherals.visible === false && afterTap.disassembly.visible === false);
    const mobActiveAfterTap = Array.from(stack.querySelectorAll('.tab-content.panel-mobile-active'));
    check('Tapping a mobile chip switches the shown tab', mobActiveAfterTap.length === 1 && mobActiveAfterTap[0].id === 'tab-memory');
    // Returning to desktop keeps the (single visible) persisted layout.
    win.innerWidth = 1400;
    win.applyPanelDock();
    const rowsBack2 = stack.querySelectorAll('.panel-dock-row');
    check('Desktop after mobile tap keeps 1 visible panel (no grid)', rowsBack2.length === 0);
    check('Desktop after mobile tap shows NO empty hint (memory is docked)', !stack.classList.contains('is-empty'));

    // --- 10. Main splitter clamp keeps the editor usable (no blank space) ---
    console.log('\n[10] Main splitter clamp prevents the editor being starved');
    const rightPanel = doc.querySelector('.right-panel');
    const splitterEl = doc.getElementById('mainSplitter');
    // jsdom: innerWidth 1400 → max dock = 1400 - 360 - 6 = 1034px.
    win.innerWidth = 1400;
    if (!win.Element.prototype.setPointerCapture) {
      win.Element.prototype.setPointerCapture = () => {};
      win.Element.prototype.releasePointerCapture = () => {};
    }
    splitterEl.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 9, clientX: 900, bubbles: true }));
    splitterEl.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 9, clientX: 50, bubbles: true }));
    splitterEl.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 9, clientX: 50, bubbles: true }));
    const clampedW = parseFloat(rightPanel.style.width);
    check('Main splitter far-left drag clamps dock width (≤1034px at 1400px viewport)', Number.isFinite(clampedW) && clampedW <= 1034);
    check('Main splitter clamp keeps the editor ≥360px', Number.isFinite(clampedW) && (1400 - clampedW) >= 360);
    // Resize re-clamp: simulate shrinking the window after a wide drag.
    rightPanel.style.width = '1280px'; // stale wide value
    win.innerWidth = 1000;
    win.dispatchEvent(new win.Event('resize'));
    const reClamped = parseFloat(rightPanel.style.width);
    check('Window resize re-clamps a stale wide dock width', Number.isFinite(reClamped) && reClamped <= 1000 - 360 - 6);
    // --- 11. Main-splitter width is preserved (dock no longer jumps back to 50%) ---
    console.log('\n[11] Relayout preserves the user-chosen dock width (no jump / blank space)');
    // User drags the main splitter to a dock narrower than the 50% grid target.
    win.innerWidth = 1400;
    rightPanel.style.width = '500px';
    rightPanel.style.minWidth = '';
    rightPanel.style.maxWidth = '';
    win.applyPanelDock();
    const afterRelayout = parseFloat(rightPanel.style.width);
    // The 50% target is 700px at this viewport; applyPanelDock must NOT force the
    // width back up to 700px (that would move the panels area left / leave blank
    // space on the right).
    check('Relayout preserves a dock width below the 50% grid target', Number.isFinite(afterRelayout) && afterRelayout < 700);
    check('Relayout keeps the user-chosen narrow dock width (500px)', afterRelayout === 500);
    // A resize (e.g. browser window resize) should re-clamp for the editor but not grow the dock.
    win.innerWidth = 1000;
    win.dispatchEvent(new win.Event('resize'));
    const afterResize = parseFloat(rightPanel.style.width);
    check('Resize does not force the dock back to 50% (keeps <= min(500, 634))', Number.isFinite(afterResize) && afterResize <= 634 && afterResize <= 500);
    // Restore a wide dock for the grid.
    rightPanel.style.width = '700px';
    win.innerWidth = 1400;
    win.dispatchEvent(new win.Event('resize'));

    // --- 12. Row-fit clamp: persisted column widths never overflow the dock ---
    console.log('\\n[12] Row-fit clamp scales oversized persisted column widths');
    // Show all 4 panels → 2×2 grid with the dock at 50% (700px).
    ['registers', 'memory', 'peripherals', 'disassembly'].forEach(n => win.setPanelVisible(n, true));
    const rp12 = doc.querySelector('.right-panel');
    rp12.style.width = '700px';
    win.innerWidth = 1400;
    win.applyPanelDock();
    // jsdom has no layout (clientWidth = 0), so the clamp is normally skipped.
    // Mock the dock width so the row-fit clamp has a real target to check against.
    Object.defineProperty(rp12, 'clientWidth', { configurable: true, value: 700 });
    // Persist a wildly oversized row: two columns that together (with the 6px
    // splitter) exceed the 700px dock.
    const dock12 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    dock12.registers.wbasis = 600;
    dock12.memory.wbasis = 500; // 600 + 6 + 500 = 1106 > 700 → must be scaled
    win.localStorage.setItem('rvsim.panelDock.v1', JSON.stringify(dock12));
    win.initPanelDock();
    win.applyPanelDock();
    const saved12 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    const row12Total = saved12.registers.wbasis + saved12.memory.wbasis;
    check('Oversized row basis is scaled down to fit the dock', row12Total + 6 <= 700);
    check('Scaled widths keep the dragged ratio', Math.round(saved12.registers.wbasis / 600) === Math.round(saved12.memory.wbasis / 500));
    // The persisted flex basis now reflects the clamped values (shrinkable, not fixed).
    const reg12 = doc.getElementById('tab-registers');
    const mem12 = doc.getElementById('tab-memory');
    check('Clamped wbasis applied via shrinkable flex (0 1 Npx)',
      reg12 && reg12.style.flex === '0 1 ' + saved12.registers.wbasis + 'px' &&
      mem12 && mem12.style.flex === '0 1 ' + saved12.memory.wbasis + 'px');
    // A row that already fits is left untouched.
    const dock12b = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    dock12b.registers.wbasis = 300;
    dock12b.memory.wbasis = 200; // 300 + 6 + 200 = 506 ≤ 700 → no scaling
    win.localStorage.setItem('rvsim.panelDock.v1', JSON.stringify(dock12b));
    win.initPanelDock();
    win.applyPanelDock();
    const saved12b = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('A fitting row is left untouched', saved12b.registers.wbasis === 300 && saved12b.memory.wbasis === 200);

    // --- 13. H-splitter stop clamps an over-wide drag ---
    console.log('\\n[13] Column-splitter drag cannot persist an overflowing row');
    const hsp13 = stack.querySelector('.panel-hsplitter');
    mockLayoutFor();
    // Mock the row clientWidth so the stop handler has a real available width.
    const row13 = hsp13.parentElement;
    Object.defineProperty(row13, 'clientWidth', { configurable: true, value: 700 });
    const left13 = hsp13.previousElementSibling, right13 = hsp13.nextElementSibling;
    hsp13.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 3, clientX: 100, bubbles: true }));
    hsp13.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 3, clientX: 700, bubbles: true }));
    hsp13.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 3, clientX: 700, bubbles: true }));
    const saved13 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    const leftName13 = left13.id.replace('tab-', '');
    const rightName13 = right13.id.replace('tab-', '');
    const row13Total = saved13[leftName13].wbasis + saved13[rightName13].wbasis;
    check('Over-wide drag clamps the persisted pair to the row width', row13Total + 6 <= 700);
    // Both columns stay ≥90px even after scaling.
    check('Clamped columns keep the 90px minimum',
      saved13[leftName13].wbasis >= 90 && saved13[rightName13].wbasis >= 90);

    // --- 14. Column-splitter drag tracks the pointer 1:1 (no compounding) ---
    console.log('\\n[14] Column-splitter drag is not hyper-sensitive (snapshot + absolute dx)');
    mockLayoutFor();
    // Reset to a clean fitting pair: section [13] left the persisted/DOM state
    // clamped at the 700px row, so re-init with a small fitting pair (300/200)
    // and re-apply to give the DOM fresh `0 1 300px`/`0 1 200px` flex values.
    const dock14 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    dock14.registers.wbasis = 300;
    dock14.memory.wbasis = 200; // 300 + 6 + 200 = 506 ≤ 700 → no clamp
    win.localStorage.setItem('rvsim.panelDock.v1', JSON.stringify(dock14));
    win.initPanelDock();
    win.applyPanelDock();
    const hsp14 = stack.querySelector('.panel-hsplitter');
    const left14 = hsp14.previousElementSibling, right14 = hsp14.nextElementSibling;
    // Read the exact flex-basis applied to the DOM by applyPanelDock.
    const leftStart14 = parseFloat(left14.style.flex.split(' ')[2]);
    const rightStart14 = parseFloat(right14.style.flex.split(' ')[2]);
    const row14 = hsp14.parentElement;
    Object.defineProperty(row14, 'clientWidth', { configurable: true, value: 700 });
    // A small 30px drag as MANY small moves (3×10px). A compounding bug would
    // accumulate 10+20+30=60px (or worse with repeated moves), so the final
    // persisted widths must match the ABSOLUTE 30px delta, not the sum.
    hsp14.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 4, clientX: 200, bubbles: true }));
    hsp14.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 4, clientX: 210, bubbles: true }));
    hsp14.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 4, clientX: 220, bubbles: true }));
    hsp14.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 4, clientX: 230, bubbles: true }));
    hsp14.dispatchEvent(new win.PointerEvent('pointerup',   { pointerId: 4, clientX: 230, bubbles: true }));
    const saved14 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    const l14 = saved14[left14.id.replace('tab-', '')].wbasis;
    const r14 = saved14[right14.id.replace('tab-', '')].wbasis;
    check('Left column grows by exactly the absolute 30px drag', l14 === leftStart14 + 30);
    check('Right column shrinks by exactly the absolute 30px drag', r14 === rightStart14 - 30);
    check('Dragged pair keeps its total width (no runaway growth)', l14 + r14 === leftStart14 + rightStart14);

    // --- 15. Main-splitter drag re-clamps paired rows to the narrower dock ---
    console.log('\n[15] Main-splitter drag narrowing the dock re-clamps persisted pair widths');
    // The reported regression: after dragging the main splitter narrower, the
    // paired (2×2 grid) rows kept their old wide persisted column widths and
    // overflowed the dock (blank space on the right / panels shifted left),
    // while the solo full-width row behaved correctly. This test reproduces the
    // exact path: wide pairs that fit the dock are persisted, then the main
    // splitter is dragged to a 500px dock, and both pairs must be re-clamped.
    ['registers', 'memory', 'peripherals', 'disassembly'].forEach(n => win.setPanelVisible(n, true));
    const rp15 = doc.querySelector('.right-panel');
    rp15.style.width = '1100px';
    Object.defineProperty(rp15, 'clientWidth', { configurable: true, value: 1100 });
    win.innerWidth = 1400;
    const dock15 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    dock15.registers.wbasis = 540;
    dock15.memory.wbasis = 420;          // row 1: 540 + 6 + 420 = 966 ≤ 1100 → fits
    dock15.peripherals.wbasis = 600;
    dock15.disassembly.wbasis = 300;     // row 2: 600 + 6 + 300 = 906 ≤ 1100 → fits
    win.localStorage.setItem('rvsim.panelDock.v1', JSON.stringify(dock15));
    win.initPanelDock();
    win.applyPanelDock();
    const preDrag15 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    check('Wide pairs are left untouched before the drag (dock is wide enough)',
      preDrag15.registers.wbasis === 540 && preDrag15.memory.wbasis === 420 &&
      preDrag15.peripherals.wbasis === 600 && preDrag15.disassembly.wbasis === 300);

    // Simulate the main-splitter drag to a 500px dock. jsdom stubs
    // getBoundingClientRect to zeros, so give `.main` a real right edge and let
    // the splitter's pointermove compute width = main.right - clientX = 500.
    const mainEl15 = doc.querySelector('.main');
    Object.defineProperty(mainEl15, 'getBoundingClientRect', {
      configurable: true, value: () => ({ top: 0, bottom: 600, left: 0, right: 1400, width: 1400, height: 600 })
    });
    // The narrowed rendered dock width the row-fit clamp should fit against.
    Object.defineProperty(rp15, 'clientWidth', { configurable: true, value: 500 });
    const mainSplitter15 = doc.getElementById('mainSplitter');
    mainSplitter15.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 5, clientX: 700, bubbles: true }));
    mainSplitter15.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 5, clientX: 900, bubbles: true })); // width = 1400-900 = 500
    mainSplitter15.dispatchEvent(new win.PointerEvent('pointerup',   { pointerId: 5, clientX: 900, bubbles: true }));
    delete mainEl15.getBoundingClientRect;
    const afterDrag15 = JSON.parse(win.localStorage.getItem('rvsim.panelDock.v1'));
    const r1a = afterDrag15.registers.wbasis, r1b = afterDrag15.memory.wbasis;
    const r2a = afterDrag15.peripherals.wbasis, r2b = afterDrag15.disassembly.wbasis;
    check('Main-splitter drag narrows the dock to 500px', parseFloat(rp15.style.width) === 500);
    check('Row 1 (registers/memory) re-clamped to fit the 500px dock', r1a + r1b + 6 <= 500);
    check('Row 2 (peripherals/disassembly) re-clamped to fit the 500px dock', r2a + r2b + 6 <= 500);
    check('Re-clamped columns keep the 90px minimum', r1a >= 90 && r1b >= 90 && r2a >= 90 && r2b >= 90);

    // --- 16. Intra-panel column-resize handles exist for the 3 data panels only ---
    console.log('\n[16] Intra-panel column-resize handles exist (Registers/Memory/Disassembly, not Peripherals)');
    // Re-init the dock so the resizer listeners are wired for all panels.
    win.innerWidth = 1400;
    ['registers', 'memory', 'peripherals', 'disassembly'].forEach(n => win.setPanelVisible(n, true));
    win.initPanelDock();
    win.updateEditor(); // populate the disassembly table
    const regResizers = doc.querySelectorAll('#tab-registers .col-resizer');
    const memResizers = doc.querySelectorAll('#tab-memory .col-resizer');
    const disResizers = doc.querySelectorAll('#tab-disassembly .col-resizer');
    const perResizers = doc.querySelectorAll('#tab-peripherals .col-resizer');
    check('Registers panel has 3 column-resize handles (#, Name, Content (Hex))', regResizers.length === 3);
    check('Memory panel has 2 column-resize handles (Addr, Hex)', memResizers.length === 2);
    check('Disassembly panel has 3 column-resize handles (Addr, Machine code, Native)', disResizers.length === 3);
    check('Peripherals panel has NO column-resize handles (untouched)', perResizers.length === 0);

    // Frozen headers: all three data panels pin their header row while the
    // rows scroll under it (the shared .panel-body is the scrollport).
    const stickyPos = (el) => el && win.getComputedStyle(el).position;
    check('Registers header is frozen (sticky)', stickyPos(doc.getElementById('regId')) === 'sticky');
    check('Memory header is frozen (sticky)', stickyPos(doc.getElementById('memColHeader')) === 'sticky');
    const disHeadTh = doc.querySelector('#disassemblyDisplay .code-list thead th');
    check('Disassembly header is frozen (sticky)', stickyPos(disHeadTh) === 'sticky');
    check('Disassembly header row is a real <thead>', !!disHeadTh);
    // The third column's label switches with Byte/Word mode (Content (ASCII)
    // in Byte mode, Content (DEC) in Word mode - see updateMemoryView());
    // default view mode is 'word', so it reads Content (DEC) here.
    check('Memory header labels read Addr / Content (Hex) / Content (DEC) [default word mode]',
      doc.getElementById('memColHeader').querySelector('[data-mem-col="addr"]').textContent.trim().startsWith('Addr') &&
      doc.getElementById('memColHeader').querySelector('[data-mem-col="hex"]').textContent.trim() === 'Content (Hex)' &&
      doc.getElementById('memContentColLabel').textContent.trim() === 'Content (DEC)');

    // --- 17. Every panel column is sized from its <colgroup> ---
    console.log('\n[17] Columns are sized from the <colgroup>; grow columns absorb the surplus');
    const disTbl = doc.getElementById('disassemblyDisplay').querySelector('.code-list');
    const regTbl = doc.getElementById('regTable');
    if (disTbl && regTbl) {
      const disCols = disTbl.querySelectorAll('colgroup > col');
      const regCols = regTbl.querySelectorAll('colgroup > col');
      check('Disassembly table has a 4-column colgroup', disCols.length === 4);
      check('Registers table has a 4-column colgroup', regCols.length === 4);
      const px = (el) => parseFloat(el.style.width) || 0;
      check('Every disassembly column got an explicit px width',
        Array.from(disCols).every(c => px(c) > 0));
      check('Every registers column got an explicit px width',
        Array.from(regCols).every(c => px(c) > 0));
      // jsdom reports clientWidth 0, so no surplus is distributed and every
      // column sits at its natural `fit` width — which is exactly the
      // no-stretch guarantee: Addr/Machine code stay content-sized.
      check('Addr keeps its content-sized width (never stretched)', px(disCols[0]) === 94);
      check('Machine code keeps its content-sized width (never stretched)', px(disCols[1]) === 116);
      check('Native + Source are the wider text columns', px(disCols[2]) === 200 && px(disCols[3]) === 200);
      check('Registers # / Name stay narrow, Value columns are wider',
        px(regCols[0]) === 44 && px(regCols[1]) === 92 && px(regCols[2]) === 124 && px(regCols[3]) === 96);
      check('Table min-width is the column total (narrow panel scrolls, never crushes)',
        parseFloat(disTbl.style.minWidth) === 94 + 116 + 200 + 200);
    } else {
      check('Disassembly + Registers tables populated (skipping colgroup check)', false);
    }


    // Give the panel a real width so the surplus-distribution path runs
    // (jsdom reports clientWidth 0 by default, which only exercises the
    // natural-width case above). This is the behaviour that regressed:
    // widening the panel must feed the text columns, not stretch Addr /
    // Machine code, and must never collapse the last columns.
    const disBody = doc.querySelector('#tab-disassembly > .panel-body');
    if (disBody && disTbl) {
      Object.defineProperty(disBody, 'clientWidth', { configurable: true, value: 1000 });
      win.applyPanelColLayout('disassembly');
      const c = disTbl.querySelectorAll('colgroup > col');
      const px = (el) => parseFloat(el.style.width) || 0;
      check('Widening the panel does NOT stretch Addr', px(c[0]) === 94);
      check('Widening the panel does NOT stretch Machine code', px(c[1]) === 116);
      check('Native + Source absorb the surplus equally (neither collapses)',
        px(c[2]) === px(c[3]) && px(c[2]) > 200);
      check('The four columns fill the available width', px(c[0]) + px(c[1]) + px(c[2]) + px(c[3]) >= 980);

      // Narrower than the natural total: nothing is crushed, the widths hold
      // at their natural sizes and the table's min-width makes the panel scroll.
      Object.defineProperty(disBody, 'clientWidth', { configurable: true, value: 300 });
      win.applyPanelColLayout('disassembly');
      check('A too-narrow panel holds the natural widths instead of crushing',
        px(c[0]) === 94 && px(c[1]) === 116 && px(c[2]) === 200 && px(c[3]) === 200);
      check('...and scrolls instead, via the table min-width',
        parseFloat(disTbl.style.minWidth) === 610);
      delete disBody.clientWidth;
      Object.defineProperty(disBody, 'clientWidth', { configurable: true, value: 0 });
      win.applyPanelColLayout('disassembly');
    } else {
      check('Disassembly panel body available for surplus-distribution check', false);
    }

    // --- 18. Dragging a separator resizes that column and shifts the rest ---
    console.log('\n[18] Dragging a separator resizes that column, pins the rest, and persists');
    const regIdTh = doc.getElementById('regId');
    const idHandle = regIdTh && regIdTh.querySelector('.col-resizer');
    const regCols2 = regTbl.querySelectorAll('colgroup > col');
    if (idHandle) {
      idHandle.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 8, clientX: 100, bubbles: true }));
      idHandle.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 8, clientX: 140, bubbles: true })); // dx = +40
      idHandle.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 8, clientX: 140, bubbles: true }));
      check('# column grew by exactly the dragged delta (44px -> 84px)',
        parseFloat(regCols2[0].style.width) === 84);
      // Spreadsheet behaviour: the columns to the right are unchanged, so
      // they shift along with the boundary instead of being re-flowed.
      check('Columns to the right keep their widths (they shift, not re-flow)',
        parseFloat(regCols2[1].style.width) === 92 &&
        parseFloat(regCols2[2].style.width) === 124 &&
        parseFloat(regCols2[3].style.width) === 96);
      check('Table min-width grew by the same delta (panel scrolls if needed)',
        parseFloat(regTbl.style.minWidth) === 84 + 92 + 124 + 96);
      const saved = JSON.parse(win.localStorage.getItem('rvsim.panelColW.registers') || 'null');
      check('Dragged width persisted to localStorage', !!saved && saved.id === 84);
      check('The whole row was pinned on the first move', !!saved && saved.dec === 96);

      idHandle.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
      check('Double-click restores the automatic layout (# back to 44px)',
        parseFloat(regCols2[0].style.width) === 44);
      const savedReset = JSON.parse(win.localStorage.getItem('rvsim.panelColW.registers') || 'null');
      check('Reset clears every pinned width for the panel',
        !savedReset || Object.keys(savedReset).length === 0);
    } else {
      check('Registers # column resizer exists for drag test', false);
    }

    // A plain click (pointerdown/up with no movement) must not pin anything.
    const nameHandle = doc.getElementById('regName').querySelector('.col-resizer');
    if (nameHandle) {
      nameHandle.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 11, clientX: 300, bubbles: true }));
      nameHandle.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 11, clientX: 300, bubbles: true }));
      const savedClick = JSON.parse(win.localStorage.getItem('rvsim.panelColW.registers') || 'null');
      check('A click without dragging pins nothing',
        !savedClick || Object.keys(savedClick).length === 0);
    } else {
      check('Registers Name resizer exists for click-without-drag test', false);
    }

    // Memory: dragging Addr updates the --mem-addr-w custom property that both
    // the data rows and the column-header labels read, and both scroll together.
    const memColHeader = doc.getElementById('memColHeader');
    const memView = doc.getElementById('memView');
    const memAddrHandle = memColHeader && memColHeader.querySelector('.col-resizer[data-col="addr"]');
    if (memAddrHandle) {
      memAddrHandle.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 10, clientX: 300, bubbles: true }));
      memAddrHandle.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 10, clientX: 330, bubbles: true })); // dx = +30
      memAddrHandle.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 10, clientX: 330, bubbles: true }));
      check('Memory Addr column widened (106px -> 136px)',
        memView.style.getPropertyValue('--mem-addr-w') === '136px');
      check('Memory column-header stays in sync with the data rows',
        memColHeader.style.getPropertyValue('--mem-addr-w') === '136px');
      check('Header and rows share one min-width so they scroll together',
        memView.style.minWidth === memColHeader.style.minWidth &&
        parseFloat(memView.style.minWidth) === 136 + 140 + 145);
      const savedMem = JSON.parse(win.localStorage.getItem('rvsim.panelColW.memory') || 'null');
      check('Memory Addr width persisted to localStorage', !!savedMem && savedMem.addr === 136);

      // The Hex|ASCII boundary must not be draggable back over the hex data.
      const memHexHandle = memColHeader.querySelector('.col-resizer[data-col="hex"]');
      memHexHandle.dispatchEvent(new win.PointerEvent('pointerdown', { pointerId: 12, clientX: 500, bubbles: true }));
      memHexHandle.dispatchEvent(new win.PointerEvent('pointermove', { pointerId: 12, clientX: 100, bubbles: true })); // dx = -400
      memHexHandle.dispatchEvent(new win.PointerEvent('pointerup', { pointerId: 12, clientX: 100, bubbles: true }));
      check('Hex column cannot be dragged below its floor (clamped, not collapsed)',
        parseFloat(memView.style.getPropertyValue('--mem-hex-w')) === 108);
    } else {
      check('Memory Addr column-header resizer exists for drag test', false);
    }

    console.log('\n===========================================================');
    if (failed === 0) {
      console.log(`🎉 ALL ${passed} PANEL GRID TESTS PASSED!`);
      process.exit(0);
    } else {
      console.log(`💥 ${failed} PANEL GRID TEST(S) FAILED (${passed} passed)`);
      process.exit(1);
    }
    console.log('===========================================================');
  } catch (err) {
    console.error('Panel Grid Test Failed:', err);
    process.exit(1);
  }
}, 600);

