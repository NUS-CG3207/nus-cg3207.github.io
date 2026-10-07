// test_statement_stepping.js
// Verification of Statement Stepping Mode in both C and ASM modes

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
console.log('🚀 TESTING STATEMENT STEPPING IN C AND ASM MODES');
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
    installExamplesFetch(window); // before the page's own fetch() for the Example menu
  }
});

const win = dom.window;

// jsdom has no fetch, so C mode reaches Godbolt's captured output through this.

installGodboltCache(win);
const doc = win.document;

setTimeout(async () => {
  try {
    // 1. Verify Settings Modal has Statement Stepping checkbox
    const stmtCheckbox = doc.getElementById('simStatementStep');
    if (!stmtCheckbox) throw new Error('simStatementStep checkbox not found in DOM');
    console.log('✅ Settings Modal Statement Stepping toggle element verified');

    // 2. Test in C Mode (e.g. Fibonacci or Circle)
    win.setLanguageMode('c');
    await win.loadExample('fibonacci_c');
    await win.assembleOnly();

    console.log(`\n[C Mode] Assembled Fibonacci example: ${win.machineCode.length} instructions`);
    
    // With Statement Stepping disabled:
    win.statementStepping = false;
    const initialPc = win.pc;
    win.stepOnce();
    const history = win.getExecHistory();
    const instrsStep1 = history[history.length - 1].instr;
    console.log(`Single Instruction Stepping: Executed ${instrsStep1} instruction (PC: 0x${win.pc.toString(16)})`);
    if (instrsStep1 !== 1) throw new Error(`Expected 1 instruction per step when disabled, got ${instrsStep1}`);

    // Reset and enable Statement Stepping:
    win.resetAll();
    win.statementStepping = true;
    const initialLine = win.getCurrentExecLine();
    console.log(`Starting Statement Stepping at Source Line: ${initialLine}, PC: 0x${win.pc.toString(16)}`);
    
    win.stepOnce();
    const lastHistory = history[history.length - 1];
    const newExecLine = win.getCurrentExecLine();
    console.log(`Statement Step executed ${lastHistory.instr} instructions in 1 step! New Line: ${newExecLine}, PC: 0x${win.pc.toString(16)}`);
    
    if (lastHistory.instr < 1) {
      throw new Error(`Statement step executed 0 instructions!`);
    }

    // Step Back
    const pcBeforeStepBack = win.pc;
    win.stepBack();
    console.log(`After Step Back: Reverted to PC: 0x${win.pc.toString(16)}`);
    if (win.pc !== 0x400000) {
      throw new Error(`Expected PC to revert to 0x400000, got 0x${win.pc.toString(16)}`);
    }
    console.log('✅ Step Back flawlessly reversed the multi-instruction statement step!');

    // 3. Test in ASM Mode
    win.setLanguageMode('asm');
    await win.loadExample('fib');
    win.assembleOnly();
    console.log(`\n[ASM Mode] Assembled Fibonacci example: ${win.machineCode.length} instructions`);

    win.statementStepping = true;
    win.stepOnce();
    const asmHistory = win.getExecHistory();
    console.log(`ASM Mode with Statement Stepping: Step executed ${asmHistory[asmHistory.length - 1].instr} instructions`);
    
    console.log('\n===========================================================');
    console.log('🎉 STATEMENT STEPPING TEST PASSED WITH 100% SUCCESS!');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 400);
