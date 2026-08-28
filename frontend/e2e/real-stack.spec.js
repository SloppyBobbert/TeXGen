import { test, expect } from '@playwright/test';

test('registered user can compile, save, reload, and delete a cheat sheet', async ({ page }) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  const username = `browsergate${suffix}`;
  const password = `BrowserGate-${suffix}-aA1!`;
  const title = `Browser journey ${suffix}`;

  await page.goto('/signup');
  await page.locator('#signup-username').fill(username);
  await page.locator('#signup-password').fill(password);
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.locator('#title').fill(title);
  await page.getByLabel('UNIT CIRCLE', { exact: true }).check();

  const compileResponse = page.waitForResponse((response) => (
    response.url().includes('/api/compile/') && response.request().method() === 'POST' && response.ok()
  ));
  await page.getByRole('button', { name: 'Generate / Regenerate' }).click();
  await compileResponse;
  await expect(page.locator('.pdf-preview-stage')).toContainText(/Page 1 of 1/, { timeout: 60_000 });
  await expect(page.getByText('Saved just now')).toBeVisible({ timeout: 30_000 });

  const saveResponse = page.waitForResponse((response) => (
    response.url().includes('/api/cheatsheets/') && response.request().method() === 'POST'
  ));
  await page.locator('.workspace-topbar').getByRole('button', { name: 'Save', exact: true }).click();
  const savedSheetResponse = await saveResponse;
  expect(savedSheetResponse.ok()).toBeTruthy();
  await expect(savedSheetResponse.json()).resolves.toEqual(expect.objectContaining({ title }));

  await page.reload();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

  await page.locator('#login-username').fill(username);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  await expect(page.getByText("You haven't saved any cheat sheets yet.")).toBeVisible();
});
