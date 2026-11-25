# RVEduSim: specification

**Technical specification.** For a task-oriented walkthrough, see the [User Guide](riscv_simulator.md).

| File | What it is |
|---|---|
| [`riscv_simulator.html`](riscv_simulator.html) | The simulator: one file, no build step. Assembling, simulating and the HDL engine run in the browser. The **DIP to LED** example (assembly and C) is embedded in the page; every other example, and C compilation, need the page served over `http://`. |
| [`examples/`](examples/) | All other examples: `asm/*.asm`, `c/*.c`, fetched when selected. `examples/hdl/` holds `Wrapper.v` and `RV_reference.v`, a prebuilt gate-level netlist of a reference core. |
| [`examples/index.txt`](examples/index.txt) | The Example menu: one markdown-style table row per example, giving its key, language, label, file, the `IROM`/`DMEM` depth bits it needs, and a description. Adding a row and a file adds an example; the HTML is not edited. The file is `.txt` so static site generators serve it verbatim rather than render it. |
| [`vendor/`](vendor/README.md) | Local copies of the external engines: the CodeMirror 6 bundle, Icarus Verilog compiled to WebAssembly, and Yosys (`@yowasp/yosys`). |
| [`electron/`](electron/README.md) | The desktop app: this page in an Electron window, with Icarus Verilog and Verilator built natively for each platform. See [§5.18](#518-the-desktop-app). |

**Live:** <https://r-panicker.github.io/RVEduSim/>. A copy is also served on the [CG3207](https://nus-cg3207.github.io/) course site, <https://nus-cg3207.github.io/rv_resources/web_sim/riscv_simulator/>. Vibe coded by Rajesh Panicker.

The page is a self-contained RISC-V assembler, C compiler front-end, emulator and visual
debugger, with an optional second engine that simulates a Verilog processor. The editor
engine, ISA tables and peripherals are in the HTML file. Example programs other than DIP to
LED are plain files in `examples/`, loaded with `fetch()`, which browsers block over
`file://`. C compilation uses the Compiler Explorer (Godbolt) REST API and needs the network
however the page is served.

### Running it locally

Opening `riscv_simulator.html` from disk loads only DIP to LED. To get every example and C
compilation, serve the repository root over `http://`:

```bash
cd <repository root>   # the folder holding riscv_simulator.html
python3 -m http.server 8000
```

then open <http://localhost:8000/riscv_simulator.html>. Any static server works (`npx serve`,
VS Code's Live Server). `examples/` and `vendor/` must stay siblings of
`riscv_simulator.html`.

---

## At a glance

| Area | Capability |
|------|------------|
| **Two engines** | The toolbar's `JS \| HDL` toggle chooses what Run, Step and Back execute: the built-in JavaScript interpreter, or a Verilog processor simulated by Icarus Verilog (WebAssembly in the browser, native in the desktop app) or, in the desktop app, Verilator. Registers, memory, peripherals and breakpoints are shared. See [§5](#5-hdl-simulation-mode). |
| **Editor** | CodeMirror 6 (`window.CM6`). ASM and C modes, each with its own syntax highlighter, autocomplete, signature help and hover documentation. Catppuccin Mocha dark theme. |
| **Assembler** | Two-pass assembler for RV32I + M + A + F + D and common pseudo-instructions. Produces a disassembly with label header rows, jump/branch target annotations and C source-line tags. |
| **C support** | Compiles through Godbolt (RV32 GCC or Clang; `-O` level and ABI selectable; default compiler RISC-V Clang 20.1.0, id `rv32-cclang2010`). A baremetal CRT0 shim that sets `sp` is prepended. PC↔C-line maps in both directions support source-level stepping and breakpoints. See [§3](#3-c-language-support). |
| **Execution** | Non-blocking `requestAnimationFrame` loop; `BATCH_SIZE = min(10000, run limit)` instructions per tick. The run limit (`maxInstructionsPerRun`, default 100,000,000) pauses runaway loops. The functional engine models a single-cycle, multi-cycle (per-category CPI table) or 5-stage pipelined processor. See [§4](#4-execution-engines). |
| **Debugging** | Run / Pause / Resume, Step, Step Back with full register and memory history, and optional Statement Stepping (one C statement or multi-instruction pseudo-instruction per step), in both engines. Breakpoints snap to the next executable line; the executing line is highlighted and scrolled into view. |
| **Memory view** | Sub-tabs `[ Text \| Data \| Stack \| MMIO ]`. Text is read-only; Data, Stack and MMIO are editable. The stack is shown in decreasing address order. Words are displayed little-endian. Segment overflow is warned about. The program can be saved as Verilog `$readmemh` images `AA_IROM.mem` and `AA_DMEM.mem`. |
| **Panels** | Registers, Memory, Peripherals, Disassembly and Locals (C mode) are independent panels: any combination can be shown, docked in a stack or a 2×2 grid, or floated. Layout persists in `localStorage`. See [§2.5](#25-panels). |
| **Console** | One resizable console under the editor carries assembler, runtime and Verilog toolchain output (tagged `[HDL]`). |
| **Settings** | One `⚙ Settings…` modal with three tabs: **Compiler**, **Linker**, **Simulation**. See [§6](#6-settings). |

### Memory layout (defaults)

| Segment | Base | Size |
|---------|------|------|
| `.text` (code) | `0x00400000` | `0x200` (512 B, 128 instructions) |
| `.data` | `0x10010000` | `0x200` |
| Stack top (`sp`) | `0x10010200` | Data base + data size by default; can be overridden |
| MMIO base | `0xFFFF0000` | — |

All values are set in Settings → Linker. Selecting an example sets the segment sizes from its
`IROM`/`DMEM` depth bits in `examples/index.txt`.

### MMIO map (Nexys 4 board peripherals)

| Address | Access | Symbol | Purpose |
|---------|--------|--------|---------|
| `0xFFFF0000` / `0xFFFF0004` | RO | `UART_RX_VALID` / `UART_RX` | Serial receive status and data (pop on read) |
| `0xFFFF0008` / `0xFFFF000C` | RO / WO | `UART_TX_READY` / `UART_TX` | Serial transmit status and data |
| `0xFFFF0020`–`0xFFFF002C` | WO | `OLED_COL/ROW/DATA/CTRL` | 96×64 Pmod OLED; `CTRL[3:0]` advance mode, `CTRL[7:4]` colour format (8/16/24-bit) |
| `0xFFFF0040` / `0xFFFF0044` | RO | `ACCEL_DATA` / `ACCEL_DREADY` | Packed `[31:24]=Temp, [23:16]=X, [15:8]=Y, [7:0]=Z`, each 8-bit signed |
| `0xFFFF0060` / `0xFFFF0064` | WO / RO | `PERIPH_LED` / `PERIPH_DIP` | 16 LEDs / 16 DIP switches |
| `0xFFFF0068` | RO | `PERIPH_PB` | Push buttons (bit 2 = BTNL, 1 = BTNC, 0 = BTNR) |
| `0xFFFF0080` | WO | `PERIPH_SEVENSEG` | 32-bit value shown as 8 hex digits on the 7-segment display |
| `0xFFFF00A0` | RO | `CYCLECOUNT` | Cycles since reset: the model's count in JS mode, clock edges in HDL mode |

The full behavioural map is in [§7.2](#72-mmio-address-map).

---

## 1. Project overview

The simulator is a single-file web application containing a RISC-V assembler (RV32I, M, A,
F, D and pseudo-instructions), a C front-end that compiles through the Godbolt REST API, a
functional emulator and a visual debugger, with an optional second engine that runs a
Verilog processor through Icarus Verilog compiled to WebAssembly (or native Icarus Verilog
and Verilator in the desktop app).

The same program, breakpoints and peripheral panels drive either the functional model or
the RTL, so a program can be run on the model to see what it should do and then on a
processor design to see what that design does.

Components:

- CodeMirror 6 editor for RISC-V assembly and C, with syntax highlighting, autocomplete, signature help, hover documentation and a breakpoint gutter.
- Two-pass assembler and a disassembly view with label headers and branch/jump target annotations.
- Step-by-step debugger with step back and statement stepping.
- Memory explorer with configurable segment bases and sizes and a read-only text segment.
- Single-cycle, multi-cycle and pipelined timing models, with configurable per-category cycle counts.
- Simulated Digilent Nexys 4 board peripherals: LEDs, DIP switches, push buttons, 7-segment display, UART console, 96×64 Pmod OLED, 3-axis accelerometer and temperature sensor, and a cycle counter.
- RARS-compatible `ecall` syscalls.
- 13 example programs (7 assembly, 6 C), listed in `examples/index.txt`.

---

## 2. Architecture and design

### 2.1 Technology stack

- **Runtime**: HTML5, CSS3 and plain JavaScript (ES6+). No build step.
- **Editor engine**: a single CodeMirror 6 bundle, `cm6_bundle.min.js`, assembled into `window.CM6` (see §2.2).
- **Theme**: Catppuccin Mocha palette:

  | Role | Colour |
  |---|---|
  | Base background | `#1e1e2e` |
  | Mantle / editor background | `#181825` |
  | Surface / panels | `#313244` |
  | Primary accent (Mauve) | `#cba6f7` |
  | Keywords (Blue) | `#89b4fa` |
  | Registers / strings (Green) | `#a6e3a1` |
  | Directives / types (Pink) | `#f5c2e7` |
  | Labels (Peach) | `#fab387` |
  | Immediates / numbers (Yellow) | `#f9e2af` |
  | Comments (Gray) | `#6c7086` |
  | Errors / breakpoints (Red) | `#f38ba8` |

- **Layout**: editor and panel column separated by a draggable `.splitter`. The editor side keeps at least 360 px (`LEFT_MIN`), re-clamped on window resize. Below 800 px wide the page switches to a mobile layout.
- **Typography**: system UI font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Icon**: an inline SVG chip icon with an `RV` label, used in the header and as the favicon.
- **Toolbar controls**: 28 px high on desktop, 30 px on mobile.

### 2.2 Editor and language modes

The editor is mounted in `<div id="cmEditorContainer">`. The language is swapped through a
`CM6.Compartment`.

**Language modes** (`[ ASM | C ]`, `setLanguageMode()`):

- **ASM**: `riscvStreamParser` highlighting and instruction/register autocomplete.
- **C**: `cStreamParser` highlighting, C keyword/type autocomplete, the MMIO macros `LEDS`, `SWITCHES`, `BUTTONS`, `SEVSEG`, `UART_TX`, `ACCEL_DATA`, `OLED_COL`, `OLED_ROW`, `OLED_DATA`, `OLED_CTRL`, and the compiler settings.

**Loading `window.CM6`.** A loader script tries these sources in order and takes the first
that loads:

1. `vendor/codemirror/cm6_bundle.min.js` (also preloaded from `<head>`)
2. `riscv_simulator_tests/cm6_bundle.min.js`
3. jsDelivr: `https://cdn.jsdelivr.net/gh/r-panicker/Visualisations@main/riscv_simulator_tests/cm6_bundle.min.js`

The bundle loads through a `<script>` tag, so the editor works over `file://` too. It
contains one copy of every `@codemirror/*` and `@lezer/*` package. The packages cannot be
loaded as separate jsDelivr `+esm` modules: each inlines its own `@lezer/common`, and
extensions built against one instance fail `EditorState` validation ("Unrecognized extension
value"). If `window.CM6` already exists, or `window.__CM6_DISABLE_CDN` is set (used by tests
that inject their own bundle), the loader does nothing. `bootSimulator()` waits until
`window.CM6` exists.

The namespace exposes:

- `@codemirror/state`: `EditorState`, `StateField`, `StateEffect`, `RangeSet`, `RangeSetBuilder`, `EditorSelection`, `Transaction`, `Facet`, `Compartment`.
- `@codemirror/view`: `EditorView`, `GutterMarker`, `gutter`, `lineNumbers`, `lineNumberMarkers`, `highlightActiveLine`, `highlightActiveLineGutter`, `showTooltip`, `hoverTooltip`, `drawSelection`, `dropCursor`.
- `@codemirror/language`: `StreamLanguage`, `HighlightStyle`, `syntaxHighlighting`, `bracketMatching`.
- `@codemirror/commands`: `history`, `historyKeymap`, `defaultKeymap`, `indentWithTab`, `indentMore`, `indentLess`, `undo`, `redo`, `undoDepth`, `redoDepth`.
- `@codemirror/search`: `openSearchPanel`, `closeSearchPanel`, `findNext`, `findPrevious`, `replaceNext`, `replaceAll`.
- `@codemirror/autocomplete`: `autocompletion`, `completionKeymap`, `startCompletion`, `closeCompletion`, `acceptCompletion`.
- `@lezer/highlight`: `tags` (keyword, typeName, variableName, meta, labelName, comment, number, string, punctuation, operator, propertyName).

**Highlighting colours:**

| Token | ASM (`riscvStreamParser`) | C (`cStreamParser`) |
|---|---|---|
| `#89b4fa` | Instructions | Keywords |
| `#a6e3a1` | Registers | Strings, chars |
| `#f5c2e7` | Directives | Types, preprocessor directives |
| `#fab387` | Labels | — |
| `#f9e2af` | Numbers | Numbers (hex, binary) |
| `#89dceb` | Relocation macros (`%hi`, `%lo`) | Operators |
| `#cba6f7` | CSRs | Macros, properties |
| `#6c7086` | Comments | Comments |

### 2.3 Breakpoints and the execution line

- Clicking the breakpoint gutter (`.cm-breakpoint-gutter`) or the line numbers, or pressing `F9` on the cursor line, toggles a breakpoint. The gutter is kept in sync with the simulator's `breakpoints` Set.
- A breakpoint shows a red `●` (`#f38ba8`) and highlights its line number (`cm-breakpoint-line-number`). The code line itself is not tinted; full-line highlighting is reserved for the execution line.
- A breakpoint set on a line with no executable code (comment, directive, blank line, `}`, bare function signature) moves to the next executable line, and the console logs `Breakpoint set at line X (moved from line Y to next valid instruction).`
- The line about to execute (after a step, a back step, or a stop) gets `cm-execLine`: background `rgba(137, 180, 250, 0.18)` and a 3 px `#89b4fa` left border. It is centred in view with `CM6.EditorView.scrollIntoView`.

### 2.4 Editing aids

- **Autocomplete** (`riscvAutocomplete`): at the start of a statement, instructions (RV32I/M/A/F/D), pseudo-instructions and directives with their syntax and descriptions; after a mnemonic, registers (`x0`–`x31`), labels and equates, with the current operand named (`PARAM 1: rd`, `PARAM 2: rs1`, `PARAM 3: imm`). In C mode: types (`int`, `uint32_t`, `size_t`, `void`), keywords (`return`, `if`, `while`, `for`, `struct`, `volatile`), preprocessor directives (`#include`, `#define`) and the MMIO macros.
- **Signature help** (`signatureHelpField`): in an instruction's operands (e.g. `addi |`, `sw x1, 4(|)`), a tooltip above the cursor shows the signature with the active operand highlighted.
- **Hover** (`riscvHoverTooltip`): hovering a mnemonic, register, directive or declared label shows its syntax, description and encoding or line information.
- **Tab**: with no selection, `Tab` inserts a literal `\t`. With a selection, `Tab` indents it (`indentMore`) and `Shift+Tab` unindents it (`indentLess`).
- **Find and replace** (`Ctrl+F` / `Ctrl+H`, `#findReplacePanel`): match counter (`#findCount`), next/previous (`Enter` / `Shift+Enter`), match case (`Alt+C`), replace and replace all, both undoable. `Esc` closes it.
- **Editor facade**: `window.editor` exposes `.value`, `.selectionStart`, `.selectionEnd`, `.scrollTop`, `.scrollLeft`, `.focus()`, `.setSelectionRange()`, `.addEventListener()` and `.removeEventListener()` over the CodeMirror view; `window.editorHistory` provides `undo()` and `redo()`.

### 2.5 Panels

The right column holds independent panels, defined in `PANEL_DEFS`:

| Panel | Shown |
|---|---|
| Registers, Memory, Peripherals, Disassembly | Always available |
| Locals | C mode only; the chip is hidden in ASM mode |
| Waveforms | Mobile only, in HDL mode (on desktop the waveform is a dock at the bottom of the window) |
| Datapath | Mobile only (on desktop the datapath is a dock) |

The toolbar's Datapath button (Waveform in HDL mode, `toggleVisualisation()`) shows or hides
the datapath or waveform view: as a dock on desktop, as its panel on mobile.

```
+---------------------------------------------------+
| ● Registers   ● Memory   ○ Peripherals  ⟳ Disasm  |   <- chips (● shown, ⟳ detached)
+---------------------------------------------------+
| ≤2 docked panels:                                 |
|  REGISTERS                              ⧉   ✕     |
|  ============== drag to resize =================  |
|  MEMORY                                 ⧉   ✕     |
|                                                   |
| >2 docked panels (2×2 grid):                      |
| +----------------------------+  +--------------+  |
| | REGISTERS          ⧉   ✕  |  | MEMORY  ⧉  ✕ |  |
| | ========== drag ==========|  |===== drag ====|  |
| | PERIPHERALS        ⧉   ✕  |  | DISASM  ⧉  ✕ |  |
| +----------------------------+  +--------------+  |
|         +--------------------------------------+  |
|         | DISASSEMBLY (floating)      ▣    ✕   |  <- dragged by header,
|         +--------------------------------------+     resized from any edge
```

- **Chips** (`#panelChip-<name>`): show or hide a panel. A filled mauve dot marks a visible panel; a blue haloed dot marks a floating one.
- **Docked stack** (`.panel-stack`): with up to two docked panels they stack vertically. Each has a header (`.panel-hdr`) with its title, a ⧉ float / ▣ dock toggle and a ✕ hide button. A `.panel-vsplitter` between panels redistributes height; double-click evens it out.
- **2×2 grid** (`dockUsesTwoColumns()`): with more than two docked panels, row 1 holds the first ⌈n/2⌉ panels and row 2 the rest. The dock widens to 50% of the window (`DOCK_TWO_COL_WIDTH_PCT`) and returns to its previous width when two or fewer panels are docked. `.panel-hsplitter` resizes the columns (minimum `MIN_COL_W = 90` px) and `.panel-vsplitter` the rows; double-click either to even them out.
- **Floating panels** (`.tab-content.panel-floating`): `position: fixed`, dragged by the header, resized from any edge (`resize: both`). They sit above the editor and below the Settings modal, and are clamped into the viewport on window resize.
- **Persistence**: visibility, order, row heights, column widths and floating positions and sizes are saved under `rvsim.panelDock.v1`. The default is Registers alone, docked.
- **Empty state**: with every panel hidden on desktop, `.panel-stack-empty` shows a one-line hint.
- **Refresh**: `updateRegisters`, `updateMemoryView`, `updateDisassembly`, `updatePeripherals` and `updateLocalsView` run on every step, run and reset whether or not the panel is visible. The Disassembly panel scrolls to the current PC whenever it is visible.
- **`switchTab(name)`**: makes the named panel visible and refreshes it.

**Column layout** (`PANEL_COLS`, `applyPanelColLayout()`). Registers, Memory, Disassembly and
Locals share one header style, a frozen header row (`position: sticky` inside the
`.panel-body` scrollport; it still scrolls horizontally with the data) and a `.col-resizer`
hairline at every column boundary but the last (11 px hit area, mauve on hover). Each column
has `min`, `fit` and `grow` values:

| Panel | Fixed columns (`grow: 0`) | Growing columns |
|---|---|---|
| Registers | `#`, ABI name, content (hex) | content (dec) |
| Memory | address, content (hex) | content (ASCII / DEC) |
| Disassembly | address, machine code | native instruction, original source |
| Locals | name, address, content (hex) | content (dec) |

Fixed columns keep their content width; growing columns share any surplus. When the panel is
narrower than the sum of the minimums, widths hold and the panel scrolls horizontally.
Dragging a separator pins every column at its rendered width on the first move (not on a
click) and then changes only the dragged column, so columns to its right shift without
resizing. Double-click a separator to unpin the panel. Pinned widths persist under
`rvsim.panelColW.<panel>`. A `ResizeObserver` re-runs the layout when a panel resizes. The
Peripherals panel does not use this layout.

**Mobile (≤ 800 px).** The chips become a tab bar showing exactly one panel at a time. Floating,
the grid, the splitters and the ⧉/✕ header controls are disabled. The selected tab
(`mobileTab`) is not persisted and does not change the desktop layout. If every panel is
hidden in the saved desktop layout, the tab view still shows one panel (Registers by default).

### 2.6 Toolbar and button states

```
+--------------------------------------------------------------------------------------------+
| Row 1: [ ASM | C ] [ JS | HDL ]  Example: [ … ▼ ]  📂 Open  💾 Save  |  ↶ Undo  ↷ Redo  🔍 Find |
| Row 2: ⚙ Assemble  ▶ Run  ⏭ Step  ⏮ Back  ⟲ Reset  |  ⧉ Datapath  ⭳ Download ▼  ⚙ Settings… |
| Row 3: <status message>                    <time> | Cycles: N single | Instr: N | PC: 0x… |
+--------------------------------------------------------------------------------------------+
```

- **Row 1, source and editing**: language toggle, engine toggle, the HDL source chip (`#hdlFilesChip`, HDL mode only), Example selector, Open (`.asm .s .c .h .txt .v .sv .vh .svh`), Save, Undo, Redo, Find.
- **Row 2, simulation**: Assemble (`Ctrl+Enter`), Run / Pause / Resume (`F5`), Step (`F8`), Back (`Shift+F8`), Reset; the Datapath / Waveform toggle; the Download menu (`AA_IROM.mem`, `AA_DMEM.mem`, testbench `.v`, waveform `.vcd`); Settings.
- **Row 3, status**: the status message (`#statusBar`, levels `info`, `success`, `warn`, `error`) and the metrics (`#statsBar`): simulated time, `Cycles: N <tag>`, `Instr: N`, `CPI` (multi-cycle and pipelined models), `Mispredicts` (pipelined with branch prediction), and `PC`. The tag names where the cycle count comes from: `single`, `multi` or `pipe` for the functional model, `hw` for clock edges in HDL mode. The PC is the address of the instruction about to execute.
- **Mobile**: the toolbar becomes a grid. Row 1 holds the file and mode group; row 2 holds the editor group and the Datapath/Download/Settings group side by side, with Undo, Redo, Find and Settings as icons; row 3 holds the simulation controls; the status row follows.

**Button states:**

- **Assemble** (`#btnAssemble`): enabled when the source is new or modified; disabled with the tooltip "Program is already assembled and up to date" once assembled.
- **Undo / Redo** (`#btnUndo`, `#btnRedo`): follow `CM6.undoDepth` and `CM6.redoDepth`.
- **Run** (`#runPauseBtn`): disabled until assembled; `▶ Run` when ready, `⏸ Pause` while running, `▶ Resume` when paused.
- **Step / Back** (`#btnStep`, `#btnBack`): Step is enabled when assembled and paused; Back when there is history (`execHistory.length > 0`).
- **Reset** (`#btnReset`): resets registers and peripherals and keeps the program assembled, so it can be stepped or run without re-assembling.

### 2.7 The console

One console (`#console`) under the editor carries assembler diagnostics, runtime messages,
`ecall` output and the Verilog toolchain's output, tagged `[HDL]`, in the order they occur.
Drag the bar above it (`#consoleResizer`) to resize it; double-click the bar to return to the
default 140 px (`CONSOLE_H_DEFAULT`). The height is saved under `rvsim.consoleHeight.v1`.

The status message above the editor reports what is happening now, including HDL engine
progress (prefixed `HDL`).

---

## 3. C language support

### 3.1 Compilation through Compiler Explorer
- C source is compiled remotely with `POST https://godbolt.org/api/compiler/<id>/compile` (12 s timeout). Assembly mode needs no network; C mode reports an error when the API cannot be reached.
- Compilers (**⚙ Settings → Compiler**): `rv32-cclang2010` (Clang 20.1.0, default), `rv32-cclang` (Clang trunk), `rv32-cgcc1420` (GCC 14.2.0), `rv32-cgcctrunk` (GCC trunk).
- Optimization levels: `-O0` (default; one-to-one C line mapping), `-O1`, `-O2`, `-Os`, `-O3`.
- Architecture flags default to `-march=rv32i -mabi=ilp32`; the *Include M extension* checkbox switches them to `-march=rv32im`. `-fno-pic -fno-pie` is always appended. Without the M extension the compiler calls libgcc helpers for multiply and divide, which are not linked; `warnAboutLibgccHelpers()` reports them after compilation.
- Test harnesses can supply a compiler response through `window.__mockGodboltResponse` (an object, or a function of the source). It is used when no live response is available, which is always the case under jsdom.

### 3.2 CRT0 startup shim
The compiled assembly is wrapped in a startup shim before it is assembled:

```assembly
.text
.globl _start
_start:
    li sp, 0x10010200    # stackBase: Data Base + Data Size by default
    la ra, __halt
    j main
    ...                  # compiled program
.text
__halt:
    j __halt
```

- `sp` is set to `stackBase` (default `0x10010200`, that is `dataBase + dataSize`). If the estimated `.data` size exceeds the Data segment, the startup `sp` is raised above the data (end of data plus 8 KiB, rounded up to 4 KiB) and a warning names the Linker setting and the `DMEM_DEPTH_BITS` parameter to change for hardware.
- `main()` is entered with `j main` and is expected not to return. `ra` holds `__halt`, so a `ret` from `main` lands on the trap. The trap follows all compiled code, so a PC that runs off the end of the program also stops there.

### 3.3 Source-to-assembly line mapping
Each instruction is mapped to the C line given in Compiler Explorer's `asm[i].source.line`:

| Map | Contents |
|---|---|
| `pcToCLineMap` | PC → C line |
| `cLineToPcsMap` | C line → all PCs compiled from it |
| `cLineToFirstPcMap` | C line → first PC |

Shim instructions carry no source line.

### 3.4 C source-level stepping and breakpoints
- **Step** (`F8`) advances the machine code and highlights the C statement the current PC belongs to. **Back** (`Shift+F8`) restores registers, memory and the highlight.
- A breakpoint set on a C line with no code moves to the next line that has code (`findNextValidInstructionLine()`, using `cLineToFirstPcMap`). **Run** (`F5`) halts on breakpointed lines.

---

## 4. Execution engines

The toolbar's `JS | HDL` pill chooses which engine Run, Step, Back and Reset drive. The editor, breakpoints, the registers, memory and disassembly panels and the peripheral board are shared by both engines.

| | Functional (JS) | Hardware (HDL) |
|---|---|---|
| Executes | Built-in RV32GC interpreter | The uploaded `.v` sources |
| Stepping | Live, one instruction at a time | Through a recording, forwards and backwards |
| Run / Resume / breakpoints | Yes | Yes; Resume seeks the recording to the next breakpoint |
| Registers panel | Live | Read from the register file by hierarchical reference |
| Memory panel | Live | Driven by the Wrapper's DMEM writes |
| LEDs / 7-seg / OLED / UART | Live | Driven by the hardware's pins |
| Unwritten registers | Shown as `0` | Shown as `xxxxxxxx` |
| `Cycles` readout | Model estimate, tagged `est` | Clock edges, tagged `hw` |
| Speed | Millions of instructions/s | About 40k–200k cycles/s |

Only one engine executes at a time (`setSimEngineMode()`):
- Switching away from a running functional simulation stops it. Its state is kept, so switching back and pressing Resume continues.
- The toggle is disabled while an HDL run is in progress, because an HDL run cannot be paused.
- A switch does not discard the HDL recording. Each switch lands on the instruction the other engine had reached.

### 4.1 Functional engine: run loop and timing model
- **Run loop.** Execution proceeds in batches of `BATCH_SIZE = min(10000, run limit)` instructions per event-loop tick, so the UI stays responsive during long runs.
- **Run limit.** `simMaxInstrPerRun` (**⚙ Settings → JS Simulation**, *Max Instructions Per Run*): default `100,000,000`, range 1 to 2,000,000,000. A run pauses when it reaches the limit.
- **Statement Stepping (Fast Mode)** (`statementStepping`, default off, offered on both the JS and HDL settings tabs). Step executes every instruction of the current C statement or multi-instruction pseudo-instruction at once, and Back undoes the same span. In HDL mode a Step seeks the same distance through the recording.
- **Microarchitecture** (`simMicroarch`): *Single-cycle* (one cycle per instruction), *Multi-cycle* (cycles from the table below) or *5-stage pipeline* (Step and Back move one clock cycle). Switching resets the program.
- **Multi-cycle cycle table** (`cycleConfig`, each value 1 to 1000):

| Key | Class | Default |
|---|---|---|
| `basic` | ALU / shift / LUI / AUIPC | 1 |
| `muldiv` | Multiply / divide (M) | 2 |
| `load` | Load (LW / LH / FLW / FLD) | 2 |
| `store` | Store (SW / SH / FSW / FSD) | 2 |
| `branch` | Branch | 1 |
| `jump` | JAL / JALR | 1 |
| `fp` | Floating-point ops | 4 |
| `system` | ECALL / EBREAK | 1 |

### 4.1b Assembler diagnostics
The assembler rejects input it cannot encode exactly as written, rather than substituting, truncating or ignoring part of it.

**Registers.** Registers are written `x0`–`x31` (`f0`–`f31`) or by ABI name. A bare number in a register operand is an error that names the token and suggests the immediate form:

```
'1' is a number, not a register. add takes registers only — write x0–x31 or an
ABI name such as t0. Did you mean `addi`?
```

**Loads and stores to a symbol.** When a symbol's address does not fit a 12-bit offset from `x0`, the address is built with `auipc` and a `%pcrel_lo` offset:

| Form | Expansion |
|---|---|
| `lw rd, sym` (integer loads) | `auipc rd, …` then `lw rd, …(rd)`; no other register is written |
| `flw`/`fld fd, sym` | error: the scratch register must be named |
| `sw rs2, sym` (all stores) | error: the scratch register must be named |
| `op reg, sym, rt` (loads and stores) | `auipc rt, …` then `op reg, …(rt)` |

The store error reads:

```
sw t0, var1 would need a scratch register to hold the address of 'var1', and would
silently overwrite it. Name it: `sw t0, var1, t1` assembles to
`auipc t1, %pcrel_hi(var1)` then `sw t0, %pcrel_lo(var1)(t1)`. Pick a register you do not need.
```

**Other checks.**

| Input | Result |
|---|---|
| Too few or too many operands (`add t0, t1`, `add t0, t1, t2, t3`, `nop t0`, `ret t0`, `li t0`) | error naming the expected count and form |
| Shift amount outside 0–31 (`slli t0, t1, 32`) | error |
| `lui`/`auipc` immediate outside the 20-bit field (`lui t0, 0x100000`) | error; suggests `li` or `%hi(symbol)` |
| `li` value that does not fit 32 bits | error |
| Label defined twice | error |
| Label with a register name (`t0:`) | error |
| `.byte` / `.half` / `.word` value outside the signed or unsigned range of its width | error naming the range and the truncated value |
| Misaligned load/store offset (`lw t0, 1(sp)`) | warning: the Wrapper's data memory is word-addressed, so the hardware accesses a different word |

Operand counts come from `allowedArity()`, which derives them from the instruction format plus a few exceptions (`jalr`, `jal`, `fence`, single-source FP conversions), and from `pseudoArity()`, which reads the highest `%N` in each pseudo-instruction's expansion template. A new pseudo-instruction is therefore checked without further changes.

The following are accepted: mnemonics in any case; writes to `x0` (`addi x0, x0, 5`); a `.eqv` used before its definition (the assembler is two-pass); `lui` with a negative immediate within the signed 20-bit range; and the register writes that `call` (`ra`), `tail` (`t1`) and `li`/`la` (`rd`) make by definition.

#### `ecall`
`ecall` invokes the simulator's implementation of the RARS syscall services. The Wrapper and a processor without trap support provide no equivalent, so programs meant for the board should use the MMIO peripherals. In assembly mode, each assemble logs one notice giving the number of `ecall` sites; no notice is shown in C mode. Built-in examples that use `ecall` say so in a header comment.

---

### 4.2 Disassembly viewer
- **Label rows** (`.disasm-label-row`): a header row such as `main:` or `loop:` precedes each labelled address, in Assembly and C modes. Label names (`.disasm-label-name`) are orange (`#fab387`), the colour used for labels in the code window and the memory view.
- **Branch and jump targets** (`.disasm-target-label`): numeric targets (e.g. `jal 0x00400040`) carry a badge naming the target label (`<main>`).
- **Machine-code display**: a `[ Byte | Word ]` pill (`disasmViewMode`, default `word`). Word mode shows each aligned 4-byte group as one 8-digit 32-bit hex word (LSB to the right); Byte mode shows separate bytes (`xx xx xx xx`, LSB to the left). Both group data in 4-byte chunks. The mode persists across assembles.
- **Native instruction column**: registers are named `x0`–`x31`, as encoded (`add x5, x5, x6`). ABI names stay in the *Original source* column. This renaming alone does not mark a row as a pseudo-instruction expansion.
- **Pseudo-instructions**: in the *Original source* column a pseudo-instruction is blue (`#89b4fa`, `.code-list .pseudo`); its expanded native instructions are green (`.native-expanded`).
- **C line tags** (`.disasm-cline-tag`): instructions compiled from C show the source line and its text, e.g. `[Line 10: total += arr[i];]`.
- **Column widths**: *Addr* and *Machine code* are fixed (`grow: 0`), sized to fit their content on one line. *Native instruction* and *Original source* share any surplus width equally and wrap at word boundaries (`word-break: normal`). Below the minimum widths the panel scrolls. Widths are written to the table's `<colgroup>` by `applyPanelColLayout()` (see the panel-layout section).
- **Auto-scroll**: the current instruction row (`.current-native`) is scrolled into view on Step, Back and breakpoint halts.

---

## 5. HDL simulation mode

With the toolbar's `JS | HDL` pill set to **HDL**, Run, Step and Back execute your RTL instead of the JavaScript model. The assembled program reaches the design as `AA_IROM.mem` and `AA_DMEM.mem`, read by the Wrapper's own `$readmemh`, as in Vivado. LEDs, 7-segment display, OLED, UART, register writes, memory writes and the PC are fed back into the simulator's usual panels.

### 5.1 Using it

1. Set the pill to **HDL**. The Icarus Verilog engine (`ivlpp`, `ivl`, `vvp` compiled to WebAssembly, about 2.9 MB) starts loading. If no sources are loaded, ⚙ Settings opens on its **⏱ Simulation** tab.
2. Load the Verilog: drop `.v` files anywhere on the page, open them with **📂 Open**, use *browse…* in the *Processor sources* group, or pick their folder with *folder…* ([§5.17](#517-loading-a-folder)). Accepted extensions are `.v`, `.sv`, `.vh` and `.svh`. Include `Wrapper.v`, the core's top module (`RV`) and every module it instantiates. The file declaring `module Wrapper` is tagged in the list. **Prebuilt processor** replaces the loaded sources with `examples/hdl/Wrapper.v` and `examples/hdl/RV_reference.v`: a working RV32I+M core, pre-synthesised into one flattened module with its internal names discarded except for the register file, so the Registers panel still works.
3. Assemble a program.
4. **Run**, then **Step** and **Back** through what the hardware did. With a recording in hand, Run is labelled **Resume**; **Reset** (⟲) discards the recording.

Switching between JS and HDL keeps the recording, and each switch lands on the instruction the other engine had reached. Only one engine executes at a time: switching away from a running functional simulation pauses it, and the engine toggle is locked while an HDL run is in progress.

### 5.2 Controls

There is no HDL panel; the panel layout is the same as in JS mode.

| Where | What |
|---|---|
| ⚙ Settings → ⏱ Simulation | *Processor sources*; *Simulation* (simulator, *Cycles per Run / Resume*); *Recording & output* (Detail preset, *Record the architectural trace*, *Record a waveform* and its signal scope, Verilog standard, cross-check, post-synthesis simulation); *Register file* path. See [§6](#6-settings). |
| Toolbar | Run / Resume, Step, Back, Reset, the source chip, and the **⭳ Download** menu (`AA_IROM.mem`, `AA_DMEM.mem`, *Testbench (.v)*, *Waveform (.vcd)*) |
| Console (under the editor) | engine output, tagged `[HDL]` |
| Status bar | the engine's current activity |

The source chip beside the pill shows the number of loaded files (names on hover), or an amber `⚠ no Verilog` / `⚠ no Wrapper`. Clicking it opens the Simulation tab.

The toolbar's **Cycles** readout is tagged `hw` in HDL mode: clock edges counted by the simulation. In JS mode it is tagged `single`, `multi` or `pipe` and comes from the per-instruction cycles table, which has no effect in HDL mode.

No Verilog is bundled into the page. Sources are loaded per session or read from a folder.

### 5.3 The Wrapper interface

The simulator only instantiates `Wrapper`; it never rewrites or patches it. Everything else is a generated testbench, `cg3207_hdl_tb`, of the kind you would write by hand for Vivado or `iverilog`.

The testbench connects the Wrapper by **named association**, so port order is free, but the Wrapper must declare these ports by these names:

| Port | Width | Direction (seen from `Wrapper`) |
|---|---|---|
| `DIP` | `[15:0]` | input |
| `PB` | `[2:0]` | input |
| `LED_OUT` | `[7:0]` | output |
| `LED_PC` | `[6:0]` | output |
| `SEVENSEGHEX` | `[31:0]` | output |
| `UART_TX` | `[7:0]` | output |
| `UART_TX_ready` | 1 bit | input |
| `UART_TX_valid` | 1 bit | output |
| `UART_RX` | `[7:0]` | input |
| `UART_RX_valid` | 1 bit | input |
| `UART_RX_ack` | 1 bit | output |
| `OLED_Write` | 1 bit | output |
| `OLED_Col` | `[6:0]` | output |
| `OLED_Row` | `[5:0]` | output |
| `OLED_Data` | `[23:0]` | output |
| `ACCEL_Data` | `[31:0]` | input |
| `ACCEL_DReady` | 1 bit | input |
| `RESET` | 1 bit | input |
| `CLK` | 1 bit | input |

The OLED double-buffering pair, `OLED_Swap` (output) and `OLED_SwapPending` (input), is optional. It is connected only when the Wrapper declares both. `OLED_SwapPending` is tied low in the testbench, so a program polling it never blocks.

The testbench also reads `dut.PC`, `dut.Instr`, `dut.MemWrite_out`, `dut.ALUResult`, `dut.WriteData_out`, `dut.MemRead` and `dut.dec_OLED_STATUS` by hierarchical reference (§5.6). Of the Wrapper's body, only the localparams `IROM_DEPTH_BITS` and `DMEM_DEPTH_BITS` are read out of the source (§5.8). The core inside it, the memories and their wiring are entirely the design's own.

### 5.4 The generated testbench

The testbench the page runs contains no assembled code, no switch settings and no input data. All of it is supplied at run time:

| Input | How it arrives |
|---|---|
| Cycle budget, trace level | `+CYCLES=<d>` (default 2000), `+TRACE=<d>` (default 2) |
| DIP, buttons, accelerometer at reset | `+DIP=<h>`, `+PB=<h>`, `+ACCEL=<h>`, `+ADRDY=<h>` (defaults 0, 0, `0x19000040`, 1) |
| Timed input changes | `stim.mem`, read when `+NSTIM=<n>` is non-zero: `<cycle> <code> <value>` triples, codes 1 = DIP, 2 = PB, 3 = ACCEL_Data, 4 = ACCEL_DReady; at most 1024 entries |
| UART input | `uart_rx.mem`, read when `+NRX=<n>` is non-zero: `<cycle> <byte>` pairs; at most 4096 entries |
| Waveform | `+VCD` writes `dump.vcd`; `+VCDTOP` limits it to the testbench and Wrapper levels; `+VCDFROM=<d>` starts it at that cycle |
| Partial trace | `+TRACEFROM=<d>` leaves out every record before that cycle |
| The program | `AA_IROM.mem` / `AA_DMEM.mem`, via the Wrapper's `$readmemh` |

`+LIVE` and `+LIVEFROM=<d>` apply only to live runs with Verilator in the desktop app.

The clock period is 10 ns; `RESET` is released at 12 ns. `UART_TX_ready` is held at 1. `TRACE` levels: `0` silent, `1` peripherals only, `2` adds the architectural trace. The design's own `$display` output passes through to the console.

The compiled binary is cached against a hash of the simulator, Verilog standard, all sources, the testbench and the checkpoint module, so a re-run, a step or an input change skips `ivlpp` and `ivl`.

**⭳ Download → Testbench (.v)** saves `cg3207_hdl_tb.v`. After a run in HDL mode it bakes that run's inputs in as defaults: the switch, button and accelerometer values at the start, every recorded input change and UART byte at the cycle it arrived, the cycle budget, and `TRACE` level 1. Before any run, or in JS mode, it starts from the current inputs. Plusargs still override every setting, and the checkpoint module is not included. It needs `AA_IROM.mem` and `AA_DMEM.mem` beside it and runs with no arguments:

```
iverilog -o sim *.v cg3207_hdl_tb.v && vvp sim
```

### 5.5 Clock-edge timing

A timestamp in `stim.mem` or `uart_rx.mem` means the input is in force during that cycle, so the instruction of cycle *C* reads an input stamped *C*. The testbench drives it with a nonblocking assignment at the rising edge that starts cycle *C* (it compares the stamp against `cyc + 1`).

`LED_OUT`, `SEVENSEGHEX`, `UART_TX_valid`, `OLED_Write` and `UART_RX_ack` are `output reg` in the Wrapper: a write by the instruction of cycle *C* lands at the edge that ends *C*. They are sampled on the falling edge of cycle *C+1* and reported as cycle *C*, so each effect is attributed to the instruction that caused it. `MemWrite_out` is combinational and is sampled on the rising edge with the instruction record.

Section 11 of `riscv_simulator_tests/test_hdl_mode.js` covers both directions.

### 5.6 Register file discovery

* **Fixed signals.** The PC, the instruction stream and every memory write come from the Wrapper's `PC`, `Instr`, `MemWrite_out`, `ALUResult` and `WriteData_out`, so they work for any core behind it.
* **Discovered register file.** The page looks for a 32-entry array of 32-bit regs under the Wrapper's core instance and shows the result in the *Register file* field (`hdlRegPath`); a path typed there overrides it.

Writes are detected by comparing the array against a shadow copy on every falling edge, so only the array is named; the register file's ports and module name do not matter. The testbench also declares wires `x<n>_<abi>` aliasing each register, because `$dumpvars` does not dump arrays. If the path cannot be resolved, the run is retried without the register view.

### 5.7 UART input

The testbench models the board's single holding register. A byte arrives at its timestamp whether or not the program has read the previous one; if `UART_RX_valid` is still set and the byte is not being acknowledged that cycle, the new byte is discarded and the held one kept. `UART_RX_ack` clears `UART_RX_valid` and is reported as its own event, so the console's RX queue drains when the hardware takes a byte: `RX_VALID` falls on the instruction that reads `0xFFFF0004`, and returns when you step back over it.

A send from the console is placed on the input timeline all at once, starting at the current cycle, with consecutive characters the *Arrival* gap apart (in cycles), and the recording is replayed (§5.11).

### 5.8 Memory images

The Wrapper owns instruction and data memory. It declares an IROM and a DMEM (or reaches ones declared below it), sized by the localparams `IROM_DEPTH_BITS` and `DMEM_DEPTH_BITS`, and loads them with `$readmemh("AA_IROM.mem", ...)` and `$readmemh("AA_DMEM.mem", ...)`. The simulator reads the two depths from the source and writes images of matching size; it never creates the memories or assumes a default size. If the program needs more instruction words than the IROM holds, the console says so.

Images are built from the assembled memory image, so gaps inside a segment keep their addresses. Words past the end of the program are left uninitialised (`X`), as with a short `$readmemh` file in Vivado; the resulting "Not enough words" notice is filtered from the console.

### 5.9 Execution model: record, then scrub

`vvp` cannot be paused mid-run and takes no input while it runs, so Step and Back do not drive the simulator. A run records the simulation as tagged lines on standard output, and Step and Back move through that recording. Stepping is instant, Back works, and because the trace keys on PC changes rather than cycles it stays correct for multi-cycle or pipelined cores.

| Record | Meaning |
|---|---|
| `@@I cyc pc instr` | PC changed (one per instruction) |
| `@@W cyc reg value` | register write |
| `@@M cyc addr MemWrite_out data` | memory write (`ALUResult`, the write strobes, `WriteData_out`) |
| `@@L`, `@@S` | `LED_OUT`, `SEVENSEGHEX` changed |
| `@@T`, `@@O`, `@@A` | UART byte sent, OLED pixel write, UART RX acknowledged |
| `@@B`, `@@P` | OLED buffer swap, read of the swap-pending flag (double-buffered Wrapper only) |
| `@@N`, `@@F` | next instruction to fetch, and final LED / 7-segment / `LED_PC` state, after the last cycle |

Unticking *Record the architectural trace* records peripheral activity only. That saves about 30% of the run time but disables Step, Back, breakpoints and the Registers panel.

### 5.10 Run, Resume and breakpoints

Breakpoints are source lines, found in the recording by mapping each recorded PC back to its line.

* **Run** with no recording records up to *Cycles per Run / Resume* cycles and stops at the first breakpoint, or at the end.
* **Resume** goes to the next breakpoint; a breakpoint already inside the recording is reached without simulating. At the end of the recording, Resume records another *Cycles per Run / Resume* cycles, continuing from the last checkpoint (§5.11) rather than from reset.
* **Reset** (⟲) discards the recording, so the next Run starts from reset. During a run it stops the simulation.

With Icarus, a Run is recorded in chunks of about 300 ms of simulation (`HDL_CHUNK_MS`), each started from the checkpoint at the end of the previous one, and the page follows each chunk as it arrives. Pause and breakpoints take effect between chunks. An input changed during the run is placed on the timeline at the cycle shown, and the recording is replayed from there before the next chunk.

**Statement Stepping** applies: one Step covers every machine instruction the current source line expands to (a `la` pseudo-instruction, or a C statement), and Back covers the same distance in reverse.

*Cycles per Run / Resume* is the size of a fresh recording and of each Resume increment; the page never rewrites it. Its default with Icarus is 200,000 and the maximum recording is 2,000,000 cycles. Stepping past the end of the recording also extends it, growing geometrically. If the PC has stopped advancing (a halt or a self-loop), the console says so.

### 5.11 Changing an input while paused, and checkpoints

Changing a DIP switch, a button or the accelerometer, or sending UART input, while paused timestamps the change at the current cycle and replays the run. The simulation is deterministic, so everything before the change is reproduced exactly and the view returns to the same point with the change in effect. The replay records one *Cycles per Run / Resume* past the change.

**Checkpoints.** Icarus does not implement `$save`, so a second top-level module, `cg3207_hdl_ck`, compiled beside the testbench, saves and restores state:

* Every `+CKEVERY=<n>` cycles, 1 ns after the falling edge, it writes every `reg` of the design and the testbench to `ck_<cycle>.txt`, and every memory that something assigns to `ck_<cycle>_m<i>.mem`, in binary so x and z bits survive.
* `+CKAT=<cycle>` writes one more; the page sets it 17 cycles before the end of each run.
* `+CKLOAD=<cycle>` restores `ck_load.txt` and `ck_load_m<i>.mem` 1 ns into the run, before the first rising edge, and the run continues from that cycle.

The page keeps up to 40 checkpoints (`HDL_CK_KEEP`), 1024 cycles apart to start with (`HDL_CK_EVERY`); the spacing doubles as the recording grows. A replay starts from the latest checkpoint at least 16 cycles (`HDL_CK_VERIFY`) before the first cycle at which the input timeline changed. Extending the recording starts from the checkpoint near its end.

The new run's output is joined onto the old recording at the first cycle where the input timelines differ, or at its end for an extension, so a join costs the same however long the recording is. The new VCD is joined onto the old one, shifted 10 ns per cycle. Both VCDs must hold the same signals, so a recording made with a different *Signals* setting is replayed from reset instead.

The saved state is found by reading the sources (regs, `integer`s, ANSI `output reg` ports, instances, through the hierarchy under the Wrapper), so a design could hold state this misses. Each replay from a checkpoint must therefore reproduce at least the 16 overlapping cycles of the old recording record for record. If it does not, the run is repeated from reset and checkpoints are turned off for those sources. A design with a `generate` loop, an array of instances, a `generate` block that declares regs or instances, or a multi-dimensional memory has no checkpoints, and the console says why. Section 15 of `test_hdl_mode.js` checks that a joined replay from a checkpoint matches the run from reset, waveform included.

`cg3207_hdl_ck` is a separate top level so that `$dumpvars(0, cg3207_hdl_tb)` leaves it out of the waveform.

`test_hdl_mode.js` compiles a processor's RTL (`Wrapper.v`, `RV.v` and its submodules) from the folder named by the environment variable `RVSIM_CORE_DIR`, and skips itself when that is not set.

### 5.12 Cross-checking against the functional model

With **Cross-check against the JS model** ticked, each run is followed by a run of the same program on the JavaScript model, comparing the PC sequence and every register write. The console reports the first instruction where they disagree, with the cycle, PC, instruction word and both values. It is off by default because it costs a second execution. Programs that read UART input can diverge legitimately, because the two engines deliver input on different schedules.

### 5.13 Synthesis lint

Sources are checked on load for constructs that behave differently, or not at all, after synthesis. Findings go to the console with file and line. The lint never blocks a simulation.

| Flagged | Why |
|---|---|
| `#` delay | discarded by synthesis |
| `$display`, `$finish`, `$time`, … | simulation-only; `$readmemh` / `$readmemb` are not flagged, since Vivado uses them for memory initialisation |
| `real`, `time`, `event` | not synthesisable |
| `forever`, `while` | synthesis needs a statically bounded loop |
| `casex` | X-matching does not exist in hardware; use `casez` |
| blocking `=` in a clocked block | races other blocks reading the same signal on that edge (loop headers exempt) |
| `always @(a, b)` on combinational logic | synthesis treats it as `@*`, so an incomplete list is a simulation mismatch |
| `initial` with a delay | simulation-only; a plain `initial` power-up value is fine |

To confirm that the design synthesises and behaves the same afterwards, use post-synthesis simulation (§5.14).

### 5.14 Post-synthesis functional simulation

With **Post-synthesis functional simulation** ticked, each run is simulated twice: once from the RTL, and once from a gate-level netlist produced by Yosys. The first difference is reported.

| Stage | What happens |
|---|---|
| Synthesise | Yosys runs `read_verilog` over the core's files, `chparam -set PC_INIT <base> RV`, `synth -top RV`, `write_verilog -noattr netlist.v` and `stat`. Cell count and warnings go to the console. The netlist is cached against the core sources and the base address. |
| Shim | Synthesis resolves parameters away, so the synthesised top is renamed `RV_synth` and wrapped in a generated `RV #(parameter PC_INIT)` module, keeping the Wrapper's `RV #(.PC_INIT(…)) RV1(…)` valid. |
| Simulate | The netlist is compiled with the loaded `Wrapper.v` and the same generated testbench, and run with the same inputs and cycle budget as the RTL. |
| Compare | The instruction stream, memory writes and peripheral activity of the two runs are compared. |

Only the core is synthesised. The Wrapper stays behavioural, so its `$readmemh` still works and one synthesis serves every program.

* The panels show the RTL run; stepping, Back and the register view are unaffected.
* Register writes are not compared, because synthesis turns the register file into logic and no array remains. The PC, memory writes and peripherals come from the Wrapper and are compared in full.
* The netlist's state lives in cells Yosys named, which the checkpoint module cannot find, so it is simulated only from reset and compared with one RTL run of the same length. A Run is therefore recorded in one go rather than in chunks, and cannot be paused; Reset stops it.
* *Cycles per Run / Resume* is remembered separately while this is on, 50,000 by default.

A divergence usually points to an inferred latch, an incomplete sensitivity list, or a race between blocking assignments.

#### Loading Yosys

Yosys (`@yowasp/yosys`) is fetched from a pinned, immutable jsDelivr URL the first time the option is ticked, about 13 MB over the wire, and cached by the browser. It is never fetched while the option is off. Synthesis takes roughly 20 to 35 seconds and is repeated only when the sources change.

If the CDN cannot be reached, the loader falls back to `vendor/yosys/` beside the page (see [`vendor/README.md`](vendor/README.md)). That copy requires the page to be served over `http://`: the bundle resolves its `.wasm` and resource tar relative to its own URL, and a `file://` fetch is blocked as cross-origin.

### 5.15 Engine sources

The browser engine is three Emscripten modules (`ivlpp`, `ivl`, `vvp`, each a `.js` and a `.wasm`). They are loaded from the first of these locations that answers:

1. `https://cdn.jsdelivr.net/gh/senolgulgonul/verisim@main/`
2. `https://senolgulgonul.github.io/verisim/`
3. `vendor/verisim/`, the copy in the repository (see
   [`vendor/README.md`](vendor/README.md))
4. `verisim/` next to the page, for a copy you supply
   (`ivlpp.js/.wasm`, `ivl.js/.wasm`, `vvp.js/.wasm`)

The local copies work only when the page is served over `http://`: Emscripten fetches its
own `.wasm`, and a `file://` fetch is blocked as cross-origin.

The pipeline follows the native `iverilog` driver:

| Stage | Module | In -> out |
|---|---|---|
| Preprocess | `ivlpp` | all `.v` sources -> one expanded source (shared macro table) |
| Compile | `ivl` | expanded source -> `.vvp` bytecode |
| Run | `vvp` | `.vvp` + plusargs + input files -> stdout + optional VCD |

Files pass between stages through each module's in-memory file system.

Each stage runs in a module worker, created from a script inside the page, which imports the
same `.js` by URL, so a long simulation does not block the page. If a worker cannot start
or cannot load the engine, the stages run on the page and the console says so once. Reset
terminates the worker; the next stage starts a new one.

> **Licensing.** These WASM modules are builds of **Icarus Verilog** and carry the
> **GPL**; see [Licensing note](#licensing) at the end of this document.

In the desktop app the page finds `window.rvNative` with `icarus` set, and `hdlTool()` hands
each stage's files and arguments to the native build instead ([§5.18](#518-the-desktop-app)).
Nothing above `hdlTool()` depends on which engine ran.

### 5.16 Limitations

- **A step is a recording.** Editing a register value by hand has no effect on the RTL.
- **Registers depend on discovery.** A register file that is not a 32-entry array of 32-bit
  regs needs its path entered by hand. When it cannot be reached, the Registers panel says so
  in place of the values. The PC, instructions, memory and peripherals come from the fixed
  Wrapper and are unaffected.
- **Long runs are slow.** In Chrome, with the trace and the waveform on, an RTL core runs at
  about 8,000 cycles a second and the prebuilt gate-level core at 2,000 to 4,000. Native
  Icarus in the desktop app is about 1.7 times faster (§5.18); the time is spent in Icarus
  itself. For millions of cycles use JS mode or Verilator (§5.19).
- **The waveform covers about the last 50,000 cycles** of a longer run (`HDL_VCD_WINDOW`). With
  Icarus it can hold up to 62,500, since the oldest changes are dropped in steps. A full dump of every signal
  is about 1.2 KB per cycle.
- **The first run downloads about 2.7 MB** of WASM, which the browser then caches.
- The page needs a context that allows cross-origin `import()`: serve it over `http://` rather
  than opening it with `file://`, or host the engine locally.

### 5.17 Loading a folder

*folder…*, beside *browse…*, loads every `.v`, `.sv`, `.vh` and `.svh` file in a folder and its
subfolders, keeping only what belongs to the design:

- **Only files under the Wrapper.** Starting from `module Wrapper`, module bodies are scanned for
  instantiations of the other modules found (comments and strings blanked first). A file is
  loaded if it declares any module reached that way. A file that declares no module, and every
  header, is loaded too. Testbenches that instantiate the Wrapper and spare copies of a module
  are left out, and the console lists them; they would otherwise become a second top level.
  With no Wrapper in the folder, everything is loaded and the *no Wrapper* warning shows.
- **No tool output.** Folders whose names start with `.`, `node_modules`, `xsim.dir`, and any
  ending in `.cache`, `.runs`, `.sim`, `.hw`, `.ip_user_files` or `.gen` are skipped. They hold
  Vivado's generated copies (`*_stub.v`, simulation netlists).
- **Two files declaring one module** are both loaded and named in a warning. Compilation fails
  until one is removed with × (which also keeps it out of later reads) or deleted.
- **Names.** Files are listed and reported by base name. Two files with the same base name in
  different subfolders take their relative path, with `/` replaced by `__`.
- At most 500 files are read (`HDL_FOLDER_MAX`).

**Re-reading.** The folder is read again whenever the window regains focus and before each run
from reset (the Run after Reset, or the first Step), so an edit saved in an external editor is
picked up. If any file changed, appeared or disappeared, the folder's files are replaced, the
console lists the changes, and the existing recording is discarded. Files added by hand stay,
and take precedence over a folder file of the same name. If the folder cannot be read,
the loaded files are left as they were.

**Disk access**, in order of preference:

| Where | How | Remembered | Re-read |
|---|---|---|---|
| Desktop app | `rvNative.pickFolder()` / `readFolder()`; the main process reads only a folder the user chose | across restarts, in the app's `settings.json` | yes |
| Chromium browsers | `showDirectoryPicker()`; the handle is kept in IndexedDB (`rvsim` / `kv` / `hdlFolder`) | across reloads; a later visit may need permission again, and the button then reads *↻ name* | yes |
| Firefox, Safari | `<input webkitdirectory>` | no | no: the browser supplies a copy, so the folder must be picked again after editing |

*Clear files* and *Prebuilt processor* forget the folder.

### 5.18 The desktop app

[`electron/`](electron/README.md) packages the page with Electron and a native build of
Icarus Verilog for each platform (Linux AppImage, Windows NSIS installer, macOS dmg for arm64
and x64). The page is the same file, served from the app's resources over an `app://`
scheme, since a `file://` page cannot fetch its own `.wasm` or examples. It behaves as in a
browser, with these differences:

- **Icarus runs natively.** `electron/hdl_native.js` writes the files a stage would have had in
  the Emscripten file system into a temporary directory, rewrites `ivl.conf` to point at the
  bundled `vvp.tgt` and VPI modules, runs `ivlpp`, `ivl` or `vvp` there with the same
  arguments, and returns the output and the files the page asked to keep. Reset kills the
  process. The native build is pinned to the same Icarus commit as the WASM engine (`c7530db`,
  14.0-devel). `test_hdl_native.js` checks that both record the same instructions, the same
  waveform and the same checkpoint replay; it reads the RTL from the folder named by
  `RVSIM_CORE_DIR` and skips itself when that is not set.
- **Speed.** 40,000 cycles of a DIP-switch-to-LED program on an RTL core, with trace, VCD and
  checkpoints on: preprocess and compile 40 ms native against 180 ms in WASM, simulation 5.2 s
  against 8.6 s; replaying an input change near the end, 0.65 s. With all three off, native
  `vvp` runs about 18,000 cycles a second: the cost is Icarus's event-driven evaluation.
- **Offline.** Local copies of CodeMirror, Icarus and Yosys are tried before the CDN.
- **The bridge** (`electron/preload.js`, `window.rvNative`) is the page's only access to the
  machine: run one of the three Icarus tools in a fresh temporary directory, pick a folder, and
  read a folder the user picked. The page has no Node access (`contextIsolation`, `sandbox`),
  and links open in the system browser.
- **No menu bar** on Windows and Linux. macOS keeps the standard menu, which copy and paste
  depend on.
- **Verilator** can be chosen instead of Icarus ([§5.19](#519-verilator-desktop-app)).

Building, packaging and signing are described in [`electron/README.md`](electron/README.md).

### 5.19 Verilator (desktop app)

*Simulator* (Settings → Simulation) chooses Icarus Verilog or Verilator. In the browser the
setting is shown disabled, with a tooltip saying it needs the desktop app. The choice is kept
in `localStorage`.

Verilator 5.054, built by `electron/scripts/build-verilator.sh`, translates the sources and the
same generated testbench to C++ (`--cc --exe --main --timing --trace`, `-Wno-fatal`, lint and
style warnings off). `electron/verilator_native.js` compiles the result with `-O3` in parallel and
links a model, which takes the same plusargs and files as `vvp`. The trace, stepping,
peripherals, input changes and the waveform work as with Icarus.

| DIP-switch-to-LED program on an RTL core, through the page | Icarus (native) | Verilator |
|---|---|---|
| Build | 0.05 s | 3.6 s after a source edit; 11 s the first time (its runtime) |
| 200,000 cycles, waveform on | 27.4 s | 1.6 s |
| 200,000 cycles, waveform off | 19.5 s | 1.0 s |

Differences from Icarus:

- **Two-state.** What Icarus shows as `x` (a register never written, an output never driven) is
  0, and the console says so on the first build. Instruction, register and memory records
  otherwise match Icarus; `test_verilator.js` checks 40,000 cycles, reading the RTL from
  `RVSIM_CORE_DIR` and skipping itself when that is not set.
- **Builds are cached** by content (sources, testbench, language, Verilator version, compiler) in
  the app's data folder; the last 8 are kept (`KEEP_MODELS`). Changing the program, Reset and
  input changes reuse the model. Verilator's runtime is compiled once per compiler.
- **Checkpoints** come from the same reading of the sources as Icarus's (§5.11), but use a
  different module. Verilator builds one top level, so the testbench instantiates the
  checkpoint module (`cg3207_ck`, kept out of the waveform by `/* verilator tracing_off */`). It
  holds only the regs assigned in a clocked `always` block or a task, since the rest are
  recomputed. Every `HDL_VL_CK_EVERY` (200,000) cycles, except at a run's last cycle, it writes
  the state to slot `ck_s0` or `ck_s1` in turn (`ck_s<n>.txt` for regs, `ck_s<n>_m<i>.mem` for
  memories). A run of any length therefore leaves its two newest checkpoints, and the recording
  keeps the two newest across all the runs it was joined from (`t.vlCks`). The cycle each holds
  is the testbench's `cyc`, saved with the rest.
  - Neither block may wait or be clocked: a delay such as `#1` makes it a run-time-scheduled
    process, and writing the design's regs on a clock edge forces extra evaluation every edge;
    either costs about a fifth of the model's speed. The restore is a plain `initial` block,
    which Verilator runs after the design's own, and the save runs when a flag set at the
    falling edge rises. The module costs under 1% of run time.
  - A design whose `initial` blocks assign with `<=` overrides the restore; Verilator reports
    this as MULTIDRIVEN.
  - A run from a checkpoint prints its records from the checkpoint (`+TRACEFROM`). What falls
    before the join point is compared, record by record at each record's own cycle, against the
    recording. A mismatch reruns from reset and turns checkpoints off for those sources, as with
    Icarus.
- **Post-synthesis simulation is hidden** while Verilator is selected. It compares the RTL run
  against an Icarus run of the netlist, and two-state against four-state results would differ
  at every `x`.
- **Signals: Wrapper only** cannot use a `$dumpvars` depth, which Verilator ignores, or
  `--trace-depth`, since inlining places everything under the Wrapper at one level. Instead a
  config file passed with the build, `tracing_off -scope "cg3207_hdl_tb.dut.*.*"`, keeps the
  testbench's and the Wrapper's own signals and drops the rest (8.4 MB against 22.1 MB for
  40,000 cycles). This setting builds a second cached model.
- **Messages.** Warnings are counted by kind with the first of each shown
  (`Verilator COMBDLY ×2: …`); errors are listed with file, line and column. The status line
  reports each build step, and Reset kills the build.

**Live runs.** With Verilator, Run is live: the model keeps running until Pause, a breakpoint or
*Cycles per Run / Resume* is reached (default 20,000,000 for Verilator and 200,000 for Icarus,
each remembered separately). Switches, buttons, the accelerometer and typed UART input take
effect while it runs.

- A C++ helper compiled into every model (`cg3207_live_poll`, called through DPI from a
  `` `ifdef VERILATOR `` block of the testbench at every rising edge) reads commands from stdin. It
  drives an input change at the edge, so it is in force from the next cycle exactly as a
  `stim.mem` entry would be, and reports it (`@@V`, `@@U`) with that cycle. Back, replays and the waveform
  therefore see the same input timeline as if the inputs had been present from the start.
- The helper flushes output every 30 ms, with a `@@C <cycle>` record so the page knows the run's
  progress even when nothing else is printed. The app passes output on every 50 ms, and the page
  follows the recording every 100 ms with a forward-only seek.
- Without the architectural trace there are no instructions to follow; the page applies
  peripheral events as they arrive and folds them into a state snapshot past 100,000
  (`HDL_LIVE_PRE_KEEP`).
- *Real time* paces the model itself to the clock (2,275 cycles in 1.5 s at 1.53 kHz). At full
  speed the page takes in about 285,000 cycles a second live (5,000,000 cycles in 17.5 s).
- The helper reads stdin with `read(2)` rather than stdio, so that no thread blocked on input holds
  stdin's lock when `exit()` flushes every stream after the testbench calls `$finish`.
- The DPI import is SystemVerilog, so it is wrapped in `` `begin_keywords "1800-2017" ``. The design
  itself is parsed as the selected Verilog standard.

**Resume and input changes.** Resume, with or without the architectural trace, restarts the model
with the inputs recorded so far, from the newest checkpoint at least 16 cycles (`HDL_CK_VERIFY`)
before the recording's end, and before the waveform window when the waveform is followed live. It passes
`+LIVEFROM` at that end: no input is taken before that cycle, the replay runs at full speed,
and the records that follow are held back until the stretch before the join point has been
checked, then joined onto the recording. Changing an input while paused does the same from the
first cycle at which the input timelines differ. The waveform built on Pause is replayed from the
newest checkpoint before its window, with times shifted by 10 ns per cycle of the checkpoint.
With no checkpoint early enough, these replay from reset (3.1 s near the end of a
5,000,000-cycle run).

**Recording length.** There is no cycle cap. The recording keeps the last 2,000,000 cycles
(`HDL_VL_KEEP`). Once it is a quarter over that, the instructions before it are folded into a
snapshot of the state they leave (registers, data memory, peripherals, both OLED pages, UART
output), and seeks start there. The instruction count still counts from reset, and Back stops at
the start of what is kept. The cross-check against the JS model, which runs from reset, is not
offered once a recording has been trimmed.

**Waveform.** *Built* (shown with Verilator) offers *On Pause*, which replays the run with the
dump on once it stops, and *While running*, which dumps as it goes while the page re-reads the
dump twice a second; the latter is useful at a slow *Real time* clock. Either way the waveform
covers at most the last 50,000 cycles (`+VCDFROM`), which also applies to ordinary Verilator runs.
A followed waveform that passes 20 MB (`HDL_LIVE_VCD_MAX`) is stopped: the page sends the model
input code 8, the testbench calls `$dumpoff`, the console says so, and the waveform is built for
the last 50,000 cycles when the run stops.

**The C++ compiler.** The app uses `CXX`, then `g++`, then `clang++` (on macOS only when
`xcode-select -p` finds the command line tools, since probing `clang++` without them opens Apple's
installer). Each is checked by compiling a C++20 coroutine. If none works, Zig 0.17.1 is
downloaded from ziglang.org into the data folder, its SHA-256 checked, and `zig c++` used: about
57 MB (100 MB on Windows), about 400 MB unpacked, plus Zig's own cache. Zig's first compile builds its C++
library (about 30 s, once), so a first build from nothing takes about 45 s and later ones about
5 s. Offline, the build fails with a message naming the alternatives and the next build retries.
Zig is not bundled with any installer.

---

## 6. Settings

The **Settings** button opens a modal with three tabs: Compiler, Linker and Simulation.

```
+--------------------------------------------------------------------------------------------+
| Settings & Configuration                                                               [x] |
+--------------------------------------------------------------------------------------------+
| [ Compiler ]  [ Linker ]  [ Simulation ]                                                   |
+--------------------------------------------------------------------------------------------+
| Compiler:  RISC-V 32-bit Compiler [ Clang 20.1.0 | Clang trunk | GCC 14.2.0 | GCC trunk ]  |
|            Optimization Level [ -O0 | -O1 | -O2 | -Os | -O3 ]                              |
|              (note on code size)  > Making sure it still fits the hardware                 |
|            Architecture & ABI Flags [ -march=rv32i -mabi=ilp32 ]  [ ] Include M extension  |
+--------------------------------------------------------------------------------------------+
| Linker:    The segment sizes should not exceed the memory size provisioned in hardware.    |
|            Code (.text) base [ 0x400000 ]     size [ 0x200 ]                               |
|            Data (.data) base [ 0x10010000 ]   size [ 0x200 ]                               |
|            Stack top (sp)    [ 0x10010200 ]   MMIO base [ 0xFFFF0000 ]                     |
+--------------------------------------------------------------------------------------------+
| Simulation:                                                                                |
|  BOTH ENGINES       [x] Statement Stepping (Fast Mode)                                     |
|                     Clock  CLK_DIV_BITS [ 5 ] 3.13 MHz  [ Max speed | Real time ]          |
|  JAVASCRIPT MODEL   Microarchitecture [ Single-cycle | Multi-cycle | 5-stage pipeline ]    |
|   (JS mode only)    hazard and branch-prediction options; cycles per instruction category  |
|                     Max Instructions Per Run [ 100000000 ]                                 |
|  PROCESSOR SOURCES  drop .v files / browse... / folder...   [Wrapper.v] [RV.v] ...         |
|   (HDL mode only)   [ Prebuilt processor ] [ Clear files ]                                 |
|  SIMULATION         Simulator [ Icarus Verilog | Verilator ]                               |
|                     Cycles per Run / Resume [ 200000 ]                                     |
|  RECORDING & OUTPUT Detail [ Full | Balanced | Fastest | Custom ]                          |
|                     [x] Record the architectural trace                                     |
|                     [x] Record a waveform  Signals [ All | Wrapper only ]                   |
|                                            Built [ On Pause | While running ] (Verilator)  |
|                     Verilog standard [ Verilog-2005 | 2001 | 1995 | SystemVerilog ]        |
|                     [ ] Cross-check against the JS model                                   |
|                     [ ] Post-synthesis functional simulation (Icarus)                      |
|  REGISTER FILE      [ dut.RV1.RegFile1.RegBank ]  detected automatically                   |
+--------------------------------------------------------------------------------------------+
| [ Reset Defaults ]                                                        [ Apply & Close ] |
+--------------------------------------------------------------------------------------------+
```

The Simulation tab shows *Both engines* and the active engine's groups only
(`refreshSimSettingsScope()`). *Signals* and *Built* show only with the waveform on, *Built* only
with Verilator, and *Post-synthesis functional simulation* only with Icarus.

**Detail** (in the header of *Recording & output*) sets the options that cost run time, all in
that group:

| Option | Cost when on | Lost when off | Full | Balanced | Fastest |
|---|---|---|---|---|---|
| Waveform | about 30% of the run time | the waveform and the VCD download | on | on | off |
| Signals: All rather than Wrapper only | about 25% more | signals inside `RV` | All | Wrapper only | (no waveform) |
| Waveform built while running (Verilator) | a re-read twice a second | the waveform during the run | While running | On Pause | (no waveform) |
| Architectural trace | about 30% (Icarus) | Step, Back, breakpoints and the Registers panel | on | on | off |
| Cross-check against the JS model | a second run of the program | the cross-check | off | off | off |
| Post-synthesis simulation | 20 to 35 s to synthesise, then a run 2 to 4 times slower | the netlist check | off | off | off |

Each option can still be changed individually; the selector then reads *Custom*. With the
waveform off, its two sub-settings are not compared. Choosing a preset lists its changes in the
console. *Full* is the default, so with Verilator a live run's waveform is followed by default
(subject to the 20 MB limit in §5.19).

**Signals: Wrapper only** passes `+VCDTOP`. The testbench then calls
`$dumpvars(1, cg3207_hdl_tb)` and `$dumpvars(1, cg3207_hdl_tb.dut)` instead of
`$dumpvars(0, cg3207_hdl_tb)`: the testbench's nets (CLK, RESET, the peripherals, the
`x<n>_<abi>` register aliases) and the Wrapper's own signals (PC, Instr, MemWrite_out, …), and
nothing inside `RV`. Every default waveform row is in that set. For 40,000 cycles on an RTL core
the VCD is 9.7 MB instead of 47.8 MB.

**Post-synthesis simulation** defaults *Cycles per Run* to 50,000 while it is on. A Run is
simulated in one go and cannot be paused (Reset stops it); an input changed meanwhile takes
effect where the run ends. Yosys (about 13 MB) is downloaded the first time the option is ticked.

**Apply & Close** reloads the program only when the memory layout changed.

**Compiler tab.** Changing the compiler, the optimisation level, the M-extension toggle or the
architecture flags clears the compiled program, since it does not match the settings shown;
compile again to continue.

- The optimisation level changes code size several-fold (`-O0` and `-O3` are usually the
  largest, `-Os` the smallest). The program must fit **Code (.text) size** on the Linker tab,
  which must match `IROM_DEPTH_BITS` in the Wrapper on the FPGA; raising only the linker setting
  builds here and truncates silently on hardware.
- The **M extension is off by default**. With it off, a `*` or `%` in C becomes a call to a
  libgcc helper such as `__mulsi3`, which is not part of the program and cannot be resolved.
  The simulator reports this at compile time, as soon as the helper appears in the assembly
  (`LIBGCC_HELPER_RE`). The message names both remedies: **Include M extension**, or a higher
  optimisation level, which often replaces a multiply or divide by a constant with shifts and
  adds.

**Reset Defaults** resets the current tab only (`resetCurrentSettingsTab()`). On the Compiler tab it
restores Clang 20.1.0, `-O0` and RV32I, clearing the compiled program if anything changed. On the
Linker tab it fills in the default layout, which takes effect on Apply. On the Simulation tab in
HDL mode it restores the cycle counts, Verilog-2005, automatic register-file detection, Icarus
and *Full*, and keeps the loaded sources; *Clear files* removes those.

---

## 7. Memory model and segment mapping

### 7.1 Segments and the Memory view

Default layout (all configurable in Settings → Linker):

| Segment | Base | Default size |
|---|---|---|
| Text (`.text`) | `0x00400000` | `codeSize` = `0x200` (512 B, 128 instructions) |
| Data (`.data`) | `0x10010000` | `dataSize` = `0x200` (512 B) |
| Stack | top = `dataBase + dataSize` (`0x10010200`), grows down | — |
| MMIO | `0xFFFF0000` | §7.2 |

Selecting an example sets the Text and Data sizes from its `IROM`/`DMEM` depth bits (§9).

- **Size checks.** If the assembled code exceeds `codeSize`, a warning names the overflow in bytes and instructions; the instructions past the limit are not loaded. If the data exceeds `dataSize` (assembly only), a warning is logged. Both warnings name the matching Wrapper parameter (`IROM_DEPTH_BITS`, `DMEM_DEPTH_BITS`) for HDL mode.
- **Toolbar.** `Addr` (hex start address), region sub-tabs `[ Text | Data | Stack | MMIO ]`, a refresh button, `Rows` (default 64, max 128), and a `[ Byte | Word ]` toggle. The toolbar row also carries the legend.
- **Rows.** One row is always one 32-bit word in both modes, so when a narrow panel wraps, a word's Content cell can only drop below its own Hex cell.
  - **Word** (default): each word is one 8-digit hex value; legend `Full word (LSB to the right)`. The Content column is decimal, with a signed/unsigned switch.
  - **Byte**: four separately editable bytes in memory order; legend `Little endian (LSB to the left)`. The Content column is ASCII. A single click edits a byte, a double click edits the word.
- **Colours.** Bytes written at runtime are yellow (`#ffe08f`). The endianness hint is cyan (`#00ffff`), the `Editable` marker blue (`#89b4fa`), and labels orange (`#fab387`, the editor's label colour).
- **Labels.** Any code or data label whose address falls in a row is drawn above that word with a trailing colon (`main:` above `0x00400000`). Several labels in one word are comma-separated and wrap within the column, so the Hex and Content columns stay aligned. A label that is not word-aligned shows its exact byte address as a tooltip (`Symbol at 0x10010002`). In the MMIO tab each register shows its name and access type instead (`DIP (RO):`). Both use `.mem-row-label` inside `.mem-row-label-anchor`. Label and register names are searchable through the panel's row filter.
- **Editability.** Text is read-only. Data and Stack are editable at byte and word level. MMIO is editable per register (§7.3).
- **Stack tab.** Addresses run downward from the stack top, one word per row (`0x10010200`, `0x100101FC`, ...).
- **Memory images.** The toolbar's **Download** menu saves `AA_IROM.mem` (text) and `AA_DMEM.mem` (data), alongside the generated testbench and the waveform. Each file has one 8-digit uppercase hex word per line, little-endian, with a `// @<ADDR>` comment at the start and at every address gap, for `$readmemh`.

### 7.2 MMIO address map

The Memory view's MMIO tab labels each register with its name and access type, without the address. A register marked `RO` is not editable there, except `UART_RX` (§7.3).

| Address | Access | Symbol | Behaviour |
|---|---|---|---|
| `0xFFFF0000` | RO | `UART_RX_VALID` | Bit 0 = 1 while a received byte is held in `UART_RX`. |
| `0xFFFF0004` | RO | `UART_RX` | Returns the held byte and clears `UART_RX_VALID`. Returns 0 and consumes nothing when no byte is held. |
| `0xFFFF0008` | RO | `UART_TX_READY` | Always 1. |
| `0xFFFF000C` | WO | `UART_TX` | Writes the low 8 bits to the UART terminal. |
| `0xFFFF0020` | WO | `OLED_COL` | Column index, 7 bits stored (§8.1). |
| `0xFFFF0024` | WO | `OLED_ROW` | Row index, 6 bits stored. |
| `0xFFFF0028` | WO | `OLED_DATA` | Pixel colour (§8.1). |
| `0xFFFF002C` | WO | `OLED_CTRL` | Bits `[3:0]` trigger mode, bits `[7:4]` colour format; a write with bit 3 set presents the frame. |
| `0xFFFF0030` | RO | `OLED_STATUS` | Bit 0 = swap pending. Always 0 in the simulator (§8.1). |
| `0xFFFF0040` | RO | `ACCEL_DATA` | `[31:24]` temperature, `[23:16]` X, `[15:8]` Y, `[7:0]` Z. |
| `0xFFFF0044` | RO | `ACCEL_DREADY` | Bit 0 = 1 when a reading is available. |
| `0xFFFF0060` | WO | `PERIPH_LED` | User LEDs `LED[7:0]`. Only a word write or a byte write to offset 0 takes effect. |
| `0xFFFF0064` | RO | `PERIPH_DIP` | 16 DIP switches `SW15`..`SW0`. |
| `0xFFFF0068` | RO | `PERIPH_PB` | Push buttons: bit 2 = BTNL, bit 1 = BTNC, bit 0 = BTNR. |
| `0xFFFF0080` | WO | `PERIPH_SEVENSEG` | 32-bit value shown as 8 hex digits; a byte write replaces that byte. |
| `0xFFFF00A0` | RO | `CYCLECOUNT` | Clock cycles since reset (`totalCycles`). |

The OLED, LED and 7-segment registers read back the last value written, so the Memory view has something to show; `UART_TX` reads 0.

### 7.3 Read-only registers

A write to a read-only register, from a program or from the Memory view, has no effect, as on the hardware. `UART_RX` is the exception: writing it queues a byte for reception, as a way to feed input. `MMIO_REGISTERS` in `riscv_simulator.html` is the single definition of each register's address, name, access, read and write behaviour; the Memory view's editability, `handleMMIOWrite()`'s write gate and the Peripherals panel all read from it. `editable` defaults to `access !== 'RO'` and is overridden only for `UART_RX`.

---


## 8. Peripherals

The Peripherals panel models a Nexys 4 / 4 DDR / A7 board with a Pmod OLED. Its foldable sections, top to bottom:

- **LEDs and DIP switches.** `LED[15:9]` show `PC[8:2]`. `LED[8]` is the divided clock: lit when nothing runs; during a run it blinks at the clock's own rate when *Real time* pacing sets a clock of 8 Hz or less, and otherwise flickers every 125 ms. `LED[7:0]` are driven by `PERIPH_LED`. Sixteen clickable DIP switches feed `PERIPH_DIP`.
- **Push buttons** BTNL, BTNC, BTNR: click to toggle, or hold J, K or L. **7-segment display**: 8 hex digits.
- **Cycle counter**: `CYCLECOUNT`.
- **UART console** (§8.3), **accelerometer** (§8.2), **OLED** (§8.1).

Each section title shows the register addresses; status bits (`RX_VALID`, `TX_READY`, `DREADY`, `SWAP PENDING`) appear as badges in the titles.

### 8.1 OLED display (`0xFFFF0020`–`0xFFFF0030`)

- **Resolution**: 96 columns × 64 rows, drawn on a 96×64 canvas scaled to 192×128 px.
- **Colour format** (`OLED_CTRL[7:4]`). Narrow components are left-aligned and zero-filled, not scaled (3-bit red `0b111` becomes `0xE0`). Each format requires certain byte lanes; an access that does not cover them still paints the pixel, with the previous colour.

  | Value | Format | Required byte lanes |
  |---|---|---|
  | `0x0` | 8-bit, 3R-3G-2B | byte 0 |
  | `0x1` | 16-bit, 5R-6G-5B (RGB565) | bytes 0 and 1 |
  | `0x2` | 24-bit, 8R-8G-8B | any of bytes 0–2; each covered lane updates that component |

  The colour is resolved when `OLED_DATA` is written, so a later format change does not retint it.
- **Trigger modes** (`OLED_CTRL[3:0]`):

  | Value | Name | What paints a pixel |
  |---|---|---|
  | `0x0` | `vary_pixel_data` | A write to `OLED_DATA` paints at (`OLED_COL`, `OLED_ROW`). |
  | `0x1` | `vary_col` | A write to `OLED_COL` paints the stored colour at the new column. |
  | `0x2` | `vary_row` | A write to `OLED_ROW` paints the stored colour at the new row. |
  | `0x4` | `autoadvance_col` | A write to `OLED_DATA` paints, advancing the column first (row-major; after column 95 it wraps to column 0 of the next row). |
  | `0x5` | `autoadvance_row` | As `0x4`, column-major (after row 63 it wraps to row 0 of the next column). |

  In both auto-advance modes the first data write after a mode change or a write to `OLED_COL`/`OLED_ROW` paints at the position set, and the registers are left on the last pixel drawn. A frame is redrawn by setting both to 0 and streaming it again.
- **Column folding.** `OLED_COL` stores 7 bits. The panel does not wrap columns 96..127; it folds them onto 32..63, as the Pmod controller's addressing does. The auto-advance arithmetic uses the raw 7-bit value.
- **Double buffering.** `OLED_CTRL` is written only when an access covers byte 0. A write with bit 3 set presents the frame and its other bits are ignored; a write with bit 3 clear sets the mode and format. Both pages start as page 0, so a program that never presents draws straight to the screen (`Single buffered · writes appear at once`). The first present splits the pages; each present swaps them and copies the shown page into the new back page, so a program only redraws the pixels that change. The panel shows `Double buffered · showing page N, drawing into page M`.
- **Present timing.** The simulator models no scanout: a present lands at once and `OLED_STATUS` always reads 0. On the board a present waits up to one frame (15.73 ms) for the scanout boundary, then takes 12,288 clocks to copy the page back; pixels written before the boundary appear in the frame being presented, and pixels written during the copy are lost. The first pixel written after a present with no read of `OLED_STATUS` in between logs one warning per run, with both delays converted to cycles at the current clock. Edits typed into the Memory view do not trigger it.
- **Clear Display** blanks the frame buffer.

### 8.2 Accelerometer and temperature sensor (`0xFFFF0040`–`0xFFFF0044`)

`ACCEL_DATA` packs four 8-bit signed fields:

| Bits | Field | Range | Default |
|---|---|---|---|
| `[31:24]` | Temperature | −40..+85 °C | 25 (`0x19`) |
| `[23:16]` | X | −128..127 (±2 g, 64 = 1 g) | 0 |
| `[15:8]` | Y | −128..127 | 0 |
| `[7:0]` | Z | −128..127 | 64 (`0x40`, +1 g) |

- Sliders set each field and show its value in hex and in g. Holding X, Y, Z or T and pressing `,` or `.` changes that field by −5 or +5, clamped to its range.
- Presets: **Flat** (Z = 64, X = Y = 0), **Tilt X** and **Tilt Y** (that axis to −64 with the others 0; a second click flips it to +64, and so on), **Shake** (X = 127, Y = −128, Z = 127), **Zero All**.

### 8.3 UART console (`0xFFFF0000`–`0xFFFF000C`, 115200 8N1)

- **Receive model.** The FPGA side has a single holding register (`uartRxByte`/`uartRxFull`) and no FIFO. Sent bytes wait in the PC-side buffer (`uartPending`, shown as *RX Queue*) and are delivered one at a time. A byte that arrives while the register is still full is dropped and the held byte kept, as on the board, where this is silent; the console reports the number of bytes lost.
- **Arrival** sets the delivery pace:
  - *Paste (baud rate)*, the default: one character per 8640 clocks of the 100 MHz UART clock, converted to CPU cycles at the current clock divider (270 cycles at `CLK_DIV_BITS` 5).
  - *Typed (slow)*: the gap entered in the cycles/char box.
  - *Forgiving (never drops)*: a byte is delivered only after the program has read the previous one. The board does not behave this way; the mode is for debugging logic rather than timing.
- **ASCII input** accepts escapes such as `\r`, `\n`, `\t` and `\xHH`.
- **Hex input** takes comma-separated bytes, with or without a `0x` prefix or a trailing `h` (`0x48, 0x69, 0x0D`, `48, 69, 0D`, `69h`). Tokens that are not one or two hex digits are skipped. In Hex mode the terminal shows transmitted bytes as `0xHH`; switching back to ASCII re-renders the same bytes as text.
- While a send is in progress, **Send** becomes **Cancel** and the status shows progress (`Sending: 3/10`).
- The input field uses `autocomplete="off"`, `autocapitalize="off"`, `spellcheck="false"` and `enterkeyhint="send"`. Global shortcuts are ignored while any form field has focus, so an on-screen keyboard stays open.

---


## 9. Example programs

There are 13 examples, 7 in assembly and 6 in C. `dip_led` and `dip_led_c` are baked into `riscv_simulator.html`; the rest are fetched from `examples/asm/` or `examples/c/` when selected, which requires the page to be served over `http://`.

The **Example** menu is built at startup from `examples/index.txt` by `loadExampleIndex()`. The file is plain text so that static site generators serve it verbatim. Its table has one row per example:

```
| Key | Lang | Label | File | IROM | DMEM | Description |
```

`Lang` is `asm` or `c`. `IROM` and `DMEM` are the `IROM_DEPTH_BITS`/`DMEM_DEPTH_BITS` the program needs (memory of `2**bits` bytes; default 9). Selecting an example sets the Linker segment sizes from them, and HDL mode refuses a program that does not fit the loaded `Wrapper.v`. Rows before the first all-dashes row are treated as headers. The parsed table fills `EXAMPLE_MENU`, `EXAMPLE_FILENAMES` and `EXAMPLE_DEPTHS`. Adding an example is a row in the index plus the source file; `riscv_simulator.html` does not change unless a baked example changes, in which case its baked copy must be updated to match. The menu layout assumes up to 15 rows per language. Until the index loads (permanently, over `file://`), the menu holds only the baked example for each language.

### 9.1 C examples

| Key | File | Description |
|---|---|---|
| `dip_led_c` | `DIP_to_LED.c` | Mirrors the DIP switches onto the LEDs with a short polling delay. Baked in. |
| `fibonacci_c` | `fibonacci.c` | Iterative Fibonacci series stored in an array. |
| `hello_world_c` | `HelloWorld.c` | UART command echo with a greeting, in one loop with one state variable and no function calls, like `HelloWorld.asm`. |
| `hello_jal_c` | `HelloWorld_jal_jalr.c` | The same echo loop; the greeting is printed by `print_string(const char *s)`, which takes the string as a parameter the way `PRINT_S` takes it in `a0`. |
| `circle_accel_c` | `Circle_delay_accel.c` | Midpoint circle on the OLED, moved by accelerometer X/Y tilt; frame count on the 7-segment display; UART messages. |
| `image_display_c` | `ImageDisplay_autoadvance_accel.c` | Draws one of two 96×64 8-bit bitmaps (`Uphill.png`, `Downhill.png`) with `autoadvance_row`, chosen by X tilt; status messages on the UART. |

### 9.2 Assembly examples

| Key | File | Description |
|---|---|---|
| `dip_led` | `DIP_to_LED.asm` | Copies the DIP switches to the LEDs in a loop. Baked in. |
| `rars_syscalls` | `rars_syscalls.asm` | RARS `ecall` services: print string, integer, hex, char, exit. |
| `fib` | `fibonacci.asm` | Fibonacci numbers in `x1`–`x5`. |
| `hello_world` | `HelloWorld.asm` | Prints "Hello World" over the UART character by character. |
| `hello_jal` | `HelloWorld_jal_jalr.asm` | UART printing through a subroutine using `jal` and `jalr`. |
| `circle_accel` | `Circle_delay_accel.asm` | Assembly version of the OLED circle and accelerometer example. |
| `image_display_accel` | `ImageDisplay_autoadvance_accel.asm` | Assembly version of the 96×64 image display with auto-advance mode 5 and tilt detection. |

`DIP_to_LED` and `HelloWorld` serve as smoke tests for HDL mode: in a few hundred cycles they exercise a DIP read, an LED write and the full UART handshake against the RTL.

---


## 10. Processor state, instruction set and syscalls

### 10.1 Registers

32 integer registers `x0`–`x31`, 32 floating-point registers `f0`–`f31`, and `PC`. `x0` always reads 0. All integer registers, including `sp` (`x2`), are 0 after reset, as on hardware. The *Stack top (sp)* setting in Settings → Linker (default `dataBase + dataSize`) sets where the Stack tab starts.

```
+-----+----------+-------------------+-------------------+
|  #  | ABI Name |   Content (Hex)   |   Content (Dec)   |
+-----+----------+-------------------+-------------------+
| x0  |   zero   |     00000000      |         0         |
| x2  |    sp    |     00000000      |         0         |
| ... |   ...    |        ...        |        ...        |
+-----+----------+-------------------+-------------------+
```

Content (Hex) has no `0x` prefix, since the header says it is hex; the Memory view's `Addr` column keeps `0x`. Content (Dec) has a signed/unsigned switch.

### 10.2 Supported instructions

- **RV32I**: `add`, `sub`, `and`, `or`, `xor`, `sll`, `srl`, `sra`, `slt`, `sltu`, `addi`, `andi`, `ori`, `xori`, `slli`, `srli`, `srai`, `slti`, `sltiu`, `lui`, `auipc`, `lw`, `lh`, `lhu`, `lb`, `lbu`, `sw`, `sh`, `sb`, `beq`, `bne`, `blt`, `bge`, `bltu`, `bgeu`, `jal`, `jalr`, `fence`, `ecall`, `ebreak`.
- **M**: `mul`, `mulh`, `mulhsu`, `mulhu`, `div`, `divu`, `rem`, `remu`.
- **A**: `lr.w`, `sc.w`, `amoswap.w`, `amoadd.w`, `amoxor.w`, `amoand.w`, `amoor.w`, `amomin.w`, `amomax.w`, `amominu.w`, `amomaxu.w`.
- **F**: `flw`, `fsw`, `fmadd.s`, `fmsub.s`, `fnmsub.s`, `fnmadd.s`, `fadd.s`, `fsub.s`, `fmul.s`, `fdiv.s`, `fsqrt.s`, `fsgnj.s`, `fsgnjn.s`, `fsgnjx.s`, `fmin.s`, `fmax.s`, `fcvt.w.s`, `fcvt.wu.s`, `fcvt.s.w`, `fcvt.s.wu`, `fmv.x.w`, `fmv.w.x`, `feq.s`, `flt.s`, `fle.s`, `fclass.s`.
- **D**: `fld`, `fsd`, `fmadd.d`, `fmsub.d`, `fnmsub.d`, `fnmadd.d`, `fadd.d`, `fsub.d`, `fmul.d`, `fdiv.d`, `fsqrt.d`, `fsgnj.d`, `fsgnjn.d`, `fsgnjx.d`, `fmin.d`, `fmax.d`, `fcvt.s.d`, `fcvt.d.s`, `fcvt.w.d`, `fcvt.wu.d`, `fcvt.d.w`, `fcvt.d.wu`, `feq.d`, `flt.d`, `fle.d`, `fclass.d`.
- **Pseudo-instructions**: `li`, `la`, `lla`, `lga`, `mv`, `not`, `neg`, `nop`, `j`, `jr`, `ret`, `call`, `tail`, `beqz`, `bnez`, `blez`, `bgez`, `bltz`, `bgtz`, `bgt`, `ble`, `bgtu`, `bleu`, `seqz`, `snez`, `sltz`, `sgtz`, `fmv.s`, `fneg.s`, `fabs.s`, `fmv.d`, `fneg.d`, `fabs.d`.

### 10.3 RARS `ecall` services

The service number is in `a7`. Output goes to the console; input is read through a browser prompt and echoed to the console. An unknown service number is logged as a warning.

| `a7` | Name | Inputs | Effect |
|---|---|---|---|
| `1` | `PrintInt` | `a0` | Prints `a0` as a signed decimal. |
| `2` | `PrintFloat` | `fa0` | Prints the single-precision value. |
| `3` | `PrintDouble` | `fa0` | Prints the double-precision value. |
| `4` | `PrintString` | `a0` = address | Prints the null-terminated string. |
| `5` | `ReadInt` | — | `a0` = integer entered. |
| `6` | `ReadFloat` | — | `fa0` = float entered. |
| `7` | `ReadDouble` | — | `fa0` = double entered. |
| `8` | `ReadString` | `a0` = buffer, `a1` = max length | Stores at most `a1 − 1` characters and a terminating 0. |
| `9` | `Sbrk` | `a0` = bytes | `a0` = start of the block. The heap starts at `dataBase + 0x4000`. |
| `10` | `Exit` | — | Stops the run. |
| `11` | `PrintChar` | `a0` | Prints the character in the low byte. |
| `12` | `ReadChar` | — | `a0` = first character entered. |
| `34` | `PrintIntHex` | `a0` | Prints `0x` and 8 hex digits. |
| `35` | `PrintIntBinary` | `a0` | Prints `0b` and 32 binary digits. |
| `36` | `PrintIntUnsigned` | `a0` | Prints `a0` as an unsigned decimal. |
| `40` | `MilliSleep` | `a0` = ms | Logged; no delay is applied. |
| `93` | `Exit2` | `a0` = exit code | Stops the run and logs the exit code. |

---


## 11. Keyboard shortcuts

Global shortcuts do not fire while a form field (UART input, address box, find fields) has focus. The unmodified letter and arrow keys act only outside the editor.

| Shortcut | Action | Scope |
|---|---|---|
| `F5` | Run / Pause / Resume | Global |
| `F8` | Step | Global |
| `Shift+F8` | Step back | Global |
| `F9` | Toggle a breakpoint on the cursor line (snaps to the nearest instruction) | Global |
| `Ctrl+Enter` / `Cmd+Enter` | Assemble or compile | Global |
| `Ctrl+S` / `Cmd+S` | Save the source file (`.asm` / `.c`) | Global |
| `→` / `←` | Step / Step back; with the single-cycle datapath shown, the next / previous phase | Outside the editor |
| `J` / `K` / `L` (held) | Press BTNL / BTNC / BTNR while held | Outside the editor |
| `X`, `Y`, `Z` or `T` held, then `,` / `.` | Accelerometer axis or temperature −5 / +5 | Outside the editor |
| `Esc` | Close Find & Replace, the open dialog or overlay, or the autocomplete list | Global |
| `Ctrl+F` / `Cmd+F` | Find & Replace, focus on Find | Editor |
| `Ctrl+H` / `Cmd+H` | Find & Replace, focus on Replace | Editor |
| `Enter` / `Shift+Enter` | Next / previous match | Find box |
| `Alt+C` | Toggle case-sensitive search | Find box |
| `Ctrl+Space` | Open autocomplete | Editor |
| `Tab` | Insert `\t` at the cursor, indent a selection, or accept a completion | Editor |
| `Shift+Tab` | Unindent the selected lines | Editor |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo (CodeMirror history) | Editor |

---

## 12. Automated test suite

The Node/jsdom harness is in [`riscv_simulator_tests/`](riscv_simulator_tests). Every suite loads the real `riscv_simulator.html`, so the tests exercise the shipped file rather than a copy of its logic. There is no build step. `npm test` runs 28 suites; four more need tools `npm test` cannot assume and are run on their own (`npm run test:native`, `test:verilator`, `test:folder`, `test:app`).

Shared infrastructure, not suites: `godbolt_cache.js` with `godbolt_cache*.json` answers the Godbolt compile requests for the examples, and `examples_fetch.js` serves `examples/` from disk. Both stand in for network access that jsdom does not have. `cm6_bundle.min.js` is the CodeMirror bundle injected into each page.

**RTL and engines.** Suites that simulate a processor need its Verilog sources (a Wrapper and core with the standard module names). They read them from the folder named by the environment variable `RVSIM_CORE_DIR`, or from `RV/` beside `riscv_simulator_tests/` when there is one (`core_dir.js`), and skip themselves when there is neither. `test_electron_app.js` runs on the prebuilt core in `examples/hdl/` instead. The prebuilt gate-level core in `examples/hdl/` (`RV_reference.v`, with `Wrapper.v`) needs no sources. The WASM Icarus engine is read from `HDL_ENGINE_DIR`, default `vendor/verisim/` (`ivlpp`, `ivl`, `vvp`, each `.js` plus `.wasm`). The Emscripten modules are ES modules that use `import.meta`, so Node 20 or later is required.

### Suites run by `npm test`

| Test script | What it checks |
|---|---|
| `test_tab_and_autocomplete.js` | CodeMirror key handling: literal Tab, block indent, operand autocomplete, signature help. |
| `test_breakpoint_highlight_and_snap.js` | Breakpoint snapping from comments, blank lines and directives; the gutter highlight. |
| `test_jsdom.js` | Boot smoke test. |
| `test_all_instructions_v2.js` | A program containing every supported instruction and pseudo-instruction assembles without errors. |
| `test_instruction_semantics.js` | Each instruction executes to the result the RISC-V specification gives (§12.1). |
| `test_execution_programs.js` | Multi-step programs with register checks: factorial (5! = 120) and Fibonacci (F9 = 34, F10 = 55). |
| `test_comprehensive_suite.js` | Integration: editor facade, Tab, breakpoints, assembler, stepping and undo, MMIO registers, toolbar layout; assembler diagnostics (operand counts, range checks, label rules), register naming in the disassembly, the PC readout and the `ecall` notice. |
| `test_panel_grid.js` | Dockable panel grid, splitters, per-panel column sizing and persistence. |
| `test_panel_find.js` | Each panel's row filter; Peripherals has none. |
| `test_mmio_editability_and_content_column.js` | Read-only MMIO registers ignore writes and are not editable (`UART_RX` excepted); MMIO edits show at once; Content column ASCII/DEC and its signed switch in Memory and Registers. |
| `test_memory_row_granularity_and_shortcuts.js` | One word per memory row in both modes; trailing `:` on row labels; push-button and accelerometer keys. |
| `test_mobile_keyboard_focus.js` | The on-screen keyboard keeps focus across panel relayout. |
| `test_disassembly_machine_code.js` | Machine-code Byte/Word modes, binary byte grouping, the LSB hint. |
| `test_disassembly_labels_and_warnings.js` | Label headers, jump and branch target annotations, FPGA memory notices. |
| `test_disasm_immediates.js` | Alternative readings of an immediate field are offered only in spellings a real assembler accepts. |
| `test_c_godbolt_simulation.js` | Godbolt compilation, line mapping in both directions, C breakpoints and stepping. |
| `test_new_c_simulation.js` | Compiles and runs `Circle_delay_accel.c` and `ImageDisplay_autoadvance_accel.c`. |
| `test_baked_examples_full.js` | Compiles and runs the four heaviest examples, two assembly and two C, checking rendered pixels and UART output. |
| `test_statement_stepping.js` | Statement Stepping in C and assembly, and stepping back over a statement. |
| `test_sim_max_instructions_setting.js` | The run-limit setting and execution-loop throttling. |
| `test_reset_and_image_display.js` | OLED auto-advance mode 5 rendering, assembly/C pixel parity, peripheral reset. |
| `test_oled_swap_race.js` | The warning for pixels written after a present without an `OLED_STATUS` read. |
| `test_backstep_peripherals.js` | Step back restores LEDs, 7-segment, OLED registers and pages, and both sides of the UART path. |
| `test_datapath.js` | The single-cycle datapath view agrees with the simulator per instruction, every wire it lights exists in the drawing, and one clock edge executes exactly one instruction. |
| `test_pipeline.js` | The 5-stage pipeline model matches the functional model with all hazard handling on, computes the wrong result hardware would with a feature off, gives textbook cycle counts for the classic hazards, and supports Step, Back, Run and breakpoints. |
| `test_hdl_mode.js` | HDL mode end to end (§12.2). Needs `RVSIM_CORE_DIR`. |
| `test_waveform.js` | `parseVcd()` on a hand-written VCD; then a real VCD from Icarus: hierarchy into submodules, the cycle divisor derived from `CLK`, and the value under the cursor matching the trace. The second half needs `RVSIM_CORE_DIR`. |
| `test_m_extension.js` | All eight M instructions over awkward operand pairs (most negative, division by zero, mixed signs, full 64-bit products), run on the JS model, on the RTL through Icarus, and against a BigInt reference; plus the multi-cycle stall and `examples/hdl/RV_reference.v`. The RTL part needs `RVSIM_CORE_DIR`. |

### Suites run on their own

| Test script | Needs | What it checks |
|---|---|---|
| `test_hdl_native.js` | A native Icarus build (`npm run build:iverilog` in `electron/`, or `HDL_NATIVE_DIR`); `RVSIM_CORE_DIR` | Two pages, one bridged to `electron/iverilog/<os>-<arch>` and one to `vendor/verisim/` run in Node, load the same sources as a folder, run 40,000 cycles of DIP to LED and replay a switch change from a checkpoint; recordings and waveforms must be identical. Also folder selection (testbenches, a Vivado `.runs` copy, a duplicate module), re-reading on focus, a compile error, and Reset killing `vvp`. On the native page, chunked runs: a switch moved mid-run, Pause and Run, a breakpoint, *Real time*, no trace, the waveform, the mid-run display against the same point shown from scratch, and a 90,000-cycle run's waveform window against a run from reset. |
| `test_verilator.js` | Native Icarus and Verilator builds (`npm run build:verilator`), a C++20 compiler (or `RVSIM_FORCE_ZIG=1` with network access, which fetches Zig); `RVSIM_CORE_DIR` | The Simulator setting (disabled with a tooltip in a browser); a build reported on the status line and cached by content; a 40,000-cycle run recording what Icarus records; an input change, Resume, the Wrapper-only waveform, a compile error, Reset during a build; live runs (a switch moved mid-run checked against a replay, Pause under real-time pacing, Resume, a breakpoint, typed UART input, the per-simulator cycle defaults, a 5,000,000-cycle run trimmed to its last 2,000,000, a live dump stopping at 20 MB); 200,000 cycles timed on both simulators with the waveform on and off; and, in a separate process, checkpoints (Resume, an input change and both waveforms from one, each equal to a run from reset; a corrupted checkpoint and an `initial` block with `<=` falling back to reset). |
| `test_hdl_folder_browser.js` | Chrome (`CHROME_CHANNEL` selects another); `RVSIM_CORE_DIR` | The folder picker in headless Chrome, using an origin-private folder in place of a picked one: what loads, re-reading on focus, the handle surviving a reload, *Clear files* forgetting it, and the `webkitdirectory` fallback. |
| `test_electron_app.js` | The desktop app (`npm install` and `npm run build:iverilog` in `electron/`), a display; `RVSIM_CORE_DIR` optional | Launches `electron/` through Playwright, or a packaged build named by `RVSIM_APP_EXE`: `app://` loading, no Node in the page, the folder button with the dialog stubbed, Run lighting the LEDs, Verilator selected in Settings and run, a switch flipped during a live run showing on the LEDs before Pause, nothing fetched for the engines, and the folder remembered across a restart. |

`oneoff_oled_modes.js` is not a suite. It runs the same programs on the JS model and on the RTL's Wrapper through Icarus and compares the two 96×64 frame buffers pixel by pixel, covering 16- and 24-bit colour, `vary_col`/`vary_row`, both auto-advance directions with wrap and repositioning, and the byte-lane rules of each colour format.

### 12.1 Instruction semantics

`test_all_instructions_v2.js` only shows that every instruction assembles. A wrong `funct7`, a decoder that sign-extends where it should not, or a pseudo-instruction with the wrong expansion still assembles cleanly and computes the wrong answer.

`test_instruction_semantics.js` executes each instruction and checks the result. The encoder and the interpreter are separate code paths, so each check covers encoder → machine code → decoder → execution. Expected values come from the RISC-V specification, not from the simulator. Every comparison has boundary cases: equal as well as less and greater, zero as well as positive and negative.

The suite is mutation-tested: each of these seeded faults is caught.

| Seeded fault | Cases that catch it |
|---|---|
| `SRAI` made a logical shift | 2 |
| `SLTI` `<` made `<=` | 1 |
| `SLTIU` `<` made `<=` | 1 |
| `BGE` `>=` made `>` | 5 |
| `SUB` encoded with `ADD`'s `funct7` | 6 |
| `XORI` encoded as `ORI` | 1 |
| `BLTU` encoded as `BLT` | 2 |
| `LHU` sign-extending | 1 |
| `mv`, `neg`, `snez`, `sgtz`, `seqz` expansions corrupted | 1–2 each |

### 12.2 The HDL suite

`test_hdl_mode.js` assembles through the page's own assembler, asks the page for the files it would hand to Icarus (the generic testbench, the memory images, the stimulus files), and runs the WASM Icarus pipeline over the unmodified sources in `RVSIM_CORE_DIR`. jsdom cannot import the Emscripten modules, so the engine is driven from Node, but every file fed to it is the one the page produced. Besides the HDL-mode UI and settings, it checks:

- **Discovery** finds `dut.RV1.RegFile1.RegBank`, and still finds the register file after the module, the instance and the array are renamed.
- **Synthesisability lint** flags delays, `$display`, `real`, `forever`, `casex`, blocking `=` in a clocked block and `initial` with a delay, each with file and line, without false hits on parameter lists, `for` headers, comments, strings or testbench files.
- **Post-synthesis**: only the core is synthesised, the Wrapper is excluded, and a parameterised `RV` shim lets the Wrapper elaborate; the cross-check compares instructions, memory writes and peripherals, not register writes.
- **The testbench is program-independent**: the Verilog is byte-identical for two programs with different switch settings and contains no DIP value.
- **One compile, many runs**: the same binary gives `LED=0xad` for `+DIP=bead` and `LED=0x72` for `+DIP=0072`, and runs with no plusargs at all.
- **The trace** starts at the reset vector, never reports a write to `x0`, and captures the DIP value reaching a register and the store to the LED address.
- **Stepping** reaches the right state on both sides of the instruction that reads the switches, and stepping back undoes the register write.
- **A mid-run input change** takes effect (`0xad` → `0xff`) while the history before it stays bit-identical.
- **MMIO timing**: an input changed while paused is read by the next instruction, and the LED shows its new value as soon as the storing instruction completes.
- **Breakpoints**: Resume stops on the breakpoint line, continues to the next time that line is reached, and runs to the end of the recording when there are none.
- **`RX_VALID`**: both bytes are acknowledged, the register empties on the instruction that reads each one, and stepping back restores the byte.
- **Statement Stepping**: off, a Step is one machine instruction; on, a Step covers the source line and Back undoes exactly that.
- **`HelloWorld`**: `'A'` and CR delivered through `uart_rx.mem` produce the echo and the greeting stored in DMEM, exercising `UART_RX`/valid/ack and `UART_TX`/valid.

```bash
RVSIM_CORE_DIR=/path/to/core node riscv_simulator_tests/test_hdl_mode.js
```

---


## Licensing

HDL mode runs builds of **Icarus Verilog**, which are licensed under the **GPL**. The page does not contain them: it loads them at runtime from a CDN, falling back to the copy in `vendor/verisim/`. Check the GPL's terms before redistributing those binaries. The desktop app bundles native Icarus and Verilator as separate programs it runs, with Icarus's `COPYING` beside them in `resources/iverilog/`; the Icarus source is the pinned commit of <https://github.com/steveicarus/iverilog>.

Verilog sources are never uploaded. They are compiled on the user's computer and exist only in the browser tab, or in the folder they were read from.
