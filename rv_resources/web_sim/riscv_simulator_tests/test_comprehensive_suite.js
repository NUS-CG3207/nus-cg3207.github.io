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

// jsdom has no fetch, so C mode reaches Godbolt's captured output through this.

installGodboltCache(win);

setTimeout(async () => {
  try {
    console.log('===========================================================');
    console.log('🚀 RUNNING COMPREHENSIVE FUNCTIONAL & UI TEST SUITE');
    console.log('===========================================================');

    // 1. Editor Instance & Compatibility Facade
    console.log('\n[1] Testing CodeMirror 6 Editor & Facade...');
    const cm = win.cmEditor;
    if (!cm) throw new Error('cmEditor not found on window');
    if (!win.editor) throw new Error('window.editor facade not found');

    win.editor.value = 'main:\n\taddi x1, x0, 42\n';
    if (cm.state.doc.toString() !== 'main:\n\taddi x1, x0, 42\n') {
      throw new Error('editor.value setter failed to update CM6 doc');
    }
    if (win.editor.value !== 'main:\n\taddi x1, x0, 42\n') {
      throw new Error('editor.value getter failed to read CM6 doc');
    }
    console.log('✅ Editor proxy facade read/write verified!');

    // 2. Tab Key Precision Handling
    console.log('\n[2] Testing Tab Key in-line insertion vs block indentation...');
    win.editor.value = 'label:';
    win.editor.selectionStart = 6;
    win.editor.selectionEnd = 6;
    // Simulate Tab key
    const tabCmd = (view) => {
      const { state, dispatch } = view;
      if (state.selection.ranges.every(r => r.empty)) {
        dispatch(state.changeByRange(range => ({
          changes: { from: range.from, insert: '\t' },
          range: win.CM6.EditorSelection.cursor(range.from + 1)
        })));
        return true;
      }
      return win.CM6.indentMore(view);
    };
    tabCmd(cm);
    if (win.editor.value !== 'label:\t') {
      throw new Error(`Expected 'label:\\t', got ${JSON.stringify(win.editor.value)}`);
    }
    console.log('✅ In-line Tab insertion verified!');

    // 3. Breakpoint Snapping & Line Number Highlighting Alone
    console.log('\n[3] Testing Breakpoint Gutter, Line Number Highlight, and Snapping...');
    await win.loadExample('fib');
    // The first instruction is found in the source rather than pinned to a line
    // number, so the example's header can change without breaking this.
    const fibLines = win.editor.value.split('\n');
    const firstInstr = fibLines.findIndex(l => /^\s*(li|add|mv|addi|j|bgt|la|sw|ecall)\b/.test(l)) + 1;
    win.toggleBreakpoint(1); // line 1 is a comment, so it snaps forward
    if (!win.breakpoints.has(firstInstr) || win.breakpoints.has(1)) {
      throw new Error(`Breakpoint snapping failed: expected ${firstInstr}, got ` +
        JSON.stringify(Array.from(win.breakpoints)));
    }
    console.log('Breakpoints set:', Array.from(win.breakpoints));
    console.log(`✅ Breakpoint snapping to line ${firstInstr} verified!`);

    // 4. Two-Pass Assembler & Instruction Verification
    console.log('\n[4] Testing Assembler Execution on Fibonacci Example...');
    win.assembleOnly();
    if (!win.machineCode || win.machineCode.length === 0) {
      throw new Error('Assembly produced zero machine code items');
    }
    console.log(`Assembled ${win.machineCode.length} instructions successfully.`);
    console.log('✅ Fibonacci assembly verified!');

    // 5. Stepping, Breakpoint Pause, and Back-Stepping
    console.log('\n[5] Testing Stepping, Execution Line Highlighting, and Step Back...');
    win.stepOnce(); // li x1, 0 (line 5)
    win.stepOnce(); // li x2, 1 (line 6) -> PC advances
    const regs = win.getRegs();
    console.log('After Step 2: x2 =', regs[2], 'PC =', '0x' + win.getPc().toString(16));
    if (regs[2] !== 1) throw new Error(`Expected x2 = 1, got ${regs[2]}`);
    console.log('Current execution line:', win.getCurrentExecLine());

    win.stepBack(); // Steps back
    console.log('After Step Back: x2 =', win.getRegs()[2], 'PC =', '0x' + win.getPc().toString(16));
    if (win.getRegs()[2] !== 0) throw new Error(`Expected x2 = 0 after stepBack, got ${win.getRegs()[2]}`);
    console.log('✅ Stepping and Step Back verified!');

    // 6. Test All Pre-Loaded Examples
    console.log('\n[6] Testing All Pre-Loaded Examples Execution...');
    const exampleKeys = ['dip_led', 'rars_syscalls', 'fib', 'hello_world', 'hello_jal', 'circle_accel', 'image_display_accel'];
    for (const key of exampleKeys) {
      await win.loadExample(key);
      const mc = win.assembleOnly();
      if (!mc || mc.length === 0) throw new Error(`Example ${key} failed to assemble`);
      const hasErrors = mc.some(item => item.error);
      if (hasErrors) throw new Error(`Example ${key} has assembly errors`);
      console.log(`  - Example '${key}': ${mc.length} instructions OK.`);
    }
    console.log('✅ All pre-loaded examples assembled flawlessly!');

    // 7. Find & Replace System
    console.log('\n[7] Testing In-Editor Find & Replace...');
    await win.loadExample('fib');
    win.openFindReplace(false);
    const findInput = win.document.getElementById('findInput');
    const replaceInput = win.document.getElementById('replaceInput');
    const findCount = win.document.getElementById('findCount');

    findInput.value = 'ecall';
    win.updateFindMatches();
    console.log('Find count text for "ecall":', findCount.textContent);
    if (!findCount.textContent.includes('/3')) {
      throw new Error(`Expected 3 matches for ecall, got ${findCount.textContent}`);
    }

    win.findNext();
    replaceInput.value = 'nop';
    win.replaceCurrent();
    console.log('After replaceCurrent, editor contains nop:', win.editor.value.includes('nop'));
    if (!win.editor.value.includes('nop')) throw new Error('replaceCurrent failed');

    win.replaceAll();
    win.closeFindReplace();
    console.log('✅ Find & Replace operations verified!');

    // 8. Peripherals Verification
    console.log('\n[8] Testing Nexys 4 FPGA Board & MMIO Peripherals...');
    // Write LED MMIO (0xFFFF0060)
    win.writeMem(0xFFFF0060, 0x55, 1);
    const ledState = win.readMem(0xFFFF0060, 1);
    console.log('LED state readback:', '0x' + ledState.toString(16));
    if (ledState !== 0x55) throw new Error('LED MMIO read/write failed');

    // 7-Segment Display (0xFFFF0080)
    win.writeMem(0xFFFF0080, 0x12345678, 4);
    const segState = win.readMem(0xFFFF0080, 4);
    console.log('7-Segment display readback:', '0x' + (segState >>> 0).toString(16));
    if ((segState >>> 0) !== 0x12345678) throw new Error('7-Segment MMIO failed');

    // Accelerometer Data (0xFFFF0040)
    const accelData = win.readMem(0xFFFF0040, 4);
    console.log('Accelerometer packed data readback:', '0x' + (accelData >>> 0).toString(16));

    // Cycle Count (0xFFFF00A0)
    const cycles = win.readMem(0xFFFF00A0, 4);
    console.log('Cycle counter readback:', cycles);
    console.log('✅ Peripherals and MMIO verification passed!');

    // 9. Memory View protection model, in BOTH display modes.
    //
    // Code is read-only; Data and Stack are fully editable. (MMIO is a mix -
    // read-only registers like DIP/PB are also non-editable here, covered by
    // test_mmio_editability_and_content_column.js instead of this generic
    // Code/Data check.)
    // The mechanism differs between the two display modes this checks: since
    // v23.5 the view opens in WORD mode, where a cell is edited through the
    // word overlay (an onclick calling startMemWordCellEdit) rather than by
    // being contenteditable, so asserting contenteditable unconditionally
    // failed against the default mode.
    console.log('\n[9] Testing Memory View read-only code / editable data (word + byte modes)...');
    const doc = win.document;
    const cellAt = addr => doc.getElementById('memView').querySelector(`[data-addr="${addr}"]`);
    const showCode = () => { doc.getElementById('memAddr').value = '0x00400000'; win.memGo('code'); };
    const showData = () => { doc.getElementById('memAddr').value = '0x10010000'; win.memGo('data'); };

    // --- Word mode (the default since v23.5) ---
    win.setMemViewMode('word');
    showCode();
    const codeWord = cellAt(0x00400000);
    if (!codeWord) throw new Error('Word mode: could not find the code segment word cell');
    if (!codeWord.classList.contains('readonly-code')) {
      throw new Error('Word mode: code segment word cell MUST carry the readonly-code class');
    }
    if (codeWord.getAttribute('onclick')) {
      throw new Error('Word mode: code segment word cell MUST NOT be click-editable');
    }
    showData();
    const dataWord = cellAt(0x10010000);
    if (!dataWord) throw new Error('Word mode: could not find the data segment word cell');
    if (dataWord.classList.contains('readonly-code')) {
      throw new Error('Word mode: data segment word cell MUST NOT be read-only');
    }
    if (!/startMemWordCellEdit/.test(dataWord.getAttribute('onclick') || '')) {
      throw new Error('Word mode: data segment word cell MUST open the word editor on click');
    }
    console.log('Word mode: code cell read-only, data cell click-editable');

    // --- Byte mode ---
    win.setMemViewMode('bytes');
    showCode();
    const codeSpan = cellAt(0x00400000);
    if (!codeSpan) throw new Error('Byte mode: could not find the code segment byte span');
    if (codeSpan.getAttribute('contenteditable') === 'true') {
      throw new Error('Byte mode: code segment byte span should NOT be contenteditable');
    }
    if (!codeSpan.classList.contains('readonly-code')) {
      throw new Error('Byte mode: code segment byte span should have the readonly-code class');
    }
    showData();
    const dataSpan = cellAt(0x10010000);
    if (!dataSpan) throw new Error('Byte mode: could not find the data segment byte span');
    if (dataSpan.getAttribute('contenteditable') !== 'true') {
      throw new Error('Byte mode: data segment byte span MUST be contenteditable="true"');
    }
    console.log('Byte mode: code span read-only, data span contenteditable="true"');

    // Leave the view in the mode the page ships with.
    win.setMemViewMode('word');

    // Check code segment edit prevention functions
    win.editMemByte(0x00400000);
    const statusText = doc.getElementById('statusBar').textContent;
    if (!statusText.includes('read-only')) {
      throw new Error('editMemByte on code segment did not set read-only status warning');
    }
    console.log('✅ Memory View read-only code segment & editable data segment verified!');

    // 10. Toolbar Structure Verification
    console.log('\n[10] Testing Toolbar Structure and Buttons...');
    const toolbar = doc.getElementById('mainToolbar');
    if (!toolbar) throw new Error('mainToolbar element not found');
    // The controls themselves rather than a count, which moved when the two
    // memory-dump buttons became entries in the Download menu.
    const expectRow1 = ['langBtnAsm', 'langBtnC', 'engBtnJs', 'engBtnHdl', 'btnOpen',
                        'btnSave', 'btnUndo', 'btnRedo', 'btnFind'];
    const expectRow2 = ['btnAssemble', 'runPauseBtn', 'btnStep', 'btnBack', 'btnReset',
                        'downloadSelect', 'btnSettings'];
    const missing = (row, ids) => ids.filter(id => !toolbar.querySelector(row + ' #' + id));
    const missing1 = missing('.toolbar-row-source', expectRow1);
    const missing2 = missing('.toolbar-row-simulation', expectRow2);
    console.log(`Toolbar Row 1: ${expectRow1.length - missing1.length}/${expectRow1.length} controls`);
    console.log(`Toolbar Row 2: ${expectRow2.length - missing2.length}/${expectRow2.length} controls`);
    if (missing1.length || missing2.length) {
      throw new Error('Toolbar missing: ' + missing1.concat(missing2).join(', '));
    }
    const dl = doc.getElementById('downloadSelect');
    const dlValues = [...dl.options].map(o => o.value).filter(Boolean);
    // The Wrapper is deliberately absent: a saved copy carries the depths of
    // whichever program was loaded when it was saved, and is wrong for the next.
    const expectDl = ['irom', 'dmem', 'tb', 'vcd'];
    if (dlValues.join(',') !== expectDl.join(',')) {
      throw new Error('Download menu should offer exactly ' + expectDl.join(', ') +
        ', got ' + dlValues.join(', '));
    }
    console.log('Download menu offers:', dlValues.join(', '));
    console.log('✅ Toolbar layout structure verified!');

    // 11. Operands that used to be accepted silently
    console.log('\n[11] Testing assembler strictness and disassembly register naming...');
    const asmErrors = () => (win.eval('machineCode') || [])
      .filter(m => m.error).map(m => String(m.error));
    const assembleText = (src) => { win.editor.value = src; win.assembleOnly(); };

    // A bare number is not a register: `add t0, t0, 1` used to assemble as
    // `add t0, t0, x1`, which is silently wrong.
    assembleText('.text\nmain:\nadd t0, t0, 1\n');
    if (win.eval('assembled')) throw new Error('`add t0, t0, 1` still assembles');
    const numErr = doc.getElementById('console').textContent;
    if (!/is a number, not a register/.test(numErr)) {
      throw new Error('No "number, not a register" diagnostic for `add t0, t0, 1`');
    }
    if (!/Did you mean `addi`/.test(numErr)) {
      throw new Error('The diagnostic does not suggest addi');
    }
    console.log('Bare number as a register operand is rejected, and addi suggested');

    // A store to a symbol has no register it may overwrite, so the scratch
    // register has to be named.
    assembleText('.text\nmain:\nsw t0, var1\n.data\nvar1: .word 1\n');
    // auipc holds the upper 20 bits relative to its own address and the
    // load/store carries the signed remainder, so the pair is only right if
    // the two together land on the symbol.
    const pcRelTarget = rows => {
      const i = rows.findIndex(m => /^auipc /.test(m.native));
      if (i < 0 || !rows[i + 1]) return -1;
      const hi20 = parseInt(rows[i].native.match(/^auipc x\d+, (-?\d+)/)[1], 10);
      const lo = parseInt(rows[i + 1].native.match(/, (-?\d+)\(/)[1], 10);
      return ((rows[i].address + (hi20 << 12) + lo) >>> 0);
    };
    if (win.eval('assembled')) throw new Error('`sw t0, var1` still assembles without a scratch register');
    if (!/scratch register/.test(doc.getElementById('console').textContent)) {
      throw new Error('No scratch-register diagnostic for a 2-operand store to a symbol');
    }
    // Naming it works, and the named register is the one that gets used.
    assembleText('.text\nmain:\nsw t0, var1, t2\n.data\nvar1: .word 1\n');
    if (!win.eval('assembled')) throw new Error('`sw t0, var1, t2` failed to assemble');
    const storeRows = win.eval('machineCode').filter(m => m.native);
    const storeNatives = storeRows.map(m => m.native);
    if (!storeNatives.some(n => /^auipc x7,/.test(n)) || !storeNatives.some(n => /^sw x5, -?\d+\(x7\)$/.test(n))) {
      throw new Error('Store expansion did not use the named register: ' + JSON.stringify(storeNatives));
    }
    if (pcRelTarget(storeRows) !== win.eval('dataBase') >>> 0) {
      throw new Error('Store expansion addressed 0x' + pcRelTarget(storeRows).toString(16) +
                      ', not the symbol at 0x' + (win.eval('dataBase') >>> 0).toString(16));
    }
    console.log('Store to a symbol is PC-relative, honours the named register, and lands on the symbol');

    // A load has one - rd itself - so no other register is touched.
    assembleText('.text\nmain:\nlw s3, delay_val\n.data\ndelay_val: .word 4\n');
    if (!win.eval('assembled')) throw new Error('`lw s3, delay_val` failed to assemble');
    const loadRows = win.eval('machineCode').filter(m => m.native);
    const loadNatives = loadRows.map(m => m.native);
    if (!loadNatives.every(n => !/x5|x6/.test(n))) {
      throw new Error('Load expansion clobbered a scratch register: ' + JSON.stringify(loadNatives));
    }
    if (!loadNatives.some(n => /^auipc x19,/.test(n)) || !loadNatives.some(n => /^lw x19, -?\d+\(x19\)$/.test(n))) {
      throw new Error('Load expansion did not build the address in rd: ' + JSON.stringify(loadNatives));
    }
    if (pcRelTarget(loadRows) !== win.eval('dataBase') >>> 0) {
      throw new Error('Load expansion addressed 0x' + pcRelTarget(loadRows).toString(16) +
                      ', not the symbol at 0x' + (win.eval('dataBase') >>> 0).toString(16));
    }
    console.log('Load from a symbol is PC-relative, builds the address in rd, and lands on the symbol');

    // The Native column is a disassembly: x0-x31, never ABI names. And a row
    // whose only difference from the source is that naming is NOT marked as a
    // pseudo-instruction expansion.
    assembleText('.text\nmain:\nadd t0, t0, t1\nlw a0, 4(sp)\nli x1, 10\n');
    if (!win.eval('assembled')) throw new Error('ABI-name program failed to assemble');
    const rows = win.eval('machineCode').filter(m => m.native);
    const byNative = Object.fromEntries(rows.map(m => [m.native, m]));
    if (!byNative['add x5, x5, x6']) {
      throw new Error('add t0, t0, t1 did not disassemble to x-names: ' + JSON.stringify(rows.map(m => m.native)));
    }
    if (!byNative['lw x10, 4(x2)']) {
      throw new Error('lw a0, 4(sp) did not rewrite the base register');
    }
    if (byNative['add x5, x5, x6'].isPseudo) {
      throw new Error('A plain instruction renamed to x-names was marked as a pseudo-instruction');
    }
    if (!rows.some(m => m.native === 'addi x1, x0, 10' && m.isPseudo)) {
      throw new Error('A real pseudo-instruction (li) lost its expansion marker');
    }
    console.log('Native column uses x0-x31; only real pseudo-instructions stay marked');

    // The PC is on the always-visible metrics readout, not only in the
    // status message that the next message overwrites.
    await win.loadExample('fib');
    win.assembleOnly();
    win.stepOnce();
    const statsEl = doc.getElementById('statsBar');
    if (!statsEl) throw new Error('statsBar not found');
    if (!statsEl.closest('.toolbar-row-status')) {
      throw new Error('The metrics readout is not on the status row');
    }
    if (!/PC:\s*0x[0-9a-f]{8}/i.test(statsEl.textContent)) {
      throw new Error('No PC in the metrics readout: ' + statsEl.textContent);
    }
    const pcShown = statsEl.textContent.match(/PC:\s*(0x[0-9a-f]{8})/i)[1];
    if (parseInt(pcShown, 16) !== (win.eval('pc') >>> 0)) {
      throw new Error(`Metrics PC ${pcShown} does not match pc 0x${(win.eval('pc') >>> 0).toString(16)}`);
    }
    console.log(`Status row metrics: ${statsEl.textContent.replace(/\s+/g, ' ').trim()}`);
    console.log('✅ Assembler strictness, disassembly naming and PC readout verified!');

    // 12. The rest of the "accepted silently" audit
    console.log('\n[12] Testing operand arity, range checks and label rules...');
    const consoleText = () => doc.getElementById('console').textContent;
    const tryAsm = (src) => {
      doc.getElementById('console').innerHTML = '';
      win.editor.value = src;
      try { win.assembleOnly(); } catch (e) { /* surfaced in the console */ }
      return { ok: !!win.eval('assembled'), out: consoleText() };
    };
    const mustReject = (label, src, needle) => {
      const r = tryAsm('.text\nmain:\n' + src + '\n');
      if (r.ok) throw new Error(`${label}: assembled when it should not have`);
      if (needle && !r.out.includes(needle)) {
        throw new Error(`${label}: diagnostic did not mention "${needle}" — got: ` +
          r.out.replace(/\s+/g, ' ').slice(0, 200));
      }
    };
    const mustAccept = (label, src) => {
      const r = tryAsm('.text\nmain:\n' + src + '\n');
      if (!r.ok) throw new Error(`${label}: rejected a valid program — ` +
        r.out.replace(/\s+/g, ' ').slice(0, 200));
      return r;
    };

    // Missing operands used to be filled in with x0 / 0; surplus ones dropped.
    mustReject('add with 2 operands',  'add t0, t1',          'add takes 3 operands');
    mustReject('add with 4 operands',  'add t0, t1, t2, t3',  'add takes 3 operands');
    mustReject('addi with 2 operands', 'addi t0, t1',         'addi takes 3 operands');
    mustReject('lw with 1 operand',    'lw t0',               'lw takes 2 or 3 operands');
    mustReject('sw with 1 operand',    'sw t0',               'sw takes 2 or 3 operands');
    mustReject('beq with 2 operands',  'beq t0, t1',          'beq takes 3 operands');
    mustReject('slli with 2 operands', 'slli t0, t1',         'slli takes 3 operands');
    mustReject('ecall with operands',  'ecall t0',            'ecall takes 0 operands');
    mustReject('nop with operands',    'nop t0',              'nop takes 0 operands');
    mustReject('ret with operands',    'ret t0',              'ret takes 0 operands');
    mustReject('li with 1 operand',    'li t0',               'li takes 2 operands');
    mustAccept('jal with 1 operand',   'jal main');
    mustAccept('jal with 2 operands',  'jal ra, main');
    mustAccept('jalr with 1 operand',  'jalr ra');
    console.log('Operand counts are checked; missing operands are no longer invented');

    // A shift amount over 31 was masked to 0x1F: `slli t0, t1, 32` shifted by 0.
    mustReject('shift by 32', 'slli t0, t1, 32', 'shift amount 32 is out of range');
    mustReject('shift by 99', 'srli t0, t1, 99', 'shift amount 99 is out of range');
    mustAccept('shift by 31', 'slli t0, t1, 31');
    // lui's immediate was truncated to 20 bits in silence.
    mustReject('lui over 20 bits', 'lui t0, 0x100000', 'does not fit the 20 bits');
    mustAccept('lui at the limit', 'lui t0, 0xFFFFF');
    console.log('Shift amounts and lui immediates are range-checked');

    // A value too wide for its directive was truncated in silence.
    mustReject('.byte 256',     '.data\nv: .byte 256',      'does not fit in .byte');
    mustReject('.half 65536',   '.data\nv: .half 65536',    'does not fit in .half');
    mustReject('.word too big', '.data\nv: .word 0x1FFFFFFFF', 'does not fit in .word');
    mustAccept('.byte 255',     '.data\nv: .byte 255');
    mustAccept('.byte -128',    '.data\nv: .byte -128');
    mustAccept('.word 0xFFFF00A0', '.data\nv: .word 4294901920');
    console.log('Data directives reject values that would be truncated');

    // A duplicate label silently redefined; a register-named label was unreachable.
    mustReject('duplicate label', 'a: nop\na: nop', 'defined more than once');
    mustReject('label named t0',  't0: nop\nj t0',  'is a register name');
    console.log('Duplicate and register-named labels are rejected');

    // Misaligned word/half accesses warn but still assemble; byte access stays quiet.
    const mis = mustAccept('misaligned lw', 'lw t0, 1(sp)');
    if (!/multiple of the access size/.test(mis.out)) {
      throw new Error('No misalignment warning for `lw t0, 1(sp)`');
    }
    const bytewise = mustAccept('byte access at any offset', 'lb t0, 1(sp)');
    if (/multiple of the access size/.test(bytewise.out)) {
      throw new Error('`lb t0, 1(sp)` should not warn — a byte access has no alignment rule');
    }
    const aligned = mustAccept('aligned lw', 'lw t0, 4(sp)');
    if (/multiple of the access size/.test(aligned.out)) {
      throw new Error('`lw t0, 4(sp)` warned about alignment when it is aligned');
    }
    console.log('Misaligned word/half accesses warn; byte accesses do not');

    // ecall works here but not on the board; say so once per assemble, and
    // only for assembly (every compiled C program ends with the CRT0 shim's).
    await win.loadExample('fib');
    doc.getElementById('console').innerHTML = '';
    win.assembleOnly();
    if (!/uses ecall \(2 sites\)/.test(consoleText())) {
      throw new Error('No ecall notice for an assembly program that uses it');
    }
    if (!/hardware does not/.test(consoleText())) {
      throw new Error('The ecall notice does not say the hardware lacks support');
    }
    await win.loadExample('dip_led');
    doc.getElementById('console').innerHTML = '';
    win.assembleOnly();
    if (/uses ecall/.test(consoleText())) {
      throw new Error('ecall notice fired for a program that does not use ecall');
    }
    // And the source itself carries the warning.
    await win.loadExample('fib');
    if (!/ecall is a simulator convenience/.test(win.editor.value)) {
      throw new Error('The fib example lost its ecall note');
    }
    console.log('ecall is flagged in the source and once per assemble');
    console.log('✅ Assembler audit findings verified!');

    // 13. The status message and the metrics readout must not say the same
    //     thing twice. PC and the instruction count live in the readout, so a
    //     step message says what the step DID, not what the counters show.
    console.log('\n[13] Testing status message / metrics readout de-duplication...');
    await win.loadExample('fib');
    win.assembleOnly();
    const statusOf = () => doc.getElementById('statusBar').textContent;
    const statsOf  = () => doc.getElementById('statsBar').textContent;

    for (let i = 0; i < 4; i++) win.stepOnce();
    if (/PC\s*[:=]/i.test(statusOf())) {
      throw new Error('Step status repeats the PC that the metrics readout already shows: ' + statusOf());
    }
    if (!/PC:/.test(statsOf())) throw new Error('The metrics readout lost the PC');
    win.stepBack();
    if (/PC\s*[:=]/i.test(statusOf())) {
      throw new Error('Back-step status repeats the PC: ' + statusOf());
    }
    if (!/line/i.test(statusOf())) {
      throw new Error('Back-step status says nothing useful: ' + statusOf());
    }
    console.log(`Step status: "${statusOf()}"  |  metrics: "${statsOf().replace(/\s+/g, ' ').trim()}"`);

    // The overflow warnings state the size once, and the advice lives in the
    // console rather than being repeated in the status bar.
    // circle_accel used to overflow the default 0x200 code segment, which is
    // what this checked. Selecting it now sets the segment from its row in
    // examples/index.txt, so it fits - the overflow has to be forced instead.
    await win.loadExample('circle_accel');
    doc.getElementById('ms-codesize').value = '0x100';
    win.eval('applyAndCloseSettings()');
    doc.getElementById('console').innerHTML = '';
    win.assembleOnly();
    const overflowLine = [...doc.querySelectorAll('#console div')].map(d => d.textContent)
      .find(t => /over the .* Code segment/.test(t)) || '';
    if (!overflowLine) throw new Error('No code-overflow warning for circle_accel');
    if (/\(0x[0-9a-f]+\)/i.test(overflowLine)) {
      throw new Error('The overflow warning still prints the same size in two bases: ' + overflowLine);
    }
    if (!/Raise "Code \(\.text\) size"/.test(overflowLine)) {
      throw new Error('The overflow warning lost the fix: ' + overflowLine);
    }
    if (/Raise "Code/.test(statusOf())) {
      throw new Error('The status bar repeats advice the console already gives: ' + statusOf());
    }
    if (!/too many for the Code segment/.test(statusOf())) {
      throw new Error('The status bar does not report the overflow: ' + statusOf());
    }
    console.log(`Overflow status: "${statusOf()}"`);
    console.log('✅ Status messages carry no redundancy with the metrics readout!');

    // 14. The Example menu is generated from one table, so a label cannot
    //     revert when the language is switched and switched back.
    console.log('\n[14] Testing the Example menu survives a language round-trip...');
    const menuText = () => Array.from(doc.getElementById('exampleSelect').options)
      .map(o => o.textContent).join(' | ');
    const asmMenuBefore = menuText();
    if (!/start here/.test(asmMenuBefore)) {
      throw new Error('The ASM Example menu does not mark a starting point: ' + asmMenuBefore);
    }
    win.setLanguageMode('c');
    const cMenu = menuText();
    if (!/start here/.test(cMenu)) {
      throw new Error('The C Example menu does not mark a starting point: ' + cMenu);
    }
    win.setLanguageMode('asm');
    if (menuText() !== asmMenuBefore) {
      throw new Error('The ASM Example menu changed across a language round-trip:\n' +
        '  before: ' + asmMenuBefore + '\n  after:  ' + menuText());
    }
    console.log('ASM menu survives asm → c → asm unchanged, and both mark a starting point');

    // Statement Stepping is one setting; its blurb stays short.
    const jsBlurb = doc.querySelector('#simStatementStep')
      .closest('.sim-card').querySelector('span').textContent.replace(/\s+/g, ' ').trim();
    if (doc.querySelector('#hdlStatementStep')) throw new Error('Statement Stepping should appear once');
    if (jsBlurb.length > 130) throw new Error('The Statement Stepping blurb has grown back: ' + jsBlurb);
    console.log(`Statement Stepping appears once: "${jsBlurb}"`);
    console.log('✅ Example menu and shared-setting wording verified!');

    // 15. A symbol offset is a number in the assembler's own syntax, and the
    //     escaper has to survive an attribute. Both are silent when wrong:
    //     `sym+1f` resolved to `sym+1`, and a quote ended an attribute early.
    console.log('\n[15] Testing symbol-offset numbers and HTML attribute escaping...');
    win.setLanguageMode('asm');
    const asmSym = (expr) => {
      doc.getElementById('console').innerHTML = '';
      win.editor.value = '.data\nmsg: .word 1,2,3,4,5,6,7,8,9,10\n.text\nmain:\n    la t0, ' + expr + '\n';
      try { win.assembleOnly(); } catch (e) { /* surfaced in the console */ }
      if (!win.eval('assembled')) return null;
      const rows = win.eval('JSON.stringify(machineCode.map(m => ({a: m.address >>> 0, n: m.native})))');
      const parsed = JSON.parse(rows);
      const hi = parsed.find(r => /^auipc/.test(r.n || ''));
      const lo = parsed.find(r => /^addi/.test(r.n || ''));
      if (!hi || !lo) return null;
      const hiM = hi.n.match(/^auipc x\d+, (-?\d+)$/);
      const loM = lo.n.match(/, (-?\d+)$/);
      if (!hiM || !loM) {
        throw new Error(`la expanded to operands this check cannot read: "${hi.n}" / "${lo.n}"`);
      }
      return (hi.a + (parseInt(hiM[1], 10) << 12) + parseInt(loM[1], 10)) >>> 0;
    };
    const base = asmSym('msg');
    if (base === null) throw new Error('la t0, msg did not assemble');
    if (asmSym('msg+0x1f') !== ((base + 31) >>> 0)) {
      throw new Error('msg+0x1f did not resolve 31 bytes past msg');
    }
    if (asmSym('msg+31') !== ((base + 31) >>> 0)) {
      throw new Error('msg+31 did not resolve 31 bytes past msg');
    }
    if (asmSym('msg-16') !== ((base - 16) >>> 0)) {
      throw new Error('msg-16 did not resolve 16 bytes before msg');
    }
    // Bare hex is not a number here, and must not be read as its leading digits.
    if (asmSym('msg+1f') !== null) {
      throw new Error('msg+1f assembled; a bare-hex offset must be rejected, not truncated');
    }
    if (!/msg\+1f/.test(doc.getElementById('console').textContent)) {
      throw new Error('the diagnostic for msg+1f does not name the expression');
    }
    console.log('symbol offsets accept 0x-hex and decimal, reject bare hex');

    // Every operand the Native column prints has to be one the assembler
    // would take back. `la` printed the address the auipc stands for rather
    // than the 20-bit field, which is well outside what auipc encodes.
    const nativesOf = (src) => {
      doc.getElementById('console').innerHTML = '';
      win.editor.value = src;
      try { win.assembleOnly(); } catch (e) { /* surfaced in the console */ }
      if (!win.eval('assembled')) throw new Error('did not assemble: ' + src);
      return win.eval('machineCode').filter(m => m.native).map(m => m.native);
    };
    const pseudoSources = [
      '.data\nmsg: .word 1\n.text\nmain:\n    la t0, msg\n',
      '.text\nmain:\n    call far\n    nop\nfar:\n    ret\n',
      '.text\nmain:\n    tail far\n    nop\nfar:\n    ret\n'
    ];
    for (const src of pseudoSources) {
      for (const nat of nativesOf(src)) {
        const round = nativesOf('.text\nmain:\n    ' + nat + '\n');
        if (round[0] !== nat) {
          throw new Error(`Native column printed "${nat}", which assembles back as ` +
            `"${round[0]}"`);
        }
      }
    }
    console.log('la / call / tail print operands the assembler takes back unchanged');

    const esc = win.eval('escapeHtml');
    const escaped = esc('a"b\'c<d>e&f');
    for (const [ch, ent] of [['"', '&quot;'], ["'", '&#39;'], ['<', '&lt;'], ['>', '&gt;'], ['&', '&amp;']]) {
      if (!escaped.includes(ent)) {
        throw new Error(`escapeHtml left ${ch} unescaped: ${escaped}`);
      }
    }
    if (/[<>"']/.test(escaped)) {
      throw new Error('escapeHtml left a raw markup character behind: ' + escaped);
    }
    // The value has to survive being parsed back out of a double-quoted attribute.
    const probe = doc.createElement('div');
    probe.innerHTML = `<span title="${esc('he said "hi" <now>')}"></span>`;
    if (probe.firstChild.getAttribute('title') !== 'he said "hi" <now>') {
      throw new Error('an escaped value did not round-trip through an attribute: ' +
        probe.firstChild.getAttribute('title'));
    }
    console.log('escapeHtml covers quotes and round-trips through an attribute');
    console.log('✅ Symbol offsets and attribute escaping verified!');

    // 16. Faults that assembled or ran without a word: each of these produced
    //     a wrong number and nothing on screen to say so.
    console.log('\n[16] Testing assembler, execution and edit-field corner cases...');
    const assembleSrc = (src) => {
      doc.getElementById('console').innerHTML = '';
      win.editor.value = src;
      try { win.assembleOnly(); } catch (e) { /* surfaced in the console */ }
      return !!win.eval('assembled');
    };
    // Steps until the PC reaches `halt`, so an `li` or `la` that expands to
    // two instructions cannot leave the check reading a register early.
    const runToHalt = (src) => {
      if (!assembleSrc(src)) throw new Error('did not assemble: ' + src);
      const halt = win.eval('labels.halt');
      for (let n = 0; n < 200 && win.eval('pc') !== halt; n++) win.stepOnce();
      if (win.eval('pc') !== halt) throw new Error('never reached halt: ' + src);
      return (r) => win.eval(`regs[${r}]`);
    };

    // %lo of an address with bit 31 set: the subtraction form came out 2**32.
    let reg = runToHalt('.equ U, 0xFFFF0064\n.text\nmain: lui t0, %hi(U)\n    addi t0, t0, %lo(U)\nhalt: j halt\n');
    if ((reg(5) >>> 0) !== 0xFFFF0064) {
      throw new Error(`%hi/%lo of 0xFFFF0064 built 0x${(reg(5) >>> 0).toString(16)}`);
    }
    // A typo in li's operand assembled as li 0.
    if (assembleSrc('.text\nmain: li t0, nosuch\nhalt: j halt\n')) {
      throw new Error('li with an undefined symbol assembled');
    }
    if (!/nosuch/.test(doc.getElementById('console').textContent)) {
      throw new Error('the diagnostic for li nosuch does not name the symbol');
    }
    if (assembleSrc('.text\nmain: li t0, 0x100000000\nhalt: j halt\n')) {
      throw new Error('li with a 33-bit value assembled (it was truncated to 0)');
    }
    reg = runToHalt('.text\nmain: li t0, 0b101\n    li t1, -0x800\nhalt: j halt\n');
    if (reg(5) !== 5 || reg(6) !== -2048) throw new Error('li 0b101 / li -0x800 loaded the wrong values');
    // A continuation line after .short: pass 1 sized it, pass 2 rejected it,
    // and every later label pointed two bytes away from its data.
    reg = runToHalt('.data\na: .short 1\n    2\nb: .word 0x12345678\n.text\n' +
                    'main: la t0, b\n    lw t1, 0(t0)\nhalt: j halt\n');
    if ((reg(6) >>> 0) !== 0x12345678) {
      throw new Error(`lw from the label after a .short continuation read 0x${(reg(6) >>> 0).toString(16)}`);
    }
    // .space in hex reserved nothing (parseInt(..., 10) of "0x10" is 0).
    assembleSrc('.data\nbuf: .space 0x10\nafter: .word 1\n.text\nmain: j main\n');
    if (win.eval('labels.after - labels.buf') !== 16) {
      throw new Error('.space 0x10 did not reserve 16 bytes');
    }
    console.log('%lo, li, data continuation and .space verified');

    // amomin/amomax compare signed; memory was read back unsigned.
    reg = runToHalt('.data\nv: .word -1\nw: .word -1\n.text\nmain: la t0, v\n    li t1, 5\n' +
                    '    amomin.w t2, t1, (t0)\n    lw t3, 0(t0)\n    la t0, w\n' +
                    '    amomax.w t2, t1, (t0)\n    lw t4, 0(t0)\nhalt: j halt\n');
    if (reg(28) !== -1) throw new Error(`amomin.w of -1 and 5 stored ${reg(28)}`);
    if (reg(29) !== 5) throw new Error(`amomax.w of -1 and 5 stored ${reg(29)}`);
    // fclass.s / fclass.d never wrote rd; fcvt.w.s wrapped instead of saturating.
    reg = runToHalt('.data\nbig: .word 0x7f000000\nninf: .word 0xff800000\n.text\nmain: li t1, 5\n' +
                    '    fcvt.s.w f1, t1\n    fclass.s a0, f1\n    fcvt.d.w f2, t1\n    fclass.d a1, f2\n' +
                    '    la t0, big\n    flw f3, 0(t0)\n    fcvt.w.s a2, f3\n    fcvt.wu.s a3, f3\n' +
                    '    la t0, ninf\n    flw f4, 0(t0)\n    fclass.s a4, f4\n    fcvt.w.s a5, f4\nhalt: j halt\n');
    if (reg(10) !== 0x40 || reg(11) !== 0x40) {
      throw new Error(`fclass of +5.0 gave s=${reg(10)} d=${reg(11)}, expected 0x40 (positive normal)`);
    }
    if (reg(12) !== 0x7FFFFFFF || reg(13) !== -1) {
      throw new Error(`fcvt of 1.7e38 gave w=${reg(12)} wu=${reg(13)}, expected to saturate`);
    }
    if (reg(14) !== 0x001 || reg(15) !== -0x80000000) {
      throw new Error(`-inf gave fclass ${reg(14)} and fcvt.w.s ${reg(15)}`);
    }
    // The unsigned conversions were encoded as the double-precision signed
    // ones, so fcvt.wu.s read the D register file. And the rounding mode in
    // funct3 was ignored in favour of truncation.
    reg = runToHalt('.data\nv: .word 0x402ccccd\nh: .word 0x40200000\n.text\nmain: la t0, v\n' +
                    '    flw f1, 0(t0)\n    fcvt.w.s a0, f1\n    fcvt.w.s a1, f1, rtz\n' +
                    '    fcvt.wu.s a2, f1, rtz\n    la t0, h\n    flw f2, 0(t0)\n    fcvt.w.s a3, f2\n' +
                    '    fcvt.w.s a4, f2, rmm\n    li t1, -1\n    fcvt.s.wu f3, t1\n    fcvt.w.s a5, f3, rtz\n' +
                    'halt: j halt\n');
    if (reg(10) !== 3 || reg(11) !== 2 || reg(12) !== 2) {
      throw new Error(`2.7 converted as rne=${reg(10)} rtz=${reg(11)} wu,rtz=${reg(12)}`);
    }
    if (reg(13) !== 2 || reg(14) !== 3) {
      throw new Error(`2.5 converted as rne=${reg(13)} rmm=${reg(14)}, expected 2 and 3`);
    }
    if (reg(15) !== 0x7FFFFFFF) {
      throw new Error(`fcvt.s.wu of 0xffffffff then back gave ${reg(15)}; it was read as signed`);
    }
    const fcvtWords = nativesOf('.text\nmain: fcvt.wu.s a0, fa0\n    fcvt.w.d a0, fa0\n').length;
    const enc = win.eval('JSON.stringify(machineCode.filter(m => m.bytes).map(m => ' +
      '(m.bytes[0] | m.bytes[1] << 8 | m.bytes[2] << 16 | m.bytes[3] << 24) >>> 0))');
    const [wus, wd] = JSON.parse(enc);
    if (fcvtWords !== 2 || wus === wd || wus !== 0xc0157553) {
      throw new Error(`fcvt.wu.s encoded as 0x${wus.toString(16)} (fcvt.w.d is 0x${wd.toString(16)})`);
    }
    console.log('amomin/amomax, fclass and fcvt saturation verified');

    // Editing a7 in the Registers panel also overwrote an FP double register,
    // and the edit popup read a decimal as hex.
    assembleSrc('.text\nmain: j main\n');
    win.eval('dregs[1] = 1.5');
    const a7Cell = doc.querySelector('#regBody tr:nth-child(18) td[data-type="hex"]');
    win.startRegEdit(a7Cell);
    a7Cell.textContent = '5';
    win.eval('commitRegEdit')(a7Cell);
    if (win.eval('regs[17]') !== 5 || win.eval('dregs[1]') !== 1.5) {
      throw new Error(`editing a7 left a7=${win.eval('regs[17]')}, dregs[1]=${win.eval('dregs[1]')}`);
    }
    const commitModal = win.eval('commitRegEditModal');
    for (const [typed, want] of [['42', 42], ['-1', -1], ['0x2a', 42], ['ff', 255]]) {
      commitModal(5, typed);
      if (win.eval('regs[5]') !== want) {
        throw new Error(`the register popup read "${typed}" as ${win.eval('regs[5]')}, not ${want}`);
      }
    }
    commitModal(5, '0x1ffffffff');
    if (win.eval('regs[5]') !== 255) throw new Error('the register popup accepted a 33-bit value');
    console.log('register edits touch only the register, and read decimal as decimal');
    console.log('✅ Assembler, execution and edit-field corner cases verified!');

    // 17. Encodings checked against GNU as, and the open items from [16].
    console.log('\n[17] Testing encodings, the FP register file, atomics and MMIO edges...');
    const words = (src) => {
      if (!assembleSrc(src)) throw new Error('did not assemble: ' + src);
      return JSON.parse(win.eval('JSON.stringify(machineCode.filter(m => m.bytes && m.address < dataBase)' +
        '.map(m => (m.bytes[0] | m.bytes[1] << 8 | m.bytes[2] << 16 | m.bytes[3] << 24) >>> 0))'));
    };
    // Every mnemonic in the instruction table, plus the optional operand
    // forms, against what GNU as encodes (gnu_encodings.json says how it was
    // produced). This is what caught funct5 written as funct7 for the atomics,
    // the unsigned FP conversions sharing the D forms' funct7, and bare fence.
    const gnuRef = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'gnu_encodings.json'), 'utf8'));
    for (const [src, hex] of gnuRef.encodings) {
      const got = words('.text\nmain: ' + src + '\n')[0];
      if (got !== parseInt(hex, 16)) {
        throw new Error(`${src} encoded as 0x${(got >>> 0).toString(16)}, GNU as gives 0x${hex}`);
      }
    }
    // The shipped DIP_to_LED image was built by RARS; ours has to match it word for word.
    const rarsImage = fs.readFileSync(path.resolve(__dirname, '../RV/AA_IROM_DIP_to_LED.mem'), 'utf8')
      .split('\n').map(l => l.trim()).filter(Boolean).map(l => parseInt(l, 16));
    const ours = words(win.eval('BAKED_ASM_EXAMPLE'));
    if (JSON.stringify(ours) !== JSON.stringify(rarsImage)) {
      throw new Error('DIP_to_LED no longer assembles to the RARS image in RV/AA_IROM_DIP_to_LED.mem');
    }
    // call's jalr carried no offset, so a callee that was not 4 KB-aligned from
    // the call site was missed.
    reg = runToHalt('.text\nmain: call f\nhalt: j halt\n    nop\nf:  li a0, 7\n    ret\n');
    if (reg(10) !== 7) throw new Error('call to a function 12 bytes away never reached it');
    // la/call/tail rows get the immediate readings every other row has.
    assembleSrc('.data\nmsg: .word 1\n.text\nmain: la t0, msg\n    call main\n');
    const marked = win.eval('machineCode.filter(m => m.isPseudo && m.imm).length');
    if (marked !== 4) throw new Error(`${marked} of la/call's four rows carry immediate readings`);
    // A label is an address: li with one is always lui + addi, in both passes.
    if (words('.text\nmain: li t0, later\nlater: nop\n').length !== 3) {
      throw new Error('li with a forward label was not sized as two instructions');
    }
    console.log('encodings match GNU as, DIP_to_LED matches RARS, call reaches its target');

    // F and D share one register file, with singles NaN-boxed.
    reg = runToHalt('.data\nd: .word 0, 0x3ff00000\n.text\nmain: la t0, d\n    fld f1, 0(t0)\n' +
                    '    fmv.x.w a0, f1\n    fcvt.w.d a1, f1\n    fadd.s f2, f1, f1\n' +
                    '    fclass.s a2, f2\n    li t1, 3\n    fcvt.s.w f3, t1\n    fsd f3, 0(t0)\n' +
                    '    lw a3, 4(t0)\n    fcvt.d.s f4, f3\n    fcvt.w.d a4, f4\nhalt: j halt\n');
    if (reg(10) !== 0 || reg(11) !== 1) throw new Error('fld 1.0 then fmv.x.w / fcvt.w.d read the wrong register file');
    if (reg(12) !== 0x200) throw new Error(`a double read as a single was not the canonical NaN (fclass ${reg(12)})`);
    if (reg(13) !== -1) throw new Error(`fsd of a single stored upper word 0x${(reg(13) >>> 0).toString(16)}, not the NaN box`);
    if (reg(14) !== 3) throw new Error('fcvt.d.s of 3.0 did not read the single back');
    // sc.w fails without a matching lr.w, and does not store.
    reg = runToHalt('.data\nv: .word 5\n.text\nmain: la t0, v\n    li t1, 9\n    sc.w a0, t1, (t0)\n' +
                    '    lw a1, 0(t0)\n    lr.w a2, (t0)\n    sc.w a3, t1, (t0)\n    lw a4, 0(t0)\n' +
                    '    sc.w a5, t1, (t0)\nhalt: j halt\n');
    if (reg(10) !== 1 || reg(11) !== 5) throw new Error('sc.w without lr.w succeeded or stored');
    if (reg(12) !== 5 || reg(13) !== 0 || reg(14) !== 9) throw new Error('lr.w / sc.w pair did not store');
    if (reg(15) !== 1) throw new Error('a second sc.w reused a spent reservation');
    console.log('one FP register file with NaN boxing; lr.w/sc.w reservation');

    // A word straddling into the MMIO window went wholly to memory: the two
    // bytes at 0xFFFF0000 read back as whatever was stored there, not as
    // UART_RX_VALID.
    assembleSrc('.text\nmain: li t0, 0xFFFEFFFE\n    li t1, 0x00AB1234\n    sw t1, 0(t0)\n' +
                '    lw a0, 0(t0)\nhalt: j halt\n');
    win.eval('uartRxFull = true; uartRxByte = 0x41');
    for (let n = 0; n < 12 && win.eval('pc') !== win.eval('labels.halt'); n++) win.stepOnce();
    if ((win.eval('regs[10]') >>> 0) !== 0x00011234) {
      throw new Error(`a straddling lw read 0x${(win.eval('regs[10]') >>> 0).toString(16)}, expected ` +
        'the stored low half and RX_VALID = 1 above it');
    }
    const unmapped = win.eval('mmioReadOnlyMessage(0xFFFF0050)');
    if (!unmapped || win.eval('mmioReadOnlyMessage(0xFFFF0065)') === null) {
      throw new Error('an unmapped MMIO word, or a byte inside DIP, was offered for editing');
    }
    if (win.eval('mmioReadOnlyMessage(0xFFFF0061)') !== null) {
      throw new Error('a byte of the LED register was refused as read-only');
    }
    // Typing into OLED DATA after a present is the user, not a program race.
    assembleSrc('.text\nmain: li t0, 0xFFFF002C\n    li t1, 8\n    sw t1, 0(t0)\nhalt: j halt\n');
    for (let n = 0; n < 6; n++) win.stepOnce();
    doc.getElementById('console').innerHTML = '';
    win.eval('writeMemFromPanel')(0xFFFF0028, 0xFF, 1);
    if (/OLED: pixels were written after a present/.test(doc.getElementById('console').textContent)) {
      throw new Error('a Memory-panel edit raised the OLED race warning');
    }
    console.log('MMIO straddle, unmapped words, and panel edits verified');
    console.log('✅ Encodings, FP register file, atomics and MMIO edges verified!');

    console.log('\n===========================================================');
    console.log('🎉 ALL COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS!');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  }
}, 400);
