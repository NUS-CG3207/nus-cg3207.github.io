# `vendor/` — local copies of the three external engines

`riscv_simulator.html` loads three things it does not carry inside itself. Each
is fetched from a CDN first and falls back to the copy here, so the simulator
keeps working when the CDN is blocked, throttled or down. CodeMirror is the
exception, the other way round; see below.

| Folder | What it is | Used for | Size |
|---|---|---|---:|
| `codemirror/` | CodeMirror 6 bundle (`cm6_bundle.min.js`) | the code editor | 0.4 MB |
| `verisim/` | Icarus Verilog compiled to WebAssembly (`ivlpp`, `ivl`, `vvp` + their `.wasm`) | HDL simulation mode | 2.9 MB |
| `yosys/` | [`@yowasp/yosys`](https://www.npmjs.com/package/@yowasp/yosys) 0.68.1207 | post-synthesis functional simulation | 75 MB |

Total: **78 MB**, nearly all of it `yosys/yosys.core.wasm` (67 MB).

## The one thing to know

**The fallbacks only work when the page is served over HTTP** — `python3 -m
http.server` in this folder, GitHub Pages, or any other server. Opened straight
from disk as `file://`, the browser blocks the `fetch()` that Emscripten and the
Yosys bundle use to pull in their own `.wasm`, and the CDN path is the only one
that works. CodeMirror is the exception: it loads through a `<script>` tag, which
`file://` allows, so the editor comes up either way.

## Where the loader looks

Each engine tries its sources in order and takes the first that answers:

- **CodeMirror** — `vendor/codemirror/` → `riscv_simulator_tests/` → jsDelivr, serving `vendor/codemirror/` from the public repository (local first, since a CDN round trip costs a noticeable part of a second on every load)
- **Icarus** — jsDelivr → `senolgulgonul.github.io/verisim/` → `vendor/verisim/` → `verisim/`
- **Yosys** — jsDelivr → `vendor/yosys/`

## Refreshing these copies

Pinned versions, so nothing changes underfoot. Re-run only when you mean to
upgrade, and bump `HDL_YOSYS_VERSION` in `riscv_simulator.html` to match.

```bash
cd vendor

# Icarus Verilog (WASM)
for f in ivlpp.js ivlpp.wasm ivl.js ivl.wasm vvp.js vvp.wasm; do
  curl -fsSL -o "verisim/$f" "https://cdn.jsdelivr.net/gh/senolgulgonul/verisim@main/$f"
done

# Yosys — must match HDL_YOSYS_VERSION in riscv_simulator.html
V=0.68.1207
for f in bundle.js yosys.core.wasm yosys.core2.wasm yosys.core3.wasm \
         yosys.core4.wasm yosys-resources.0.tar; do
  curl -fsSL -o "yosys/$f" "https://cdn.jsdelivr.net/npm/@yowasp/yosys@$V/gen/$f"
done

# CodeMirror — built from riscv_simulator_tests/cm6_entry.js, see that folder's README
cp ../riscv_simulator_tests/cm6_bundle.min.js codemirror/
```

All six Yosys files are required: `bundle.js` resolves the `.wasm` cores and the
resource tar relative to its own URL, so the folder has to stay intact.
