import { test, expect } from '@playwright/test';

test.describe('Create Cheat Sheet Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the token endpoint to auto-login
    await page.route('**/api/token/', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIn0.signature',
          refresh: 'fakerefreshtoken'
        }),
      });
    });

    // Mock API requests for formulas and classes needed by CreateCheatSheet
    await page.route('**/api/classes/', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ classes: [
          { name: 'Algebra I', categories: [{ name: 'Linear Equations', formulas: [
            { id: 'algebra-i.slope-intercept-form', name: 'Slope-Intercept Form' },
          ] }] },
        ] }),
      });
    });

    // Login before each test
    await page.goto('/login');
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'correctpassword');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);
  });

  test('can save a newly created cheat sheet', async ({ page }) => {
    // Mock the POST request for saving
    await page.route('**/api/cheatsheets/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ id: 10, title: 'My Test Cheat Sheet' })
        });
      } else {
        await route.continue();
      }
    });

    // Stay on the login redirect: a full navigation clears the memory-only token.
    const titleInput = page.locator('#title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('My Test Cheat Sheet');
    const saveBtn = page.getByTitle('Save (Ctrl + S)');
    await expect(saveBtn).toBeVisible();
    const saved = page.waitForResponse(response => response.url().endsWith('/api/cheatsheets/')
      && response.request().method() === 'POST');
    let message;
    page.once('dialog', async dialog => {
      message = dialog.message();
      await dialog.accept();
    });
    await saveBtn.click();
    const response = await saved;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toMatchObject({
      title: 'My Test Cheat Sheet', schema_version: 1, source_mode: 'empty', source_latex: '',
      formula_selections: [],
      layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' },
    });
    await expect.poll(() => message).toBe('Progress saved!');
    await expect(page.getByText('Cheat sheet saved successfully!', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-status')).toContainText('Saved');
    await page.reload();
    await expect(titleInput).toHaveValue('My Test Cheat Sheet');
  });

  test('compiles selected formulas with the authenticated session', async ({ page }) => {
    let compileRequest = null;
    await page.route('**/api/generate-sheet/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tex_code: '\\documentclass{article}\\begin{document}Test\\end{document}' }),
      });
    });
    await page.route('**/api/compile/', async route => {
      compileRequest = route.request();
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: 'pdf' });
    });

    await page.getByRole('checkbox', { name: 'Algebra I' }).check();

    const compileButton = page.getByRole('button', { name: /Compile PDF/i });
    await expect(compileButton).toBeEnabled();
    await compileButton.click();

    await expect.poll(() => compileRequest?.headers().authorization).toBe(
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIn0.signature',
    );
    expect(JSON.parse(compileRequest.postData()).content).toContain('\\documentclass{article}');
  });
});
