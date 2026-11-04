const fs = require('fs');
const { installGodboltCache } = require('./godbolt_cache');
const { installExamplesFetch } = require('./examples_fetch');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch(e) { JSDOM = require('/home/rajesh/.gemini/antigravity-ide/brain/7780d698-8baa-4d51-9b54-596f69dcec55/scratch/node_modules/jsdom').JSDOM; }

async function verifyAllBakedExamples() {
  console.log('===========================================================');
  console.log('🚀 COMPREHENSIVE VERIFICATION OF 4 BAKED EXAMPLES');
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
        clearRect: () => {}
      });
      installExamplesFetch(window); // before the page's own fetch() for the Example menu
    }
  });

  const win = dom.window;

  // jsdom has no fetch, so C mode reaches Godbolt's captured output through this.

  installGodboltCache(win);
  await new Promise(r => setTimeout(r, 400));

  // --- 1. ASM Mode: circle_accel ---
  console.log('\n[1] Testing circle_accel in Assembly Mode...');
  win.setLanguageMode('asm');
  await win.loadExample('circle_accel');
  const mc1 = win.assembleOnly();
  console.log(`  - Assembled items (code + data): ${mc1.length}`);
  if (mc1.length !== 138) throw new Error(`Expected 138 assembled items, got ${mc1.length}`);
  
  // Set Accel input
  const xSlider = win.document.getElementById('accelXSlider');
  if (xSlider) xSlider.value = 64;
  win.updateAccelValues();

  for (let s = 0; s < 4000; s++) win.executeOne();

  const term1 = win.document.getElementById('uartTerminal');
  const uart1 = term1 ? term1.innerText : '';
  console.log(`  - UART output: ${JSON.stringify(uart1)}`);
  if (!uart1.includes('Tilt in various directions to see the colour change')) {
    throw new Error(`ASM circle_accel missing UART greeting, got ${JSON.stringify(uart1)}`);
  }

  let circlePixels = 0;
  for (let i = 0; i < win.oledBuffer.length; i += 4) {
    if (win.oledBuffer[i] > 0 || win.oledBuffer[i+1] > 0 || win.oledBuffer[i+2] > 0) circlePixels++;
  }
  console.log(`  - Circle pixels rendered on OLED: ${circlePixels}`);
  if (circlePixels === 0) throw new Error('No pixels rendered for circle_accel');
  console.log('✅ circle_accel (ASM) fully verified!');

  // --- 2. ASM Mode: image_display_accel ---
  console.log('\n[2] Testing image_display_accel in Assembly Mode...');
  await win.loadExample('image_display_accel');
  const mc2 = win.assembleOnly();
  console.log(`  - Assembled items (code + data): ${mc2.length}`);
  if (mc2.length !== 183) throw new Error(`Expected 183 assembled items, got ${mc2.length}`);

  for (let s = 0; s < 75000; s++) win.executeOne();

  let imgPixels = 0;
  for (let i = 0; i < win.oledBuffer.length; i += 4) {
    if (win.oledBuffer[i] > 0 || win.oledBuffer[i+1] > 0 || win.oledBuffer[i+2] > 0) imgPixels++;
  }
  console.log(`  - Image pixels rendered on OLED: ${imgPixels}`);
  if (imgPixels !== 6144) throw new Error(`Expected 6144 pixels, got ${imgPixels}`);
  console.log('✅ image_display_accel (ASM) fully verified!');

  // --- 3. C Mode: circle_accel_c ---
  console.log('\n[3] Testing circle_accel_c in C Mode...');
  win.setLanguageMode('c');
  await win.loadExample('circle_accel_c');
  const mc3 = await win.assembleOnly();
  console.log(`  - Assembled items (code + data): ${mc3.length}`);
  if (mc3.length !== 299) throw new Error(`Expected 299 assembled items, got ${mc3.length}`);

  for (let s = 0; s < 60000; s++) win.executeOne();

  const term3 = win.document.getElementById('uartTerminal');
  const uart3 = term3 ? term3.innerText : '';
  console.log(`  - UART output: ${JSON.stringify(uart3)}`);
  if (!uart3.includes('Tilt in various directions to see the colour change')) {
    throw new Error(`C circle_accel_c missing UART greeting, got ${JSON.stringify(uart3)}`);
  }

  // The program presents each frame, so what reaches the canvas has been
  // through a page exchange and its copy - a count alone would not notice if
  // double buffering swallowed the drawing.
  let circleCPixels = 0;
  for (let i = 0; i < win.oledBuffer.length; i += 4) {
    if (win.oledBuffer[i] > 0 || win.oledBuffer[i+1] > 0 || win.oledBuffer[i+2] > 0) circleCPixels++;
  }
  console.log(`  - Circle pixels presented on OLED: ${circleCPixels}`);
  if (circleCPixels !== 2533) throw new Error(`Expected 2533 pixels, got ${circleCPixels}`);
  console.log('✅ circle_accel_c (C) fully verified!');

  // --- 4. C Mode: image_display_c ---
  console.log('\n[4] Testing image_display_c in C Mode...');
  await win.loadExample('image_display_c');
  const mc4 = await win.assembleOnly();
  console.log(`  - Assembled items (code + data): ${mc4.length}`);
  if (mc4.length !== 658) throw new Error(`Expected 658 assembled items, got ${mc4.length}`);

  for (let s = 0; s < 200000; s++) win.executeOne();

  let cImgPixels = 0;
  for (let i = 0; i < win.oledBuffer.length; i += 4) {
    if (win.oledBuffer[i] > 0 || win.oledBuffer[i+1] > 0 || win.oledBuffer[i+2] > 0) cImgPixels++;
  }
  console.log(`  - Image pixels rendered on OLED: ${cImgPixels}`);
  if (cImgPixels !== 6144) throw new Error(`Expected 6144 pixels, got ${cImgPixels}`);

  const term4 = win.document.getElementById('uartTerminal');
  const uart4 = term4 ? term4.innerText : '';
  console.log(`  - UART output: ${JSON.stringify(uart4)}`);
  if (!uart4.includes('Tilt X to observe the effect')) {
    throw new Error(`C image_display_c missing UART greeting, got ${JSON.stringify(uart4)}`);
  }
  console.log('✅ image_display_c (C) fully verified!');

  console.log('\n===========================================================');
  console.log('🎉 ALL 4 BAKED EXAMPLES FULLY VERIFIED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

verifyAllBakedExamples().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
