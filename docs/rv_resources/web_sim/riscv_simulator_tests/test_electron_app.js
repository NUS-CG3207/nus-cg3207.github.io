/*
 * The desktop app itself (electron/), driven through Playwright: the page
 * loads over app://, runs with native Icarus, picks up a folder through the
 * real button, runs DIP to LED from the toolbar, and remembers the folder
 * across a restart. Nothing the HDL engine needs is fetched from the network.
 *
 * Needs: cd electron && npm install && npm run build:iverilog
 * RVSIM_APP_EXE runs a packaged app instead (electron/dist/linux-unpacked/
 * rvedusim, say). Opens a window on the desktop for a few seconds.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'electron');
const { _electron } = require('playwright-core');
const { findCoreDir } = require('./core_dir');
// A processor's RTL when there is one (see core_dir.js); otherwise the
// prebuilt core in examples/hdl, a gate-level netlist and the Wrapper.
const CORE = findCoreDir();
const FOLDER = CORE || path.join(ROOT, 'examples', 'hdl');
const NFILES = CORE ? 10 : fs.readdirSync(FOLDER).filter(f => /\.v$/.test(f)).length;
const SHOT = process.env.SHOT_DIR || os.tmpdir();

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

async function launch(userData) {
  const env = Object.assign({}, process.env, { RVSIM_USER_DATA: userData });
  const app = process.env.RVSIM_APP_EXE
    ? await _electron.launch({ executablePath: process.env.RVSIM_APP_EXE, args: [], env })
    : await _electron.launch({ args: [APP], env });
  const page = await app.firstWindow();
  const net = [], errors = [];
  page.on('request', r => { if (/^https?:/.test(r.url())) net.push(r.url()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.waitForLoadState('load');
  await page.waitForFunction(() => typeof window.hdlPickFolder === 'function' && document.querySelector('.cm-editor'));
  return { app, page, net, errors };
}

(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rvsim-app-'));
  let run;
  try {
    console.log('===========================================================');
    console.log('🖥  THE DESKTOP APP');
    console.log('===========================================================');
    run = await launch(userData);
    const { app, page } = run;

    console.log('\n[1] The page, served from disk');
    check('It loads over app://', page.url() === 'app://rvsim/riscv_simulator.html');
    check('The bridge reports native Icarus', await page.evaluate(() => !!(window.rvNative && window.rvNative.icarus)));
    check('Node is not reachable from the page', await page.evaluate(() => typeof require === 'undefined' && typeof process === 'undefined'));
    check('There is no menu bar', await app.evaluate(({ Menu }) => process.platform === 'darwin' || Menu.getApplicationMenu() === null));

    console.log('\n[2] Picking a folder with the button');
    await app.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
    }, FOLDER);
    await page.evaluate(() => setSimEngineMode('hdl'));
    await page.waitForSelector('#hdlFolderBtn', { state: 'visible' });
    await page.click('#hdlFolderBtn');
    await page.waitForFunction(n => getHdlFiles().length === n, NFILES, { timeout: 10000 });
    check('The ' + NFILES + ' sources in ' + path.basename(FOLDER) + '/ are loaded', true);
    check('The sources note names the folder',
      new RegExp(NFILES + ' loaded from ' + path.basename(FOLDER) + ', Wrapper found').test(await page.textContent('#hdlSourcesNote')));
    await page.screenshot({ path: path.join(SHOT, 'rvsim_app_settings.png') });
    await page.evaluate(() => closeSettingsModal());

    console.log('\n[3] Run from the toolbar');
    await page.evaluate(async () => { await loadExample('dip_led'); setDipSwitches(0x00ad); });
    await page.click('#runPauseBtn');
    const lit = await page.waitForFunction(() => getLedState() === 0xad, null, { timeout: 60000 }).then(() => true, () => false);
    check('The LEDs show the switches after Run', lit);
    const log = await page.evaluate(() => [...document.querySelectorAll('#console div')].map(d => d.textContent).join('\n'));
    const m = /preprocess (\d+) ms, compile (\d+) ms/.exec(log);
    console.log('    ' + (m ? m[0] : 'no timing line'));
    check('The console carries no engine error', !/\[HDL\].*(error|failed)/i.test(log));
    await page.screenshot({ path: path.join(SHOT, 'rvsim_app_run.png') });

    console.log('\n[3a] An Icarus run takes a switch while it runs');
    await page.evaluate(() => { resetAll(); setDipSwitches(0x00ad); setHdlCycles(200000); });
    await page.click('#runPauseBtn');
    await page.waitForFunction(() => /running - cycle/.test(document.getElementById('statusBar').textContent), null, { timeout: 60000 });
    check('The Run button reads Pause while it runs', /Pause/.test(await page.textContent('#runPauseBtn')));
    await page.click('text=Peripherals');
    await page.click('#dip0');
    const icFollowed = await page.waitForFunction(() => getLedState() !== 0xad, null, { timeout: 10000 }).then(() => true, () => false);
    const icStill = await page.evaluate(() => /running - cycle/.test(document.getElementById('statusBar').textContent));
    await page.screenshot({ path: path.join(SHOT, 'rvsim_app_icarus_chunks.png') });
    check('A switch clicked during the run shows on the LEDs while it runs (LED 0x' +
      (await page.evaluate(() => getLedState().toString(16))) + ')', icFollowed && icStill);
    await page.click('#runPauseBtn');
    const icPaused = await page.waitForFunction(() => /HDL paused/.test(document.getElementById('statusBar').textContent), null, { timeout: 10000 }).then(() => true, () => false);
    const icAfter = await page.evaluate(() => [document.getElementById('statusBar').textContent, getHdlTrace().budget]);
    check('Pause stops it part-way (' + icAfter.join(', ') + ')', icPaused && icAfter[1] < 200000);
    await page.evaluate(() => resetAll());

    console.log('\n[3b] Verilator, chosen in Settings');
    await page.evaluate(() => openSettingsModal('simulator'));
    check('The Simulator setting can be changed', !(await page.isDisabled('#hdlSimulator')));
    await page.selectOption('#hdlSimulator', 'verilator');
    await page.screenshot({ path: path.join(SHOT, 'rvsim_app_verilator_settings.png') });
    await page.evaluate(() => { closeSettingsModal(); setDipSwitches(0x005a); });
    await page.click('#runPauseBtn');
    const vlLit = await page.waitForFunction(() => getLedState() === 0x5a, null, { timeout: 180000 }).then(() => true, () => false);
    const vlLog = await page.evaluate(() => [...document.querySelectorAll('#console div')].map(d => d.textContent).join('\n'));
    const vb = /Verilator build ([\d.]+) s \(([^)]+)\)/.exec(vlLog);
    console.log('    ' + (vb ? vb[0] : 'no build line'));
    check('Run builds with Verilator and lights the LEDs', vlLit && !!vb);
    await page.evaluate(() => { resetAll(); setHdlCycles(50000000); });
    await page.click('#runPauseBtn');
    await page.waitForFunction(() => /running live/.test(document.getElementById('statusBar').textContent), null, { timeout: 60000 });
    await page.evaluate(() => setDipSwitches(0x000f));
    const followed = await page.waitForFunction(() => getLedState() === 0x0f, null, { timeout: 10000 }).then(() => true, () => false);
    const stillLive = await page.evaluate(() => /running live/.test(document.getElementById('statusBar').textContent));
    check('A switch flipped during a live run shows on the LEDs while it runs', followed && stillLive);
    check('The Run button reads Pause while it runs', /Pause/.test(await page.textContent('#runPauseBtn')));
    await page.click('#runPauseBtn');
    const paused = await page.waitForFunction(() => /paused/.test(document.getElementById('statusBar').textContent), null, { timeout: 30000 }).then(() => true, () => false);
    check('Pause stops it', paused);
    await page.evaluate(() => setHdlSimulator('icarus'));
    check('No HDL engine was fetched from the network (' + run.net.filter(u => /verisim|yosys/.test(u)).length + ')',
      !run.net.some(u => /verisim|yosys/.test(u)));
    check('No page errors (' + run.errors.join('; ') + ')', run.errors.length === 0);
    await app.close();

    console.log('\n[4] The folder is remembered');
    run = await launch(userData);
    const back = await run.page.waitForFunction(n => getHdlFiles().length === n, NFILES, { timeout: 10000 }).then(() => true, () => false);
    check('A restart loads the same folder without asking', back);
    await run.page.evaluate(() => hdlClearFiles());
    await run.app.close();
    run = await launch(userData);
    await new Promise(r => setTimeout(r, 1000));
    check('Clear files forgets it', (await run.page.evaluate(() => getHdlFiles().length)) === 0);
    await run.app.close();
    run = null;
  } catch (e) {
    console.error(e);
    failed++;
  } finally {
    if (run) await run.app.close().catch(() => {});
    fs.rmSync(userData, { recursive: true, force: true });
  }
  console.log('\n===========================================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
