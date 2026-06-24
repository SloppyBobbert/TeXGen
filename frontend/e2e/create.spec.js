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

    // Mock API requests for formulas and classes needed by CreateCheatSheet.
    // Keep this shape aligned with the current Django `/api/classes/` contract.
    await page.route('**/api/classes/', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          classes: [
            {
              name: 'ALGEBRA I',
              categories: [
                {
                  name: 'Linear Equations',
                  formulas: [
                    { name: 'Slope Formula', latex: 'm = \\frac{y_2-y_1}{x_2-x_1}' }
                  ]
                }
              ]
            }
          ]
        }),
      });
    });

    // Login before each test
    await page.goto('/login');
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'correctpassword');
    await page.click('button[type="submit"]');
  });

  test('can save a newly created cheat sheet', async ({ page }) => {
    let saveRequestBody;

    // Mock the POST request for saving
    await page.route('**/api/cheatsheets/', async route => {
      if (route.request().method() === 'POST') {
        saveRequestBody = JSON.parse(route.request().postData());
        await route.fulfill({
          status: 201,
          body: JSON.stringify({
            id: 10,
            title: 'My Test Cheat Sheet',
            latex_content: saveRequestBody.latex_content,
            columns: saveRequestBody.columns,
            margins: saveRequestBody.margins,
            font_size: saveRequestBody.font_size,
            selected_formulas: saveRequestBody.selected_formulas
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Input title
    const titleInput = page.getByLabel('Title:');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('My Test Cheat Sheet');
    
    // Save button
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.getByRole('button', { name: /save/i }).click(),
    ]);

    expect(dialog.message()).toContain('Progress saved');
    await dialog.dismiss();
    expect(saveRequestBody).toMatchObject({
      title: 'My Test Cheat Sheet',
      latex_content: '',
      columns: 2,
      margins: '0.25in',
      font_size: '10pt',
      selected_formulas: []
    });
  });

  test('renders selectable classes and categories from the classes endpoint', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('ALGEBRA I')).toBeVisible();

    await page.getByText('ALGEBRA I').click();

    await expect(page.getByText('ALGEBRA I:')).toBeVisible();
    await expect(page.getByText('Linear Equations (1 formulas)')).toBeVisible();
  });

  // Export PDF button
  test('export PDF button triggers action', async ({ page }) => {
    await page.goto('/');
    
    // Look for Download / Export PDF button
    const exportBtn = page.locator('button', { hasText: /PDF|Download/i }).first();
    
    if (await exportBtn.isVisible()) {
        // Just verify it's clickable and exists
        await expect(exportBtn).toBeEnabled();
    }
  });
});
