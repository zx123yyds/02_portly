import { _electron as electron } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const screenshotDir = path.join(projectRoot, 'artifacts', 'screenshots');
await fs.mkdir(screenshotDir, { recursive: true });

const modes = [
  { name: 'real', env: { PORTLY_TEST_KILL_MODE: 'mock', PORTLY_TEST_SCAN_MODE: 'sample' } },
  { name: 'empty', env: { PORTLY_TEST_SCAN_MODE: 'empty' } },
  { name: 'error', env: { PORTLY_TEST_SCAN_MODE: 'error' } }
];

const results = [];

for (const mode of modes) {
  const app = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      ...mode.env,
      PORTLY_TEST_KEEP_VISIBLE: '1'
    }
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('.popover').waitFor({ state: 'visible', timeout: 5000 });
    await win.locator('.other-list').waitFor({ state: 'attached', timeout: 5000 });
    await win.waitForTimeout(700);
    await win.setViewportSize({ width: 400, height: 620 });
    const diagnostics = await win.evaluate(() => window.portly?.diagnostics?.());

    const baseMetrics = await collectMetrics(win);
    const screenshotPath = path.join(screenshotDir, `${mode.name}-desktop.png`);
    await win.screenshot({ path: screenshotPath, fullPage: true });
    const autoRefreshMetrics = mode.name === 'real' ? await verifyAutoRefreshFlow(win, baseMetrics) : null;
    const searchMetrics = await verifySearchFlow(win, mode.name);

    await clickByAria(win, '刷新端口列表');
    await win.waitForTimeout(500);
    const afterRefresh = await collectMetrics(win);

    const toggle = win.getByRole('button', { name: '另有' });
    await toggle.click();
    await win.waitForTimeout(200);
    const afterToggle = await collectMetrics(win);

    const rows = await win.locator('.list .row').count();
    if (rows > 0) {
      await win.locator('.list .row').first().click();
      await win.waitForTimeout(200);
    }
    const afterExpand = await collectMetrics(win);
    const killMetrics = rows > 0 ? await verifyKillFlow(win) : null;
    assertKillMetrics(killMetrics);

    if (rows > 1) {
      await win.locator('.list .row').nth(1).click();
      await win.waitForTimeout(200);
    }
    const afterSecondExpand = await collectMetrics(win);

    const otherRows = await win.locator('.other-list .row').count();
    if (otherRows > 0) {
      await win.locator('.other-list .row').first().click();
      await win.waitForTimeout(200);
    }
    const afterOtherExpand = await collectMetrics(win);

    await win.setViewportSize({ width: 340, height: 720 });
    await win.waitForTimeout(200);
    const narrowScreenshotPath = path.join(screenshotDir, `${mode.name}-narrow.png`);
    await win.screenshot({ path: narrowScreenshotPath, fullPage: true });
    const narrowMetrics = await collectMetrics(win);

    results.push({
      mode: mode.name,
      diagnostics,
      screenshotPath,
      narrowScreenshotPath,
      baseMetrics,
      autoRefreshMetrics,
      searchMetrics,
      afterRefresh,
      afterToggle,
      afterExpand,
      killMetrics,
      afterSecondExpand,
      afterOtherExpand,
      narrowMetrics
    });
  } finally {
    await app.close();
  }
}

console.log(JSON.stringify(results, null, 2));

async function collectMetrics(win) {
  return win.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const popover = document.querySelector('.popover')?.getBoundingClientRect();
    const expandedCount = document.querySelectorAll('.row.expanded .row-detail').length;
    const otherList = document.querySelector('.other-list');
    const otherVisible = otherList ? getComputedStyle(otherList).display !== 'none' : false;
    return {
      text: document.body.innerText,
      overflow,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      popover: popover ? { x: popover.x, y: popover.y, width: popover.width, height: popover.height } : null,
      footerTitle: document.querySelector('.footer-left')?.getAttribute('title') ?? '',
      devRows: document.querySelectorAll('.list .row').length,
      otherRows: document.querySelectorAll('.other-list .row').length,
      expanded: expandedCount > 0,
      expandedCount,
      otherVisible
    };
  });
}

async function verifyAutoRefreshFlow(win, beforeMetrics) {
  if (beforeMetrics.devRows > 0) {
    await win.locator('.list .row').first().click();
    await win.waitForTimeout(120);
  }

  const before = await collectMetrics(win);
  await win.waitForTimeout(5400);
  const after = await collectMetrics(win);

  if (beforeMetrics.devRows > 0) {
    await win.locator('.list .row').first().click();
    await win.waitForTimeout(120);
  }

  return {
    footerTitleChanged: before.footerTitle !== after.footerTitle,
    expandedPreserved: beforeMetrics.devRows > 0 ? before.expanded && after.expanded : true,
    overflowAfterAutoRefresh: after.overflow
  };
}

async function clickByAria(win, label) {
  const button = win.getByLabel(label);
  await button.click();
}

