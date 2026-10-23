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

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../riscv_simulator.html'), 'utf8');
const CM6_BUNDLE_SOURCE = fs.readFileSync(path.resolve(__dirname, 'cm6_bundle.min.js'), 'utf8');

console.log('Creating JSDOM instance with scripts enabled...');

const dom = new JSDOM(htmlContent, {
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

    window.requestAnimationFrame = window.requestAnimationFrame || function(cb) {
      return setTimeout(cb, 16);
    };
    window.cancelAnimationFrame = window.cancelAnimationFrame || function(id) {
      clearTimeout(id);
    };
    window.matchMedia = window.matchMedia || function() {
      return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
      };
    };
    window.Range.prototype.getClientRects = () => [];
    window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    window.Element.prototype.getClientRects = () => [];
    window.Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    // Mock canvas context
    if (window.HTMLCanvasElement) {
      window.HTMLCanvasElement.prototype.getContext = function() {
        return {
          createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
          putImageData: () => {},
          fillRect: () => {},
          clearRect: () => {}
        };
      };
    }
    installExamplesFetch(window);
  }
});

const { window } = dom;
const { document } = window;

// Wait for DOMContentLoaded / CM6 to initialize
setTimeout(async () => {
  try {
    console.log('\n--- JSDOM Test 1: Verification of DOM & Editor ---');
    console.log('Window Title:', document.title);
    console.log('cmEditor exists on window:', !!window.cmEditor);
    if (!window.cmEditor) {
      throw new Error('CodeMirror 6 EditorView was not mounted!');
    }

    const initialCode = window.editor.value;
    console.log('Initial code lines in editor:', initialCode.split('\n').length);
    console.log('First line of code:', initialCode.split('\n')[0]);
    if (!initialCode.trim()) throw new Error('Editor is empty at boot - the baked default failed to load');

    // The rest of this suite steps through a program checking specific
    // register values, so it loads a known one explicitly rather than
    // assuming what boots by default stays whatever it is today.
    await window.loadExample('fib');

    console.log('\n--- JSDOM Test 2: Assembly & Machine Code Generation ---');
    const assembleBtn = document.getElementById('btnAssemble');
    if (!assembleBtn) throw new Error('Assemble button not found');
    assembleBtn.click();

    console.log('Machine code items:', window.machineCode.length);
    if (window.machineCode.length === 0) throw new Error('No machine code generated');
    console.log('Assembled status:', document.getElementById('statusBar').textContent);

    console.log('\n--- JSDOM Test 3: Stepping Execution ---');
    const stepBtn = document.getElementById('btnStep');
    const backBtn = document.getElementById('btnBack');
    
    // Step 1: li x1, 0 (fib(0))
    stepBtn.click();
    console.log('After Step 1: x1 =', window.regs[1], 'x4 =', window.regs[4], 'PC = 0x' + window.pc.toString(16));
    console.log('currentExecLine =', window.currentExecLine);
    if (window.regs[1] !== 0) throw new Error(`Expected x1=0, got ${window.regs[1]}`);

    // Step 2: li x2, 1 (fib(1))
    stepBtn.click();
    console.log('After Step 2: x2 =', window.regs[2], 'PC = 0x' + window.pc.toString(16));
    if (window.regs[2] !== 1) throw new Error(`Expected x2=1, got ${window.regs[2]}`);

    // Step 3: li x3, 10 (n)
    stepBtn.click();
    console.log('After Step 3: x3 =', window.regs[3], 'PC = 0x' + window.pc.toString(16));
    if (window.regs[3] !== 10) throw new Error(`Expected x3=10, got ${window.regs[3]}`);

    // Step 4: li x4, 2 (counter)
    stepBtn.click();
    console.log('After Step 4: x4 =', window.regs[4]);
    if (window.regs[4] !== 2) throw new Error(`Expected x4=2, got ${window.regs[4]}`);

    // Step Back
    console.log('\n--- JSDOM Test 4: Step Back ---');
    backBtn.click();
    console.log('After Step Back: x4 =', window.regs[4]);
    if (window.regs[4] !== 0) throw new Error(`Expected x4=0 after stepBack, got ${window.regs[4]}`);

    console.log('\n--- JSDOM Test 5: Breakpoint Toggling ---');
    // A line that carries an instruction, found in the source rather than
    // pinned, so a change to the example's header does not move it.
    const srcLines = window.editor.value.split('\n');
    const instrLine = srcLines.findIndex(l => /^\s*(li|add|mv|addi|j|bgt|la|sw|ecall)\b/.test(l)) + 1;
    console.log('First instruction line:', instrLine);
    window.toggleBreakpoint(instrLine);
    console.log(`Breakpoints has line ${instrLine}:`, window.breakpoints.has(instrLine));
    if (!window.breakpoints.has(instrLine)) throw new Error(`Breakpoint at line ${instrLine} was not set`);
    window.toggleBreakpoint(instrLine);
    console.log(`Breakpoints has line ${instrLine} after toggle:`, window.breakpoints.has(instrLine));
    if (window.breakpoints.has(instrLine)) throw new Error(`Breakpoint at line ${instrLine} was not cleared`);

    console.log('\n--- JSDOM Test 6: Example Loading & Execution ---');
    const examples = ['dip_led', 'rars_syscalls', 'fib', 'hello_world', 'hello_jal', 'circle_accel', 'image_display_accel'];
    for (const ex of examples) {
      await window.loadExample(ex);
      window.assembleOnly();
      console.log(`Loaded and assembled example '${ex}': ${window.machineCode.length} instructions.`);
      if (window.machineCode.length === 0) throw new Error(`Example '${ex}' produced 0 instructions`);
    }

    console.log('\n--- JSDOM Test 7: Find & Replace ---');
    await window.loadExample('fib');
    window.openFindReplace(false);
    const findInput = document.getElementById('findInput');
    const replaceInput = document.getElementById('replaceInput');
    findInput.value = 'result';
    window.updateFindMatches();
    console.log('Find count text:', document.getElementById('findCount').textContent);

    replaceInput.value = 'total_result';
    window.replaceAll();
    console.log('Does editor contain total_result:', window.editor.value.includes('total_result'));
    if (!window.editor.value.includes('total_result')) throw new Error('Replace all failed');
    window.closeFindReplace();

    console.log('\n=============================================');
    console.log('🎉 ALL JSDOM BROWSER SIMULATOR TESTS PASSED!');
    console.log('=============================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 500);
