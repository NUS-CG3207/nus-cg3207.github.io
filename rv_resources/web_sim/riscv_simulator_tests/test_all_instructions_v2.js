const fs = require('fs');
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
  }
});

const { assemble } = dom.window;

console.log('Testing instruction set assembler coverage...');

const testCode = `
.text
.globl main
main:
  # RV32I Arithmetic & Logical
  add x1, x2, x3
  sub x4, x5, x6
  xor x7, x8, x9
  or x10, x11, x12
  and x13, x14, x15
  sll x16, x17, x18
  srl x19, x20, x21
  sra x22, x23, x24
  slt x25, x26, x27
  sltu x28, x29, x30

  # RV32I Immediates
  addi x1, x2, 100
  xori x3, x4, -5
  ori x5, x6, 0x55
  andi x7, x8, 0xFF
  slli x9, x10, 4
  srli x11, x12, 5
  srai x13, x14, 6
  slti x15, x16, 10
  sltiu x17, x18, 20
  lui x19, 0x12345
  auipc x20, 0x1000

  # RV32I Branches & Jumps
  beq x1, x2, target
  bne x3, x4, target
  blt x5, x6, target
  bge x7, x8, target
  bltu x9, x10, target
  bgeu x11, x12, target
  jal x1, target
  jalr x2, 0(x1)

  # Loads & Stores
  lb x1, 0(x2)
  lh x3, 2(x4)
  lw x5, 4(x6)
  lbu x7, 1(x8)
  lhu x9, 2(x10)
  sb x11, 0(x12)
  sh x13, 2(x14)
  sw x15, 4(x16)

  # RV32M
  mul x1, x2, x3
  mulh x4, x5, x6
  mulhsu x7, x8, x9
  mulhu x10, x11, x12
  div x13, x14, x15
  divu x16, x17, x18
  rem x19, x20, x21
  remu x22, x23, x24

  # RV32A
  lr.w x1, (x2)
  sc.w x3, x4, (x5)
  amoswap.w x6, x7, (x8)
  amoadd.w x9, x10, (x11)
  amoxor.w x12, x13, (x14)
  amoand.w x15, x16, (x17)
  amoor.w x18, x19, (x20)
  amomin.w x21, x22, (x23)
  amomax.w x24, x25, (x26)
  amominu.w x27, x28, (x29)
  amomaxu.w x30, x31, (x1)

  # Pseudo-instructions
  li x1, 0xCAFEBABE
  la x2, datavar
  mv x3, x4
  not x5, x6
  neg x7, x8
  nop
  j target
  jr x1
  ret
  call target
  tail target
  beqz x1, target
  bnez x2, target
  blez x3, target
  bgez x4, target
  bltz x5, target
  bgtz x6, target
  bgt x1, x2, target
  ble x3, x4, target
  bgtu x5, x6, target
  bleu x7, x8, target
  seqz x9, x10
  snez x11, x12
  sltz x13, x14
  sgtz x15, x16

  # Environment
  ecall
  ebreak
  fence

target:
  nop

.data
datavar: .word 0x12345678
`;

const mc = assemble(testCode, 0x10000);
console.log('Assembled instructions count:', mc.length);
let errors = 0;
for (const item of mc) {
  if (item.error) {
    console.error(`Line ${item.line} Error: ${item.error}`);
    errors++;
  }
}

if (errors === 0) {
  console.log('✅ ALL INSTRUCTIONS ASSEMBLED WITH ZERO ERRORS!');
} else {
  throw new Error(`Assembly had ${errors} errors!`);
}
