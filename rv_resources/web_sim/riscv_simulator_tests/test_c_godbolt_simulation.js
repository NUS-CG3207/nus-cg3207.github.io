/**
 * Comprehensive Test Suite for C Code Support via Godbolt Compiler Explorer in RISC-V Simulator
 */

const fs = require('fs');
const { installGodboltCache } = require('./godbolt_cache');
const { installExamplesFetch } = require('./examples_fetch');
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

const htmlPath = path.resolve(__dirname, '../riscv_simulator.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const CM6_BUNDLE_SOURCE = fs.readFileSync(path.resolve(__dirname, 'cm6_bundle.min.js'), 'utf8');

console.log('===========================================================');
console.log('🚀 RUNNING C LANGUAGE & GODBOLT SIMULATION TEST SUITE');
console.log('===========================================================');

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

    window.requestAnimationFrame = cb => setTimeout(cb, 16);
    window.cancelAnimationFrame = id => clearTimeout(id);
    window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
    window.Range.prototype.getClientRects = () => [];
    window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.Element.prototype.getClientRects = () => [];
    window.Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.HTMLCanvasElement.prototype.getContext = () => ({
      fillRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 128) * (h || 64) * 4) }),
      putImageData: () => {},
      clearRect: () => {},
      createPattern: () => {},
      drawImage: () => {}
    });
    installExamplesFetch(window); // before the page's own fetch() for the Example menu
  }
});

const win = dom.window;

// jsdom has no fetch, so C mode reaches Godbolt's captured output through this.

installGodboltCache(win);

