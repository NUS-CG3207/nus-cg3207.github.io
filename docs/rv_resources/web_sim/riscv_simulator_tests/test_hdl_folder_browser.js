/*
 * The HDL folder picker in a real browser (Chrome, headless). The folder is
 * an origin-private one (navigator.storage), whose handles behave as a
 * picked folder's do but need no dialog, so showDirectoryPicker is stubbed to
 * return it. Checked: what loads, re-reading on focus, the handle surviving a
 * reload, and the <input webkitdirectory> fallback for browsers without the
 * File System Access API.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const RV = require('./core_dir').coreDir('test_hdl_folder_browser');
let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.txt': 'text/plain' };
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const sources = fs.readdirSync(RV).filter(f => /\.v$/.test(f))
  .map(f => ({ name: f, src: fs.readFileSync(path.join(RV, f), 'utf8') }));

(async () => {
  const server = await serve();
  const url = 'http://127.0.0.1:' + server.address().port + '/riscv_simulator.html';
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome' });
  try {
    console.log('===========================================================');
    console.log('📁 THE HDL FOLDER PICKER IN CHROME');
    console.log('===========================================================');
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      window.showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('RV');
    });
    await page.goto(url);
    await page.waitForFunction(() => typeof window.hdlPickFolder === 'function');
    await page.evaluate(async files => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('RV', { create: true });
      for (const f of files) {
        const w = await (await dir.getFileHandle(f.name, { create: true })).createWritable();
        await w.write(f.src); await w.close();
      }
    }, sources);

    console.log('\n[1] Picking a folder');
    await page.evaluate(() => setSimEngineMode('hdl'));
    await page.waitForSelector('#hdlFolderBtn', { state: 'visible' });
    check('The button says folder…', (await page.textContent('#hdlFolderBtn')) === 'folder…');
    await page.click('#hdlFolderBtn');
    await page.waitForFunction(() => getHdlFiles().length === 10, null, { timeout: 10000 });
    check('The ten design files load, the testbenches do not', true);
    check('The note names the folder', /10 loaded from RV, Wrapper found/.test(await page.textContent('#hdlSourcesNote')));

    console.log('\n[2] Re-read when the window regains focus');
    await page.evaluate(async () => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('RV');
      const h = await dir.getFileHandle('ALU.v');
      const text = await (await h.getFile()).text();
      const w = await h.createWritable(); await w.write(text + '\n// edited\n'); await w.close();
      window.dispatchEvent(new Event('focus'));
    });
    const reloaded = await page.waitForFunction(() => getHdlFiles().find(f => f.name === 'ALU.v').src.endsWith('// edited\n'),
      null, { timeout: 5000 }).then(() => true, () => false);
    check('An edited file is picked up', reloaded);
    check('…and the console says so', /Reloaded from RV: ALU\.v changed/.test(await page.textContent('#console')));

    console.log('\n[3] The folder survives a reload');
    await page.reload();
    const back = await page.waitForFunction(() => window.getHdlFiles && getHdlFiles().length === 10, null, { timeout: 10000 })
      .then(() => true, () => false);
    check('The page reopens with the folder loaded', back);
    await page.evaluate(() => hdlClearFiles());
    await page.reload();
    await page.waitForTimeout(1000);
    check('Clear files forgets it', (await page.evaluate(() => getHdlFiles().length)) === 0);
    check('No page errors (' + errors.join('; ') + ')', errors.length === 0);

    console.log('\n[4] Without the File System Access API');
    const page2 = await ctx.newPage();
    await page2.addInitScript(() => { window.showDirectoryPicker = undefined; });
    await page2.goto(url);
    await page2.waitForFunction(() => typeof window.hdlPickFolder === 'function');
    await page2.evaluate(() => setSimEngineMode('hdl'));
    await page2.waitForSelector('#hdlFolderBtn', { state: 'visible' });
    check('The button explains that the folder is a copy',
      /pick the folder again/.test(await page2.getAttribute('#hdlFolderBtn', 'title')));
    const [chooser] = await Promise.all([page2.waitForEvent('filechooser'), page2.click('#hdlFolderBtn')]);
    await chooser.setFiles(RV);
    const loaded2 = await page2.waitForFunction(() => getHdlFiles().length === 10, null, { timeout: 10000 })
      .then(() => true, () => false);
    check('A folder chosen through the file input loads the same ten files', loaded2);
    check('…named after the folder', new RegExp('10 loaded from ' + path.basename(RV)).test(await page2.textContent('#hdlSourcesNote')));
    await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'rvsim_folder_browser.png') });
  } catch (e) {
    console.error(e);
    failed++;
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n===========================================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
