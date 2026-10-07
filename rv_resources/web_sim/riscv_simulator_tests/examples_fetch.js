// Serves examples/ from local disk - the programs, examples/index.txt that
// lists them (see EXAMPLE_MENU in riscv_simulator.html), and examples/hdl/
// for the prebuilt processor - so the page's own fetch() calls work under
// jsdom, which has no fetch of its own (confirmed: window.fetch is undefined
// there by default).
//
// This is the runtime counterpart of the offline godbolt_cache: without it,
// every example but `dip_led` / `dip_led_c` fails to load under test, the
// same way it fails when the page is opened via file:// instead of http://.
//
// MUST be installed inside beforeParse, not after `new JSDOM()` returns:
//
//   const dom = new JSDOM(html, {
//     runScripts: 'dangerously',
//     beforeParse(window) {
//       ...
//       installExamplesFetch(window);   // last statement in beforeParse
//     }
//   });
//
// The page's own top-level script calls fetch('examples/index.txt')
// immediately as it loads - which, with runScripts: 'dangerously', happens
// synchronously while `new JSDOM()` is still running, before any code after
// it (including `const win = dom.window; installExamplesFetch(win);`) gets
// to run. Installed too late, that first fetch throws, EXAMPLE_MENU and
// EXAMPLE_FILENAMES stay on their two-entry fallback, and every
// win.loadExample() call for anything but the two baked examples 404s.
//
// Safe to install alongside installGodboltCache()/a Godbolt fetch: only
// `examples/...` requests are intercepted here, anything else falls through
// to whatever fetch (if any) was already on the window, or fails closed.

const fs = require('fs');
const path = require('path');

const EXAMPLES_ROOT = path.resolve(__dirname, '..', 'examples');

function installExamplesFetch(win) {
  const existing = typeof win.fetch === 'function' ? win.fetch : null;
  win.fetch = async (url, opts) => {
    // examples/index.txt, examples/<lang>/<program>, and examples/hdl/<file>
    // for the prebuilt processor.
    const m = String(url).match(/(?:^|\/)examples\/(?:([a-z]+)\/)?([^/?#]+)$/);
    if (m) {
      const filePath = m[1] ? path.join(EXAMPLES_ROOT, m[1], m[2])
                            : path.join(EXAMPLES_ROOT, m[2]);
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
      } catch (e) {
        return { ok: false, status: 404, text: async () => '', json: async () => { throw e; } };
      }
    }
    if (existing) return existing(url, opts);
    throw new Error('examples_fetch: no handler for ' + url);
  };
  return win;
}

module.exports = { installExamplesFetch, EXAMPLES_ROOT };
