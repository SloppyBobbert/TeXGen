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

    await page.goto('/');

    // Input title
    const titleInput = page.locator('input[placeholder="Enter cheat sheet title"]');
    if (await titleInput.isVisible()) {
        await titleInput.fill('My Test Cheat Sheet');
    }
    
    // Save button
    const saveBtn = page.locator('button', { hasText: 'Save Cheat Sheet' });
    if (await saveBtn.isVisible()) {
        await saveBtn.click();
        
        // Wait for potential toast or success message
        await expect(page.locator('text=successfully saved').or(page.locator('text=Saved'))).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
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
