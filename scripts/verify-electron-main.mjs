import { _electron as electron } from 'playwright-core';

const projectRoot = process.cwd();
const results = [];

await verifyKeepVisibleMode();
await verifyBlurHidesWindow();

console.log(JSON.stringify(results, null, 2));

async function verifyKeepVisibleMode() {
  const app = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      PORTLY_TEST_KEEP_VISIBLE: '1',
      PORTLY_TEST_SCAN_MODE: 'empty'
    }
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('.popover').waitFor({ state: 'visible', timeout: 5000 });
    const diagnostics = await win.evaluate(() => window.portly?.diagnostics?.());
    const visibleBeforeBlur = await win.evaluate(() => window.portly?.windowState?.());
    await win.evaluate(() => window.portly?.testBlur?.());
    await win.waitForTimeout(200);
    const visibleAfterBlur = await win.evaluate(() => window.portly?.windowState?.());

    assert(diagnostics?.keepVisibleForTests === true, 'diagnostics should expose keep-visible test mode');
    assert(diagnostics?.devToolsOpened === false, 'DevTools should not auto-open');
    assert(diagnostics?.trayIconEmpty === false, `tray icon should load from a non-empty image asset: ${JSON.stringify(diagnostics)}`);
    assert(visibleBeforeBlur?.visible === true, 'test mode window should start visible');
    assert(visibleAfterBlur?.visible === true, 'test mode blur should keep window visible');

    results.push({ mode: 'keep-visible', diagnostics, visibleBeforeBlur, visibleAfterBlur });
  } finally {
    await app.close();
  }
}

async function verifyBlurHidesWindow() {
  const app = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      PORTLY_TEST_SHOW_ON_READY: '1',
      PORTLY_TEST_SCAN_MODE: 'empty'
    }
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('.popover').waitFor({ state: 'visible', timeout: 5000 });
    const visibleBeforeBlur = await win.evaluate(() => window.portly?.windowState?.());
    await win.evaluate(() => window.portly?.testBlur?.());
    await win.waitForTimeout(300);
    const visibleAfterBlur = await win.evaluate(() => window.portly?.windowState?.());

    assert(visibleBeforeBlur?.visible === true, 'non-keep-visible test window should start visible');
    assert(visibleAfterBlur?.visible === false, 'non-keep-visible blur should hide window');

    results.push({ mode: 'blur-hide', visibleBeforeBlur, visibleAfterBlur });
  } finally {
    await app.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
