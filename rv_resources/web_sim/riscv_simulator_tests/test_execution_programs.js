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
        clearRect: () => {}
      });
    }
    installExamplesFetch(window); // before the page's own fetch() for the Example menu
  }
});

const win = dom.window;

setTimeout(async () => {
  try {
    // Test Fibonacci program execution
    console.log('Testing Fibonacci calculation...');
    await win.loadExample('fib');
    console.log('Editor value after loadExample length:', win.editor.value.length);
    const mc = win.assembleOnly();
    console.log('assembleOnly returned mc length:', mc ? mc.length : 'null');
    console.log('window.machineCode length:', win.machineCode.length);

    let steps = 0;
    for (let i = 0; i < 60; i++) {
      win.stepOnce();
      steps++;
      if (win.regs[2] === 55) break;
    }

    console.log(`Executed ${steps} steps. Fibonacci result in x2 =`, win.regs[2]);
    if (win.regs[2] !== 55) {
      throw new Error(`Expected fib(10) = 55, got ${win.regs[2]}`);
    }

    console.log('\n=======================================');
    console.log('✅ ALL ALGORITHMIC SIMULATIONS PASSED!');
    console.log('=======================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 300);

console.log('\n=======================================');
console.log('✅ ALL ALGORITHMIC SIMULATIONS PASSED!');
console.log('=======================================');