async function verifySearchFlow(win, modeName) {
  const input = win.getByLabel('搜索端口或服务名');
  await input.waitFor({ state: 'visible', timeout: 5000 });

  if (modeName !== 'real') {
    return { visible: true };
  }

  await input.fill('5173');
  await win.waitForTimeout(120);
  const afterPortQuery = await collectMetrics(win);

  await input.fill('zz-no-match');
  await win.waitForTimeout(120);
  const afterNoMatch = await collectMetrics(win);

  await input.fill('');
  await win.waitForTimeout(120);

  return {
    visible: true,
    portQueryDevRows: afterPortQuery.devRows,
    portQueryHasPort: afterPortQuery.text.includes(':5173'),
    noMatchTextShown: afterNoMatch.text.includes('没有匹配的端口'),
    noMatchOverflow: afterNoMatch.overflow
  };
}

async function verifyKillFlow(win) {
  await win.locator('.list .row .danger-action').first().click();
  await win.locator('.list .row.confirming-kill').waitFor({ state: 'visible', timeout: 1000 });
  await win.waitForTimeout(80);
  const confirmText = await win.locator('.list .row.confirming-kill .row-actions').innerText();
  const inlineConfirmMetrics = await win.evaluate(() => {
    const row = document.querySelector('.list .row')?.getBoundingClientRect();
    const rowElement = document.querySelector('.list .row.confirming-kill');
    const actions = document.querySelector('.list .row.confirming-kill .row-actions')?.getBoundingClientRect();
    const killElement = document.querySelector('.list .row.confirming-kill .kill-btn');
    const cancel = document.querySelector('.list .row.confirming-kill .cancel-btn')?.getBoundingClientRect();
    const kill = document.querySelector('.list .row.confirming-kill .kill-btn')?.getBoundingClientRect();
    const rowBackground = rowElement ? getComputedStyle(rowElement).backgroundColor : '';
    const killBackground = killElement ? getComputedStyle(killElement).backgroundColor : '';
    const isDangerRed = killBackground.includes('239, 68, 68')
      || killBackground.includes('239 68 68')
      || killBackground.includes('220, 38, 38')
      || killBackground.includes('220 38 38');
    return {
      isInsideRow: Boolean(row && actions && actions.top >= row.top && actions.bottom <= row.bottom),
      buttonsOnSameLine: Boolean(cancel && kill && Math.abs(cancel.top - kill.top) < 2 && Math.abs(cancel.height - kill.height) < 2),
      rowBackgroundIsNotRed: !rowBackground.includes('239, 68, 68') && !rowBackground.includes('239 68 68'),
      killButtonIsRed: isDangerRed,
      actionsWidth: actions?.width ?? null,
      confirmTop: actions?.top ?? null,
      rowTop: row?.top ?? null,
      rowBottom: row?.bottom ?? null
    };
  });
  await win.getByRole('button', { name: '取消' }).click();
  await win.locator('.list .row.confirming-kill').waitFor({ state: 'detached', timeout: 1000 });
  await win.waitForTimeout(80);
  const cancelText = await win.locator('body').innerText();

  await win.locator('.list .row .danger-action').first().click();
  await win.locator('.list .row.confirming-kill').waitFor({ state: 'visible', timeout: 1000 });
  await win.getByRole('button', { name: /确认结束进程/ }).click();
  await win.waitForTimeout(300);
  const normalKillText = await win.locator('body').innerText();

  await win.locator('.list .row .danger-action').first().click();
  await win.locator('.list .row.confirming-kill').waitFor({ state: 'visible', timeout: 1000 });
  await win.getByRole('button', { name: /确认结束进程/ }).click();
  await win.waitForTimeout(300);
  const forceKillText = await win.locator('body').innerText();

  return {
    inAppConfirmShown: confirmText.includes('取消') && confirmText.includes('结束'),
    inlineConfirmShown: inlineConfirmMetrics.isInsideRow,
    confirmButtonsOnSameLine: inlineConfirmMetrics.buttonsOnSameLine,
    confirmRowBackgroundIsNotRed: inlineConfirmMetrics.rowBackgroundIsNotRed,
    confirmKillButtonIsRed: inlineConfirmMetrics.killButtonIsRed,
    confirmUsesChineseLabels: !/(Kill|Open|Copy)/.test(confirmText),
    confirmDoesNotRepeatPort: !confirmText.includes(':5173'),
    cancelShowsKillToast: cancelText.includes('已结束') || cancelText.includes('已强制结束'),
    normalKillToastShown: normalKillText.includes('已结束'),
    forceKillToastShown: forceKillText.includes('已强制结束')
  };
}

function assertKillMetrics(metrics) {
  if (!metrics) return;
  for (const [key, value] of Object.entries(metrics)) {
    if (value !== true && key !== 'cancelShowsKillToast') {
      throw new Error(`Kill flow check failed: ${key}=${value}`);
    }
  }
  if (metrics.cancelShowsKillToast !== false) {
    throw new Error('Kill flow check failed: cancel triggered a kill toast');
  }
}
