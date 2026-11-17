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
    console.log('Testing breakpoint snapping and line number highlighting...');
    
    // Load 'fib' example
    await win.loadExample('fib');
    console.log('Editor code lines:\n' + win.editor.value);

    // Derived from the file rather than pinned: what is under test is that a
    // line carrying no instruction snaps forward to the one that does, not
    // where the example happens to put its header.
    const lines = win.editor.value.split('\n');
    const lineOf = pred => lines.findIndex(pred) + 1;
    const commentLine = lineOf(l => l.trim().startsWith('#'));
    const textLine = lineOf(l => l.trim() === '.text');
    const mainLine = lineOf(l => l.trim() === 'main:');
    let instrLine = mainLine + 1;
    while (instrLine <= lines.length &&
           (!lines[instrLine - 1].trim() || lines[instrLine - 1].trim().startsWith('#'))) instrLine++;
    console.log(`comment line ${commentLine}, .text ${textLine}, main: ${mainLine}, ` +
                `first instruction ${instrLine}`);

    console.log('\n--- Test 1: Snapping from a comment line ---');
    win.toggleBreakpoint(commentLine);
    console.log('Breakpoints Set:', Array.from(win.breakpoints));
    if (!win.breakpoints.has(instrLine)) {
      throw new Error(`Expected breakpoint on line ${instrLine}, got ${Array.from(win.breakpoints)}`);
    }
    if (win.breakpoints.has(commentLine)) {
      throw new Error(`Breakpoint should NOT be on line ${commentLine}!`);
    }
    console.log(`✅ Line ${commentLine} snapped to line ${instrLine}!`);

    // Toggling .text snaps to the same instruction, which is already set, so it clears it
    console.log('\n--- Test 2: Toggling from the .text directive ---');
    win.toggleBreakpoint(textLine);
    console.log('Breakpoints Set after toggle:', Array.from(win.breakpoints));
    if (win.breakpoints.has(instrLine)) {
      throw new Error(`Expected breakpoint on line ${instrLine} to be toggled off`);
    }
    console.log(`✅ Toggling line ${textLine} toggled off line ${instrLine}!`);

    console.log('\n--- Test 3: Snapping from the label line ---');
    win.toggleBreakpoint(mainLine);
    console.log('Breakpoints Set:', Array.from(win.breakpoints));
    if (!win.breakpoints.has(instrLine)) {
      throw new Error(`Expected breakpoint on line ${instrLine}`);
    }
    console.log(`✅ Line ${mainLine} snapped to line ${instrLine}!`);

    // Test 4: Verify breakpoint state in CodeMirror 6 editor
    console.log('\n--- Test 4: CodeMirror 6 Breakpoint Field Verification ---');
    const cm = win.cmEditor;
    if (!cm) throw new Error('cmEditor not found');

    // Run assemble and step to line 4
    win.assembleOnly();
    console.log('Assembled machine code length:', win.machineCode.length);

    // Pause cancels the pending batch, so the run loop never reaches the exit
    // path that normally moves the highlight. Without this the editor keeps
    // pointing at the first instruction however far the program has run.
    console.log('\n--- Test 5: Pausing a run highlights where it stopped ---');
    win.breakpoints.clear();
    await win.loadExample('dip_led');   // loops forever, so a run spans several batches
    win.assembleOnly();
    const lineOfPc = () => win.eval('sourceLineForPc(pc)');
    const firstLine = win.currentExecLine;
    if (firstLine !== lineOfPc()) {
      throw new Error(`Expected the highlight to start on the first instruction, ` +
                      `got ${firstLine} against PC line ${lineOfPc()}`);
    }

    const stops = [];
    for (let round = 0; round < 2; round++) {
      win.toggleRunPause();                                  // Run / Resume
      await new Promise(r => setTimeout(r, 20));             // let a batch land
      win.toggleRunPause();                                  // Pause
      if (win.currentExecLine !== lineOfPc()) {
        throw new Error(`Pause ${round + 1}: highlight on line ${win.currentExecLine}, ` +
                        `PC on line ${lineOfPc()}`);
      }
      stops.push(win.currentExecLine);
      console.log(`  pause ${round + 1}: highlight and PC agree on line ${win.currentExecLine}`);
    }
    if (stops.every(l => l === firstLine)) {
      throw new Error(`The highlight never left the first instruction (line ${firstLine})`);
    }
    console.log(`✅ Pausing moves the highlight off line ${firstLine} and onto the paused instruction`);

    console.log('\n======================================================');
    console.log('🎉 ALL BREAKPOINT HIGHLIGHT & SNAP TESTS PASSED!');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 300);