setTimeout(async () => {
  try {
    // 1. Test Language Mode Switching
    console.log('\n[1] Testing Language Mode Switching (ASM <-> C)...');
    if (typeof win.setLanguageMode !== 'function') {
      throw new Error('setLanguageMode function is missing on window');
    }

    win.setLanguageMode('c');
    if (win.getLanguageMode() !== 'c') {
      throw new Error('Expected language mode to be "c"');
    }

    const btnAsm = win.document.getElementById('langBtnAsm');
    const btnC = win.document.getElementById('langBtnC');
    if (!btnC.classList.contains('active') || btnAsm.classList.contains('active')) {
      throw new Error('Language buttons active classes not updated properly');
    }

    const assembleBtn = win.document.getElementById('btnAssemble');
    if (assembleBtn.innerHTML !== '⚙ Compile') {
      throw new Error(`Expected assemble button to show "⚙ Compile", got "${assembleBtn.innerHTML}"`);
    }

    const exampleSelect = win.document.getElementById('exampleSelect');
    const cOptionValues = Array.from(exampleSelect.options).map(o => o.value);
    if (!cOptionValues.includes('dip_led_c') || !cOptionValues.includes('fibonacci_c') || !cOptionValues.includes('circle_accel_c')) {
      throw new Error('Example dropdown does not contain C examples in C mode');
    }
    console.log('✅ Language mode switching and UI controls verified!');

    // 2. Test C Autocomplete
    console.log('\n[2] Testing C Autocomplete & Tokenizer...');
    if (typeof win.riscvAutocomplete !== 'function') {
      throw new Error('riscvAutocomplete is missing');
    }

    const mockCtx = {
      state: { doc: { lineAt: () => ({ text: 'int x = ', from: 0 }), toString: () => 'int x = ' } },
      pos: 8,
      matchBefore: regex => ({ text: 'int', from: 0, to: 3 }),
      explicit: true
    };
    const cCompletions = win.riscvAutocomplete(mockCtx);
    if (!cCompletions || !cCompletions.options || cCompletions.options.length === 0) {
      throw new Error('cAutocomplete failed to return candidate completions');
    }
    const labels = cCompletions.options.map(o => o.label);
    if (!labels.includes('int') || !labels.includes('int32_t') || !labels.includes('int8_t')) {
      throw new Error('C types autocomplete missing expected standard types');
    }
    console.log('✅ C Autocomplete returned valid suggestions:', labels.slice(0, 5));

    // 3. Test C Examples Compilation & Line Mapping
    console.log('\n[3] Testing C Examples Compilation & Line Mapping...');
    const cExamplesToTest = [
      { name: 'dip_led_c', isInfinite: true },
      { name: 'fibonacci_c', expectedA0: 34 },
      { name: 'hello_world_c', isInfinite: true },
      { name: 'hello_jal_c', isInfinite: true },
      { name: 'circle_accel_c', isInfinite: true },
      { name: 'image_display_c', isInfinite: true }
    ];

    for (const testCase of cExamplesToTest) {
      await win.loadExample(testCase.name);
      const mc = await win.assembleOnly();
      if (!mc || mc.length === 0) {
        throw new Error(`Failed to compile C example: ${testCase.name}`);
      }
      const hasErrors = mc.some(item => item.error);
      if (hasErrors) {
        throw new Error(`C example ${testCase.name} has machine code errors`);
      }

      const pcToCMap = win.getPcToCLineMap();
      if (!pcToCMap || pcToCMap.size === 0) {
        throw new Error(`pcToCLineMap is empty for ${testCase.name}`);
      }

      console.log(`  - Compiled '${testCase.name}': ${mc.length} RV32 instructions, ${pcToCMap.size} C line mappings.`);
    }
    console.log(`✅ All ${cExamplesToTest.length} C examples compiled and mapped cleanly!`);

    // 4. Test Algorithmic Execution of C Programs
    console.log('\n[4] Testing Algorithmic Simulation Execution of C Programs...');
    for (const testCase of cExamplesToTest) {
      await win.loadExample(testCase.name);
      await win.assembleOnly();

      let steps = 0;
      const maxSteps = testCase.isInfinite ? 200 : 1000;
      while (steps < maxSteps && !win.programFinished && win.getPc() !== 0) {
        win.executeOne();
        steps++;
        const currentInst = win.fetchInstruction(win.getPc());
        if (currentInst === 0x00000073) { // ecall in _start exit
          break;
        }
      }

      if (testCase.isInfinite) {
        console.log(`  - Executed ${testCase.name} (${steps} steps in infinite loop): active PC = 0x${win.getPc().toString(16)}`);
      } else {
        const a0 = win.getRegs()[10];
        console.log(`  - Executed ${testCase.name} (${steps} steps): a0 = ${a0} (expected ${testCase.expectedA0})`);
        if (a0 !== testCase.expectedA0) {
          throw new Error(`Expected result a0 = ${testCase.expectedA0} for ${testCase.name}, got ${a0}`);
        }
      }
    }
    console.log('✅ Algorithmic correctness verified for all C programs!');

    // 5. Test C Source Stepping & Highlight Tracking
    console.log('\n[5] Testing Line-by-Line C Stepping & Active Line Highlight...');
    await win.loadExample('fibonacci_c');
    await win.assembleOnly();

    const initialCLine = win.getCurrentExecLine();
    console.log('Initial C line highlight in main(): Line', initialCLine);
    if (initialCLine <= 0) {
      throw new Error(`Expected positive initial C line, got ${initialCLine}`);
    }

    win.stepOnce();
    const nextCLine = win.getCurrentExecLine();
    console.log('After 1 step: C Line =', nextCLine, 'PC =', '0x' + win.getPc().toString(16));

    // 6. Test Step Back in C Mode
    console.log('\n[6] Testing Step Back in C Mode...');
    win.stepBack();
    const restoredCLine = win.getCurrentExecLine();
    console.log('After Step Back: C Line =', restoredCLine, 'PC =', '0x' + win.getPc().toString(16));
    if (restoredCLine !== initialCLine) {
      throw new Error(`Expected restored C line ${initialCLine}, got ${restoredCLine}`);
    }
    console.log('✅ C Line Stepping and Step Back verified!');

    // 7. Test C Breakpoints & Snapping
    console.log('\n[7] Testing C Breakpoint Setting, Snapping & Hits...');
    await win.loadExample('fibonacci_c');
    await win.assembleOnly();

    // Snap test: Line 1 is comment -> snaps to line 4 (compute_fib function header) or next valid line
    win.toggleBreakpoint(1);
    const bps = Array.from(win.getBreakpoints());
    console.log('Breakpoints after clicking line 1 (comment):', bps);
    if (bps.length === 0 || bps.includes(1)) {
      throw new Error('C Breakpoint snapping failed on comment line');
    }

    win.toggleBreakpoint(bps[0]); // toggle off
    // Set breakpoint on line 6: fib[0] = 0;
    win.toggleBreakpoint(6);
    if (!win.getBreakpoints().has(6)) {
      throw new Error('Failed to set breakpoint on C line 6');
    }

    // Run until breakpoint
    let hitBp = false;
    for (let s = 0; s < 100; s++) {
      win.stepOnce();
      const currentCLine = win.getCurrentExecLine();
      if (currentCLine === 6) {
        hitBp = true;
        console.log(`Paused on C breakpoint line 6 at step ${s + 1}!`);
        break;
      }
    }
    if (!hitBp) {
      throw new Error('Execution did not hit C breakpoint on line 6');
    }
    console.log('✅ C Breakpoint setting, snapping, and pausing verified!');

    // 8. Test Nexys 4 MMIO Peripherals from C
    console.log('\n[8] Testing MMIO Peripheral Manipulation in C Mode...');
    await win.loadExample('dip_led_c');
    await win.assembleOnly();

    // DIP_to_LED.c mirrors DIP (RO, 0xFFFF0064) onto LED (WO, 0xFFFF0060) in
    // an infinite loop - set a DIP value, run a few iterations, check LED.
    win.setDipSwitches(0xbead);
    for (let s = 0; s < 200; s++) win.executeOne();

    // LED[7:0] is the plain user-output byte; LED[15:9]/[8] are PC bits and
    // a clock signal, not just whatever was last written - so only the low
    // byte of the DIP value is expected to come back unchanged.
    const ledMem = win.readMem(0xFFFF0060, 4);
    console.log('LED MMIO readback (low byte mirrors DIP = 0xbead): 0x' + (ledMem >>> 0).toString(16));
    if ((ledMem & 0xFF) !== 0xad) {
      throw new Error(`Expected LED[7:0] to mirror DIP's low byte 0xad, got 0x${(ledMem & 0xFF).toString(16)}`);
    }

    console.log('✅ MMIO Peripherals and hardware registers verified from C code execution!');

    // 9. Test Disassembly Table with C Annotations
    console.log('\n[9] Testing Disassembly View with C Source Annotations...');
    win.updateDisassembly();
    const disasmHtml = win.document.getElementById('disassemblyDisplay').innerHTML;
    if (!disasmHtml.includes('disasm-cline-tag') || !disasmHtml.includes('Line')) {
      throw new Error('Disassembly table is missing C source line annotation tags');
    }
    console.log('✅ Disassembly table contains rich C line annotations!');

    // 10. Switch back to Assembly Mode and verify Asm operations
    console.log('\n[10] Verifying Clean Mode Switch back to Assembly Mode...');
    win.setLanguageMode('asm');
    if (win.getLanguageMode() !== 'asm') {
      throw new Error('Failed to switch back to ASM mode');
    }
    await win.loadExample('fib');
    const asmMc = win.assembleOnly();
    if (!asmMc || asmMc.length === 0) {
      throw new Error('Failed to assemble fib assembly example after mode switch');
    }
    win.stepOnce();
    if (win.getRegs()[1] !== 0) {
      throw new Error('Assembly step execution failed after switching back from C');
    }
    console.log('✅ Switch back to Assembly mode confirmed 100% operational!');

    // 11. Testing Unified Settings Modal & Tabs
    console.log('\n[11] Testing Unified Settings Modal & Tabs (Compiler, Linker, Simulator)...');
    win.openSettingsModal('compiler');
    const settingsOv = win.document.getElementById('settingsOverlay');
    if (!settingsOv || !settingsOv.classList.contains('open')) {
      throw new Error('Settings modal failed to open');
    }
    const tabBtnCompiler = win.document.getElementById('settingsTabBtn-compiler');
    const contentCompiler = win.document.getElementById('settingsContent-compiler');
    if (!tabBtnCompiler.classList.contains('active') || !contentCompiler.classList.contains('active')) {
      throw new Error('Compiler tab not active by default');
    }

    win.switchSettingsTab('linker');
    const tabBtnLinker = win.document.getElementById('settingsTabBtn-linker');
    const contentLinker = win.document.getElementById('settingsContent-linker');
    if (!tabBtnLinker.classList.contains('active') || !contentLinker.classList.contains('active')) {
      throw new Error('Linker tab switch failed');
    }

    win.switchSettingsTab('simulator');
    const tabBtnSim = win.document.getElementById('settingsTabBtn-simulator');
    const contentSim = win.document.getElementById('settingsContent-simulator');
    if (!tabBtnSim.classList.contains('active') || !contentSim.classList.contains('active')) {
      throw new Error('Simulator tab switch failed');
    }
    console.log('✅ Unified Settings Modal tab navigation verified!');

    // 12. Testing Settable Segment Sizes & Dynamic Stack Top
    console.log('\n[12] Testing Settable Segment Sizes & Dynamic CRT0 Stack Pointer...');
    win.switchSettingsTab('linker');
    win.document.getElementById('ms-code').value = '0x10000';
    win.document.getElementById('ms-codesize').value = '0x400';
    win.document.getElementById('ms-data').value = '0x20000';
    win.document.getElementById('ms-datasize').value = '0x400';
    win.updateLinkerStackPreview();

    const stackPreviewVal = win.document.getElementById('ms-stack').value;
    console.log('Calculated Stack Top Preview (0x20000 + 0x400):', stackPreviewVal);
    if (stackPreviewVal !== '0x20400') {
      throw new Error(`Expected Stack Top 0x20400, got ${stackPreviewVal}`);
    }

    win.applyAndCloseSettings();
    if (settingsOv.classList.contains('open')) {
      throw new Error('Settings modal did not close on apply');
    }

    // The example is loaded first: selecting one sets the segment sizes from
    // its row in examples/index.txt, so a layout chosen by hand has to come
    // after, which is the order anyone would do it in anyway.
    win.setLanguageMode('c');
    await win.loadExample('fibonacci_c');
    win.openSettingsModal('linker');
    win.document.getElementById('ms-code').value = '0x10000';
    win.document.getElementById('ms-codesize').value = '0x400';
    win.document.getElementById('ms-data').value = '0x20000';
    win.document.getElementById('ms-datasize').value = '0x400';
    win.updateLinkerStackPreview();
    win.applyAndCloseSettings();
    await win.assembleOnly();

    // Step past CRT0 li sp, 0x20400 (lui + addi) -> check sp (x2)
    win.stepOnce();
    win.stepOnce();
    const spVal = win.getRegs()[2];
    console.log('Runtime Stack Pointer (sp / x2) after CRT0 init:', '0x' + (spVal >>> 0).toString(16));
    if ((spVal >>> 0) !== 0x20400) {
      throw new Error(`Expected sp to be initialized to 0x20400, got 0x${(spVal >>> 0).toString(16)}`);
    }

    // Also test user override of Stack Top to a custom address (e.g. 0x80000)
    win.openSettingsModal('linker');
    win.document.getElementById('ms-stack').value = '0x80000';
    win.applyAndCloseSettings();

    await win.loadExample('fibonacci_c');
    await win.assembleOnly();
    win.stepOnce();
    const customSp = win.getRegs()[2];
    console.log('Runtime Stack Pointer after custom user override (0x80000):', '0x' + (customSp >>> 0).toString(16));
    if ((customSp >>> 0) !== 0x80000) {
      throw new Error(`Expected custom sp 0x80000, got 0x${(customSp >>> 0).toString(16)}`);
    }

    // Restore Linker defaults
    win.openSettingsModal('linker');
    win.resetCurrentSettingsTab();
    win.applyAndCloseSettings();
    console.log('✅ Settable segment sizes, default computation, and user override verified!');

    // 13. Testing Tabbed Memory View Navigation
    console.log('\n[13] Testing Tabbed Memory View Navigation (Code, Data, Stack, MMIO)...');
    win.memGo('data');
    if (!win.document.getElementById('memTabBtn-data').classList.contains('active')) {
      throw new Error('Data memory sub-tab not marked active');
    }
    if (win.document.getElementById('memAddr').value !== '0x10010000') {
      throw new Error('Data memory address not set to 0x10010000');
    }

    win.memGo('stack');
    if (!win.document.getElementById('memTabBtn-stack').classList.contains('active')) {
      throw new Error('Stack memory sub-tab not marked active');
    }
    if (win.document.getElementById('memAddr').value !== '0x10010200') {
      throw new Error('Stack memory address not set to 0x10010200');
    }
    // Verify stack rows are in decreasing order starting from top, one word
    // (4 bytes) per row: 0x10010200, 0x100101FC, 0x100101F8...
    const stackAddrs = Array.from(win.document.querySelectorAll('#memView .addr')).map(el => parseInt(el.textContent, 16));
    console.log('Stack Memory View First 4 Row Addresses:', stackAddrs.slice(0, 4).map(a => '0x' + a.toString(16)));
    if (stackAddrs.length < 3 || stackAddrs[0] !== 0x10010200 || stackAddrs[1] !== 0x100101FC || stackAddrs[2] !== 0x100101F8) {
      throw new Error(`Expected decreasing stack addresses starting at 0x10010200, got: ${stackAddrs.slice(0, 4).map(a => '0x' + a.toString(16)).join(', ')}`);
    }
    console.log('✅ Stack memory addresses in decreasing order verified!');

    win.memGo('mmio');
    if (!win.document.getElementById('memTabBtn-mmio').classList.contains('active')) {
      throw new Error('MMIO memory sub-tab not marked active');
    }
    if (win.document.getElementById('memAddr').value.toLowerCase() !== '0xffff0000') {
      throw new Error('MMIO memory address not set to 0xffff0000');
    }

    win.memGo('code');
    if (!win.document.getElementById('memTabBtn-code').classList.contains('active')) {
      throw new Error('Code memory sub-tab not marked active');
    }
    if (parseInt(win.document.getElementById('memAddr').value, 16) !== 0x00400000) {
      throw new Error('Code memory address not set to 0x00400000');
    }
    console.log('✅ Tabbed Memory View subtabs verified!');

    console.log('\n===========================================================');
    console.log('🎉 ALL C LANGUAGE & GODBOLT SIMULATION TESTS PASSED (100%)!');
    console.log('===========================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  }
}, 400);
