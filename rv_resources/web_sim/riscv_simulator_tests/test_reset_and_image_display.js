const fs = require('fs');
const { installGodboltCache } = require('./godbolt_cache');
const { installExamplesFetch } = require('./examples_fetch');
const path = require('path');
const https = require('https');

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

async function compileGodbolt(sourceCode, compilerId = 'rv32-cclang2010', optLevel = '-Os') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      source: sourceCode,
      options: {
        userArguments: `${optLevel} -march=rv32im -mabi=ilp32 -fno-pic -fno-pie`,
        compilerOptions: { skipAsm: false, executorRequest: false },
        filters: { binary: false, commentOnly: true, demangle: true, directives: false, execute: false, intel: false, labels: true, libraryCode: false, trim: false }
      }
    });

    const req = https.request({
      hostname: 'godbolt.org',
      port: 443,
      path: `/api/compiler/${encodeURIComponent(compilerId)}/compile`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 20000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('===========================================================');
  console.log('🚀 TESTING IMAGEDISPLAY RENDERING & RESET OVERRIDE BEHAVIOR');
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

      window.requestAnimationFrame = cb => setTimeout(cb, 16);
      window.cancelAnimationFrame = id => clearTimeout(id);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.Range.prototype.getClientRects = () => [];
      window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
      window.Element.prototype.getClientRects = () => [];
      window.Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
      window.HTMLCanvasElement.prototype.getContext = () => ({
        fillRect: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(96 * 64 * 4) }),
        createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 96) * (h || 64) * 4) }),
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

  await new Promise(r => setTimeout(r, 200));

  // --- Test 1: ImageDisplay_autoadvance_accel.asm in Assembly Mode ---
  console.log('\n[1] Testing ImageDisplay_autoadvance_accel.asm in ASM Mode...');
  const imgAsmSource = fs.readFileSync(path.resolve(__dirname, '../examples/asm/ImageDisplay_autoadvance_accel.asm'), 'utf8');
  win.setLanguageMode('asm');
  win.cmEditor.dispatch({
    changes: { from: 0, to: win.cmEditor.state.doc.length, insert: imgAsmSource }
  });
  const mcAsm = await win.assembleOnly();
  console.log(`  - Assembled ASM: ${mcAsm.length} instructions.`);

  // Set accel data to tilt +X (+1g)
  const xSlider = win.document.getElementById('accelXSlider');
  if (xSlider) xSlider.value = 64;
  win.updateAccelValues();

  // Execute 1 full frame (~50,000 instructions)
  for (let s = 0; s < 60000; s++) {
    win.executeOne();
    if (win.oledCol === 0 && win.oledRow === 0 && s > 40000) break;
  }

  const asmBuffer = new Uint8Array(win.oledBuffer);
  let asmNonZero = 0;
  for (let i = 0; i < asmBuffer.length; i += 4) {
    if (asmBuffer[i] > 0 || asmBuffer[i+1] > 0 || asmBuffer[i+2] > 0) asmNonZero++;
  }
  console.log(`  - ASM rendered non-zero pixels: ${asmNonZero} on 96x64 display (expected > 5000)`);
  if (asmNonZero < 5000) {
    throw new Error(`Expected at least 5000 non-zero pixels in ASM mode, got ${asmNonZero}`);
  }
  console.log('✅ ImageDisplay in Assembly Mode verified successfully!');

  // --- Test 2: ImageDisplay_autoadvance_accel.c in C Mode via compileAndAssembleC ---
  console.log('\n[2] Testing ImageDisplay_autoadvance_accel.c in C Mode via GCC 14.2 compilation...');
  const imgCSource = fs.readFileSync(path.resolve(__dirname, '../examples/c/ImageDisplay_autoadvance_accel.c'), 'utf8');
  const compileRes = await compileGodbolt(imgCSource, 'rv32-cgcc1420', '-O0');
  if (compileRes.code !== 0 || !compileRes.asm) {
    throw new Error(`Failed to compile ImageDisplay C: ${JSON.stringify(compileRes)}`);
  }

  win.__mockGodboltResponse = compileRes;
  win.setLanguageMode('c');
  const mcC = await win.compileAndAssembleC(imgCSource);
  console.log(`  - Compiled & Assembled C output: ${mcC.length} instructions.`);

  win.clearOledDisplay();
  if (xSlider) xSlider.value = 64;
  win.updateAccelValues();

  for (let s = 0; s < 400000; s++) {
    win.executeOne();
    if (win.oledCol === 0 && win.oledRow === 0 && s > 150000) break;
  }

  const cBuffer = new Uint8Array(win.oledBuffer);
  let cNonZero = 0;
  for (let i = 0; i < cBuffer.length; i += 4) {
    if (cBuffer[i] > 0 || cBuffer[i+1] > 0 || cBuffer[i+2] > 0) cNonZero++;
  }
  console.log(`  - C rendered non-zero pixels: ${cNonZero} on 96x64 display (expected > 5000)`);
  if (cNonZero < 5000) {
    throw new Error(`Expected at least 5000 non-zero pixels in C mode, got ${cNonZero}`);
  }

  const term = win.document.getElementById('uartTerminal');
  const uartText = term ? term.innerText : '';
  console.log(`  - UART terminal output: ${JSON.stringify(uartText)}`);
  if (!uartText.includes('Tilt X to observe the effect')) {
    throw new Error(`Expected UART output to contain "Tilt X to observe the effect", got: ${JSON.stringify(uartText)}`);
  }
  console.log('✅ ImageDisplay in C Mode successfully printed message to UART and rendered OLED frame!');

  // --- Test 3: Reset Button Override & Wait Behavior ---
  console.log('\n[3] Testing Reset Button Override & Wait Behavior...');
  win.setLanguageMode('asm');
  await win.loadExample('circle_accel');
  await win.assembleOnly();

  // Start execution with runProgram()
  console.log('  - Starting continuous execution of circle_accel (infinite loop)...');
  win.runProgram();
  await new Promise(r => setTimeout(r, 20));

  console.log(`  - Simulator running state: ${win.running}`);
  if (!win.running) {
    throw new Error('Expected simulator to be actively running');
  }

  // Press Reset while running
  console.log('  - Pressing Reset (resetAll())...');
  win.resetAll();

  // Verify simulator is stopped and waiting for user
  const isRunningAfterReset = win.running;
  console.log(`  - Is running after reset: ${isRunningAfterReset} (expected false)`);
  if (isRunningAfterReset) {
    throw new Error('Reset failed to stop running execution!');
  }

  const statusText = win.document.getElementById('statusBar')?.textContent || '';
  console.log(`  - Status text after reset: "${statusText}"`);
  if (!statusText.includes('Reset') && !statusText.includes('Ready to run')) {
    throw new Error(`Unexpected status text after reset: "${statusText}"`);
  }

  // Wait 100ms to ensure no pending setTimeout resumed execution
  await new Promise(r => setTimeout(r, 100));
  if (win.running) {
    throw new Error('Execution unexpectedly resumed in background after reset!');
  }
  console.log('✅ Reset button cleanly halts execution and waits for user to run again!');

  console.log('\n===========================================================');
  console.log('🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
