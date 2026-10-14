import { Buffer } from 'node:buffer';
import { test, expect } from '@playwright/test';
import { submitLogin } from './helpers/submit-login.js';

for (const [size, viewport, theme] of [
  ['desktop', { width: 1440, height: 1000 }, 'light'],
  ['mobile', { width: 320, height: 844 }, 'dark'],
]) {
  test(`source export and history remain usable after the first compile fails (${size})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/compile/', route => route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { error: 'Injected compile failure' } }) : route.continue());
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Select theme' }).selectOption(theme);
    const back = page.getByRole('button', { name: 'Back', exact: true });
    const forward = page.getByRole('button', { name: 'Forward', exact: true });
    await expect(back).toBeDisabled();
    await expect(forward).toBeDisabled();
    await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
    const generated = page.waitForResponse(response => response.url().endsWith('/api/generate-sheet/')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generate / Regenerate', exact: true }).click();
    const response = await generated;
    expect(response.ok()).toBeTruthy();
    const { tex_code: source } = await response.json();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Compile failed. No PDF is available.');
    await expect(alert).toContainText('Injected compile failure');
    await expect(page.locator('.pdf-page canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0);

    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: '.tex', exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(/\.tex$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(source, 'utf8'));
    await expect(back).toBeEnabled();
    await expect(forward).toBeDisabled();
    await back.click();
    await expect(back).toBeDisabled();
    await expect(forward).toBeEnabled();
    await expect(page.getByRole('button', { name: '.tex', exact: true })).toHaveCount(0);
    await forward.click();
    await expect(page.getByRole('button', { name: '.tex', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`Dashboard retries a failed load without losing the signed-in session (${size})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const username = `ui${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
    const password = 'Quartz!River7-Cobalt';
    expect((await page.request.post('/api/register/', { data: { username, password } })).status()).toBe(201);
    await page.goto('/login');
    await page.locator('#login-username').fill(username);
    await page.locator('#login-password').fill(password);
    await submitLogin(page);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Select theme' }).selectOption(theme);
    let requests = 0;
    await page.route('**/api/cheatsheets/', route => {
      requests++;
      return requests === 1 ? route.fulfill({ status: 503, json: { detail: 'Injected list failure' } }) : route.continue();
    });
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('alert')).toHaveText('Error: Failed to load cheat sheets');
    await page.getByRole('button', { name: 'Retry', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText("You haven't saved any cheat sheets yet.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(requests).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('keyboard and pointer resizing preserve layout across themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const subject = page.getByRole('button', { name: 'Resize subject panel', exact: true });
  await subject.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('editorPanelLayout')).leftWidth)).toBe(300);
  await page.keyboard.press('ArrowLeft');
  const box = await subject.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('editorPanelLayout')).leftWidth)).toBe(300);
  await page.getByRole('button', { name: 'Resize video panel', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('editorPanelLayout')).rightWidth)).toBe(280);

  await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate / Regenerate', exact: true }).click();
  await expect(page.locator('.pdf-page canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Show LaTeX editor', exact: true }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('editorPanelLayout')).latexWidth);
  await page.getByRole('button', { name: 'Resize LaTeX panel', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('editorPanelLayout')).latexWidth)).toBe(before - 20);
  for (const theme of ['light', 'dark', 'miami', 'forest', 'coolGrey', 'neon', 'galaxy', 'crimson', 'blossom']) {
    await page.getByRole('combobox', { name: 'Select theme' }).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByLabel('Generated LaTeX Code:')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
