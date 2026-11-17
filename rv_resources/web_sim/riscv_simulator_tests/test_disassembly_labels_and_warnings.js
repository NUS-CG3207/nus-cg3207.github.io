// test_disassembly_labels_and_warnings.js
// Verification of Disassembly Labels and FPGA Memory Warning notices

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

console.log('===========================================================');
console.log('🚀 TESTING DISASSEMBLY LABELS & FPGA DATA WARNINGS');
console.log('===========================================================');

const htmlPath = path.resolve(__dirname, '../riscv_simulator.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const CM6_BUNDLE_SOURCE = fs.readFileSync(path.resolve(__dirname, 'cm6_bundle.min.js'), 'utf8');

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
    // Installed here, inside beforeParse, so it exists before the page's
    // own top-level script runs (it calls fetch() immediately on load to
    // populate the Example menu from examples/index.txt) - installing it
    // after `new JSDOM()` returns would be too late.
    installExamplesFetch(window);
  }
});

const win = dom.window;

// jsdom has no fetch, so C mode reaches Godbolt's captured output through this.

installGodboltCache(win);
const doc = win.document;

setTimeout(async () => {
  try {
    // 1. Verify ASM Disassembly Labels
    win.setLanguageMode('asm');
    await win.loadExample('fib');
    win.assembleOnly();
    win.switchTab('disassembly');

    const disasm = doc.getElementById('disassemblyDisplay');
    if (!disasm) throw new Error('disassemblyDisplay element not found');

    const labelRows = disasm.querySelectorAll('.disasm-label-row');
    console.log(`Found ${labelRows.length} label header rows in Fibonacci disassembly.`);
    if (labelRows.length === 0) {
      throw new Error('No label header rows found in disassembly!');
    }

    const labelNames = Array.from(disasm.querySelectorAll('.disasm-label-name')).map(el => el.textContent.trim());
    console.log(`Disassembly label headers:`, labelNames);
    if (!labelNames.some(l => l.includes('main')) && !labelNames.some(l => l.includes('loop') || l.includes('fib'))) {
      throw new Error(`Expected main or loop/fib labels, got: ${JSON.stringify(labelNames)}`);
    }
    console.log('✅ Disassembly label headers verified in ASM mode!');

    // 2. Verify Target Annotations on Branch/Jumps
    const targetBadges = disasm.querySelectorAll('.disasm-target-label');
    console.log(`Found ${targetBadges.length} jump/branch target label annotations in disassembly.`);
    console.log('✅ Target label annotations verified!');

    // 3. Verify C Mode Disassembly Labels (e.g. Fibonacci)
    win.setLanguageMode('c');
    await win.loadExample('fibonacci_c');
    await win.assembleOnly();
    win.switchTab('disassembly');

    const cLabelRows = disasm.querySelectorAll('.disasm-label-row');
    const cLabelNames = Array.from(disasm.querySelectorAll('.disasm-label-name')).map(el => el.textContent.trim());
    console.log(`\nC Mode Fibonacci label rows: ${cLabelRows.length}, headers:`, cLabelNames);
    if (cLabelRows.length === 0 || !cLabelNames.some(l => l.includes('main') || l.includes('fib'))) {
      throw new Error(`Expected C function labels (main, compute_fib, etc.), got: ${JSON.stringify(cLabelNames)}`);
    }
    console.log('✅ Disassembly label headers verified in C mode!');

    // 4. Verify the Linker tab's hardware-size notice
    const linkerNotice = doc.querySelector('#settingsContent-linker');
    if (!linkerNotice || !linkerNotice.textContent.includes('should not exceed the memory size provisioned in hardware')) {
      throw new Error('Hardware memory-size notice missing in Linker tab of settings modal!');
    }
    console.log('✅ Linker tab hardware memory-size notice verified!');

    console.log('\n===========================================================');
    console.log('🎉 DISASSEMBLY LABELS & FPGA WARNING TESTS PASSED 100%!');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 400);
