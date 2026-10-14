import { test, expect } from '@playwright/test';
import { submitLogin } from './helpers/submit-login.js';

for (const [size, viewport, shortcut] of [
  ['desktop', { width: 1440, height: 1000 }, 'Control+s'],
  ['mobile', { width: 390, height: 844 }, 'Meta+s'],
]) {
  test(`pending save ignores shortcuts and keeps later edits (${size})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const username = `save${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
    const password = 'Quartz!River7-Cobalt';
    expect((await page.request.post('/api/register/', { data: { username, password } })).status()).toBe(201);
    await page.goto('/login');
    await page.locator('#login-username').fill(username);
    await page.locator('#login-password').fill(password);
    await submitLogin(page);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await page.locator('#title').fill(`Save shortcut ${username}`);
    await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
    const compiled = page.waitForResponse(response => response.url().endsWith('/api/compile/')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generate / Regenerate' }).click();
    expect((await compiled).ok()).toBeTruthy();
    await page.getByRole('button', { name: 'Use raw source' }).click();
    await page.getByRole('button', { name: /Show LaTeX editor/i }).click();
    const editor = page.getByLabel('Generated LaTeX Code:');
    const original = '\\documentclass{article}\n\\begin{document}Before save\\end{document}';
    const edited = original.replace('Before save', 'Edited while saving');
    await editor.fill(original);

    let releaseResponse;
    const heldResponse = new Promise(resolve => { releaseResponse = resolve; });
    let reportCreated;
    const created = new Promise(resolve => { reportCreated = resolve; });
    let posts = 0;
    await page.route('**/api/cheatsheets/', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      posts++;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      const sheet = await response.json();
      reportCreated(sheet);
      await heldResponse;
      await route.fulfill({ response });
    });

    try {
      await page.getByTitle('Save (Ctrl + S)').click();
      const sheet = await created;
      await expect(page.getByTitle('Save (Ctrl + S)')).toBeDisabled();
      await editor.fill(edited);
      await page.keyboard.press(shortcut);
      await page.keyboard.press(shortcut);
      expect(posts).toBe(1);
      releaseResponse();
      await expect(page.getByTitle('Save (Ctrl + S)')).toBeEnabled();
      await expect(editor).toHaveValue(edited);

      const saved = page.waitForResponse(response => response.url().endsWith(`/api/cheatsheets/${sheet.id}/`)
        && response.request().method() === 'PATCH');
      await page.keyboard.press(shortcut);
      const response = await saved;
      expect(response.ok()).toBeTruthy();
      expect(await response.json()).toMatchObject({ id: sheet.id, source_latex: edited });
      await expect(page.getByTitle('Save (Ctrl + S)')).toBeEnabled();
      expect(posts).toBe(1);

      await page.getByRole('link', { name: 'Dashboard' }).click();
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(1);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByRole('button', { name: /Show LaTeX editor/i }).click();
      await expect(editor).toHaveValue(edited);
    } finally {
      releaseResponse();
    }
  });
}
