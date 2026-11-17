const fs = require('fs');
const { installGodboltCache } = require('./godbolt_cache');
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

async function compileGodbolt(sourceCode, compilerId = 'rv32-cgcc1420', optLevel = '-Os') {
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

async function runNewCTest() {
  console.log('===========================================================');
  console.log('🚀 TESTING NEW C PROGRAMS (Circle & ImageDisplay Simulation)');
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
        getImageData: (sx, sy, sw, sh) => ({ width: sw || 96, height: sh || 64, data: new Uint8ClampedArray((sw || 96) * (sh || 64) * 4) }),
        createImageData: (w, h) => ({ width: w || 96, height: h || 64, data: new Uint8ClampedArray((w || 96) * (h || 64) * 4) }),
        putImageData: () => {},
        clearRect: () => {},
        createPattern: () => {},
        drawImage: () => {}
      });
    }
  });
  const win = dom.window;
  // jsdom has no fetch, so C mode reaches Godbolt's captured output through this.
  installGodboltCache(win);

  await new Promise(r => setTimeout(r, 400));

  // --- Test 1: Circle_delay_accel.c Simulation ---
  console.log('\n[1] Testing Circle_delay_accel.c Simulation...');
  const circleCSource = fs.readFileSync(path.resolve(__dirname, '../examples/c/Circle_delay_accel.c'), 'utf8');
  console.log('  - Compiling Circle C via Godbolt...');
  const circleCompileRes = await compileGodbolt(circleCSource, 'rv32-cgcc1420', '-O0');
  if (circleCompileRes.code !== 0 || !circleCompileRes.asm) {
    throw new Error(`Failed to compile Circle C: ${JSON.stringify(circleCompileRes)}`);
  }

  win.__mockGodboltResponse = circleCompileRes;
  win.setLanguageMode('c');
  const circleMc = await win.compileAndAssembleC(circleCSource);
  console.log(`  - Circle C compiled: ${circleMc.length} instructions.`);

  // Set MMIO Accel reading (temp=25, x=0x40 = +1g, y=0, z=0x40 = 1g gravity)
  const xSlider = win.document.getElementById('accelXSlider');
  if (xSlider) xSlider.value = 64;
  const tempSlider = win.document.getElementById('accelTempSlider');
  if (tempSlider) tempSlider.value = 25;
  win.updateAccelValues();

  // Execute 6000 steps to send greeting message, update 7-seg, and draw initial circle
  for (let s = 0; s < 6000; s++) {
    win.executeOne();
  }

  const term1 = win.document.getElementById('uartTerminal');
  const uartText1 = term1 ? term1.innerText : '';
  console.log(`  - Circle UART terminal output: ${JSON.stringify(uartText1)}`);
  if (!uartText1.includes('Tilt in various directions to see the colour change')) {
    throw new Error(`Expected UART output to contain "Tilt in various directions to see the colour change", got: ${JSON.stringify(uartText1)}`);
  }

  const sevSegVal = win.readMem(0xFFFF0080, 4);
  console.log(`  - Seven-segment MMIO display value: 0x${(sevSegVal >>> 0).toString(16)}`);
  if ((sevSegVal >>> 0) !== 0x19400040) {
    throw new Error(`Expected 7-Segment MMIO 0x19400040, got 0x${(sevSegVal >>> 0).toString(16)}`);
  }

  // Check OLED buffer has circle pixels drawn
  let coloredPixels = 0;
  for (let i = 0; i < win.oledBuffer.length; i += 4) {
    if (win.oledBuffer[i] > 0 || win.oledBuffer[i+1] > 0 || win.oledBuffer[i+2] > 0) {
      coloredPixels++;
    }
  }
  console.log(`  - OLED Canvas colored pixels drawn: ${coloredPixels}`);
  if (coloredPixels === 0) {
    throw new Error('Circle drawing failed: 0 colored pixels in oledBuffer!');
  }
  console.log('✅ Circle_delay_accel.c simulation verified successfully!');

  // --- Test 2: ImageDisplay_autoadvance_accel.c Simulation ---
  console.log('\n[2] Testing ImageDisplay_autoadvance_accel.c Simulation...');
  const imgCSource = fs.readFileSync(path.resolve(__dirname, '../examples/c/ImageDisplay_autoadvance_accel.c'), 'utf8');

  console.log('  - Compiling ImageDisplay C via Godbolt...');
  const compileRes = await compileGodbolt(imgCSource, 'rv32-cgcc1420', '-O0');
  if (compileRes.code !== 0 || !compileRes.asm) {
    throw new Error(`Failed to compile ImageDisplay C: ${JSON.stringify(compileRes)}`);
  }

  win.__mockGodboltResponse = compileRes;
  win.setLanguageMode('c');
  const imgMc = await win.compileAndAssembleC(imgCSource);
  console.log(`  - ImageDisplay assembled: ${imgMc.length} instructions.`);

  win.clearOledDisplay();
  if (xSlider) xSlider.value = 64;
  win.updateAccelValues();

  // Run steps through 1 frame (~175,000 steps for 6144 pixels + UART print)
  console.log('  - Executing simulation steps for ImageDisplay (Mode 5 Autoadvance)...');
  for (let s = 0; s < 400000; s++) {
    win.executeOne();
    if (win.oledCol === 0 && win.oledRow === 0 && s > 150000) break;
  }

  const cBuffer = new Uint8Array(win.oledBuffer);
  let imgColoredPixels = 0;
  for (let i = 0; i < cBuffer.length; i += 4) {
    if (cBuffer[i] > 0 || cBuffer[i+1] > 0 || cBuffer[i+2] > 0) {
      imgColoredPixels++;
    }
  }
  console.log(`  - ImageDisplay rendered pixels: ${imgColoredPixels} pixels.`);
  if (imgColoredPixels < 5000) {
    throw new Error(`Expected at least 5000 pixels drawn, got ${imgColoredPixels}`);
  }

  const term = win.document.getElementById('uartTerminal');
  const uartText = term ? term.innerText : '';
  console.log(`  - UART terminal output: ${JSON.stringify(uartText)}`);
  if (!uartText.includes('Tilt X to observe the effect')) {
    throw new Error(`Expected UART output to contain "Tilt X to observe the effect", got: ${JSON.stringify(uartText)}`);
  }
  console.log('✅ ImageDisplay_autoadvance_accel.c simulation verified successfully!');

  console.log('\n===========================================================');
  console.log('🎉 ALL NEW C SIMULATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

runNewCTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
