// test_sim_max_instructions_setting.js
// Verification of the Max Instructions / Cycle (Batch Limit) setting in the Simulator Settings tab

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
console.log('🚀 TESTING MAX INSTRUCTIONS/CYCLE SETTING IN SIMULATOR TAB');
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
const doc = win.document;

setTimeout(async () => {
  try {
    // 1. Verify DOM element exists
    const maxInstrInput = doc.getElementById('simMaxInstrPerRun');
    if (!maxInstrInput) throw new Error('simMaxInstrPerRun input not found in DOM');
    console.log('✅ Found #simMaxInstrPerRun element in DOM');

    // 2. Verify initial default value
    if (parseInt(maxInstrInput.value, 10) !== 100000000) {
      throw new Error(`Expected default HTML value 100000000, got ${maxInstrInput.value}`);
    }
    if (win.maxInstructionsPerRun !== 100000000) {
      throw new Error(`Expected default window.maxInstructionsPerRun 100000000, got ${win.maxInstructionsPerRun}`);
    }
    console.log('✅ Default maxInstructionsPerRun is 100,000,000');

    // 3. Open settings modal on simulator tab
    win.openSettingsModal('simulator');
    if (doc.getElementById('settingsContent-simulator').style.display === 'none') {
      throw new Error('Simulator settings tab should be visible');
    }
    if (parseInt(maxInstrInput.value, 10) !== 100000000) {
      throw new Error(`Expected buildCyclesPanel to set input value to 100000000, got ${maxInstrInput.value}`);
    }
    console.log('✅ openSettingsModal("simulator") properly synchronizes field value');

    // 4. Update the input value and apply settings
    maxInstrInput.value = '50000000';
    win.applyAndCloseSettings();
    if (win.maxInstructionsPerRun !== 50000000) {
      throw new Error(`Expected maxInstructionsPerRun to update to 50000000, got ${win.maxInstructionsPerRun}`);
    }
    console.log('✅ applyAndCloseSettings() successfully updated maxInstructionsPerRun to 50,000,000');

    // 5. Re-open modal and verify the updated value is populated
    win.openSettingsModal('simulator');
    if (parseInt(maxInstrInput.value, 10) !== 50000000) {
      throw new Error(`Expected reopened modal to show 50000000, got ${maxInstrInput.value}`);
    }
    console.log('✅ Re-opening modal retains updated value 50,000,000');

    // 6. Test Reset Defaults
    win.switchSettingsTab('simulator');
    win.resetCurrentSettingsTab();
    if (win.maxInstructionsPerRun !== 100000000) {
      throw new Error(`Expected resetCurrentSettingsTab to restore 100000000, got ${win.maxInstructionsPerRun}`);
    }
    if (parseInt(maxInstrInput.value, 10) !== 100000000) {
      throw new Error(`Expected resetCurrentSettingsTab to update input to 100000000, got ${maxInstrInput.value}`);
    }
    console.log('✅ resetCurrentSettingsTab() successfully reverted maxInstructionsPerRun to 100,000,000');

    // 7. Test running a program with custom limit
    win.maxInstructionsPerRun = 25000;
    win.setLanguageMode('asm');
    await win.loadExample('fib');
    win.assembleOnly();
    win.runProgram();

    setTimeout(async () => {
      if (win.programFinished || win.pc > 0) {
        console.log(`✅ Simulation ran successfully with custom maxInstructionsPerCycle (25,000). Finished: ${win.programFinished}`);
      } else {
        throw new Error('Simulation did not execute properly with custom maxInstructionsPerCycle');
      }

      console.log('\n===========================================================');
      console.log('🎉 ALL MAX INSTRUCTIONS/CYCLE SETTING TESTS PASSED!');
      console.log('===========================================================');
      process.exit(0);
    }, 150);

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}, 500);
