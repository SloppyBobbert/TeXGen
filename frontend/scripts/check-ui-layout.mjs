// Isolated UI mocks only: no account writes or real compilation credits.
// Run against the built frontend: node scripts/check-ui-layout.mjs
/* global document, window */
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import console from 'node:console';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5174';
const output = path.resolve(process.env.UI_SCREENSHOTS || '../.pi/ui-polish');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const classes = [{ name: 'Physics 101', categories: [{ name: 'Motion', formulas: [{ id: 'physics-i.velocity', name: 'Velocity' }] }] }];
const source = '\\documentclass{article}\n\\begin{document}UI preview\\end{document}';
// Minimal one-page PDF, generated locally rather than calling the compiler.
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream'];
let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const results = [];
try {
  for (const width of [360, 390, 768, 1280, 1440]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => console.error('Browser error:', error.message));
      page.on('dialog', async dialog => { console.error('Browser dialog:', dialog.message()); await dialog.accept(); });
      let remaining = 3;
      let compiles = 0;
      let generations = 0;
      let allowanceGets = 0;
      let allowanceUnavailable = true;
      let sheets = [];
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const body = route.request().postDataJSON();
        const json = data => route.fulfill({ json: data });
        if (url.pathname === '/api/classes/') return json({ classes });
        if (url.pathname === '/api/generate-sheet/') return json({ tex_code: `${source}\n% generation ${++generations}` });
        if (url.pathname === '/api/compile/') {
          if (route.request().method() === 'GET') {
            allowanceGets++;
            return allowanceUnavailable ? route.fulfill({ status: 503, json: { detail: 'Temporary failure' } }) : json({ remaining });
          }
          if (body?.normalize_only) return json({ tex_code: body.content });
          compiles++;
          remaining = Math.max(0, remaining - 1);
          return route.fulfill({ contentType: 'application/pdf', headers: { 'X-Guest-Compiles-Remaining': String(remaining) }, body: pdf });
        }
        if (url.pathname === '/api/token/') {
          const token = `e30.${Buffer.from(JSON.stringify({ user_id: 999, username: 'UI mock', exp: 4102444800 })).toString('base64url')}.mock`;
          return json({ access: token, refresh: 'mock' });
        }
        if (url.pathname === '/api/cheatsheets/') return json(sheets);
        return json({ videos: [] });
      });
      const screenshot = async state => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `mock-${state}-${theme}-${width}.png`), fullPage: true });
        const sizes = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert(sizes.scroll <= sizes.client + 1, `${state}/${theme}/${width}: horizontal overflow ${JSON.stringify(sizes)}`);
      };
      await page.goto(base);
      await page.getByLabel('Select theme').selectOption(theme);
      await page.getByText('Guest allowance unavailable. Try again.').waitFor();
      await page.getByRole('status', { name: 'Checking guest compilation allowance' }).waitFor();
      assert.equal(allowanceGets, 1);
      allowanceUnavailable = false;
      await page.evaluate(() => window.dispatchEvent(new window.Event('focus')));
      await page.getByRole('status', { name: '3 of 3 guest compilations remaining' }).waitFor();
      await page.getByText('Guest allowance unavailable. Try again.').waitFor({ state: 'hidden' });
      assert.equal(allowanceGets, 2);
      assert.equal(compiles, 0);
      await screenshot('empty');
      const title = page.locator('#title');
      await title.scrollIntoViewIfNeeded();
      assert(await title.evaluate(el => {
        const r = el.getBoundingClientRect();
        const p = el.closest('.left-panel-scroll').getBoundingClientRect();
        return r.top >= p.top && r.bottom <= p.bottom && r.height >= 40;
      }), `title clipped at ${width}`);
      if (width <= 768) {
        for (const selector of ['#title', '.left-panel .btn-compile', '.left-panel .history-btn', '.guest-allowance a']) {
          const control = page.locator(selector).first();
          await control.scrollIntoViewIfNeeded();
          assert(await control.evaluate(el => el.getBoundingClientRect().height >= 44), `small touch target ${selector}/${width}`);
        }
        const scroll = await page.locator('.left-panel-scroll').evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }));
        assert(scroll.height >= scroll.content - 1, `mobile subject controls clipped at ${width}`);
      }
      await page.getByLabel('Physics 101', { exact: true }).check();
      await page.getByLabel(/Motion \(1 formulas\)/).check();
      await title.fill('Guest snapshot 1');
      await screenshot('selected');
      await page.getByRole('button', { name: /Compile PDF/ }).click();
      await page.getByRole('status', { name: '2 of 3 guest compilations remaining' }).waitFor();
      await page.locator('.react-pdf__Page canvas').waitFor();
      await screenshot('compiled');
      await page.getByLabel(/Orientation:/).selectOption('landscape');
      await page.getByText('The PDF shows the previous source or layout. Compile to update it.').waitFor();
      assert.equal(compiles, 1);
      await screenshot('stale');
      for (const count of [1, 0]) {
        await title.fill(`Guest snapshot ${3 - count}`);
        await page.getByRole('button', { name: /Compile PDF/ }).click();
        await page.getByRole('status', { name: `${count} of 3 guest compilations remaining` }).waitFor();
        await page.locator('.react-pdf__Page canvas').waitFor();
      }
      assert.equal(compiles, 3);
      await screenshot('exhausted');
      const checkHistory = async (count, state, oldestTitle) => {
        await page.getByRole('button', { name: `Snapshots (${count})`, exact: true }).click();
        assert.equal(await page.locator('.snapshot-restore-btn').count(), count);
        const list = page.locator('.snapshot-list');
        assert(await list.evaluate(el => el.scrollHeight > el.clientHeight && window.getComputedStyle(el).overflowY === 'scroll'), `${state}/${width}: history must visibly scroll`);
        await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const restore = page.locator('.snapshot-restore-btn').last();
        await restore.scrollIntoViewIfNeeded();
        assert(await restore.evaluate(el => {
          const r = el.getBoundingClientRect();
          const listRect = el.closest('.snapshot-list').getBoundingClientRect();
          return r.top >= listRect.top && r.bottom <= listRect.bottom + 1
            && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), `${state}/${width}: bottom Restore unreachable after scroll`);
        const previewHeight = await page.locator('.pdf-preview-scroll').evaluate(el => el.clientHeight);
        assert(previewHeight >= 180, `${state}/${width}: preview only ${previewHeight}px`);
        await screenshot(state);
        const before = compiles;
        await restore.click();
        await page.locator('.snapshot-tray').waitFor({ state: 'hidden' });
        assert.equal(await title.inputValue(), oldestTitle);
        if (state === 'guest-history-3') assert.equal(compiles, before, 'Guest restoring must not compile');
        return { entries: count, previewHeight, bottomRestore: 'scrolled, hit-tested and clicked' };
      };
      const guestHistory = await checkHistory(3, 'guest-history-3', 'Guest snapshot 1');
      await page.getByRole('link', { name: 'Sign in to compile more PDFs' }).click();
      await page.locator('#login-username').waitFor();
      await screenshot('login');
      await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
      await page.locator('#signup-username').waitFor();
      await screenshot('signup');
      await page.getByRole('link', { name: 'Log In', exact: true }).click();
      await page.locator('#login-username').fill('ui-mock-only');
      await page.locator('#login-password').fill('not-a-real-password');
      await page.getByRole('button', { name: 'Log In', exact: true }).click();
      await page.waitForURL(`${base}/`, { timeout: 10000 }).catch(async error => {
        await screenshot('login-failure');
        console.error(await page.locator('body').innerText());
        throw error;
      });
      await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
      await page.getByText("You haven't saved any cheat sheets yet.").waitFor();
      await screenshot('dashboard-empty');
      sheets = [{ id: 999, title: 'A very long UI mock title '.repeat(8), created_at: '2026-01-01', updated_at: '2026-01-02' }];
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
      await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor();
      await screenshot('dashboard-populated');
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await page.getByLabel('Physics 101', { exact: true }).check();
      await page.getByLabel(/Motion \(1 formulas\)/).check();
      for (let i = 1; i <= 7; i++) {
        await title.fill(`Signed-in snapshot ${i}`);
        await page.getByRole('button', { name: 'Generate / Regenerate', exact: true }).click();
        await page.getByRole('button', { name: `Snapshots (${i})`, exact: true }).waitFor();
        await page.locator('.react-pdf__Page canvas').waitFor();
      }
      const fullHistory = await checkHistory(7, 'full-history-7', 'Signed-in snapshot 1');
      results.push({ width, theme, states: 11, guestHistory, fullHistory, compiles: `${compiles} mocked; none on guest selection/layout/restore`, allowanceRecovery: '503 then one successful focus GET; stale error removed' });
      await context.close();
    }
  }
  console.log(JSON.stringify({ passed: true, output, results }, null, 2));
} finally {
  await browser.close();
}
