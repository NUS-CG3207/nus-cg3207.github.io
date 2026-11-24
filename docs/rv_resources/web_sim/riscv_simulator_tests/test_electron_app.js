/*
 * The desktop app itself (electron/), driven through Playwright: the page
 * loads over app://, runs with native Icarus, picks up a folder through the
 * real button, runs DIP to LED from the toolbar, and remembers the folder
 * across a restart. Nothing the HDL engine needs is fetched from the network.
 *
 * Needs: cd electron && npm install && npm run build:iverilog
 * RVSIM_APP_EXE runs a packaged app instead (electron/dist/linux-unpacked/
 * rvsimulator, say). Opens a window on the desktop for a few seconds.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'electron');
const { _electron } = require('playwright-core');
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
    }, path.join(ROOT, 'RV'));
    await page.evaluate(() => setSimEngineMode('hdl'));
    await page.waitForSelector('#hdlFolderBtn', { state: 'visible' });
    await page.click('#hdlFolderBtn');
    await page.waitForFunction(() => getHdlFiles().length === 10, null, { timeout: 10000 });
    check('The ten RV/ sources are loaded', true);
    check('The sources note names the folder',
      /10 loaded from RV, Wrapper found/.test(await page.textContent('#hdlSourcesNote')));
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
    check('No HDL engine was fetched from the network (' + run.net.filter(u => /verisim|yosys/.test(u)).length + ')',
      !run.net.some(u => /verisim|yosys/.test(u)));
    check('No page errors (' + run.errors.join('; ') + ')', run.errors.length === 0);
    await app.close();

    console.log('\n[4] The folder is remembered');
    run = await launch(userData);
    const back = await run.page.waitForFunction(() => getHdlFiles().length === 10, null, { timeout: 10000 }).then(() => true, () => false);
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
