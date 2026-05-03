import { test, expect } from '@playwright/test';

test.describe('Dashboard Flow', () => {
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

    // Login before each test
    await page.goto('/login');
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'correctpassword');
    await page.click('button[type="submit"]');
  });

  test('should display empty state when no sheets exist', async ({ page }) => {
    // Mock classes data
    await page.route('**/api/classes/', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    // Mock empty cheat sheets
    await page.route('**/api/cheatsheets/', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([])
      });
    });

    // Navigate to dashboard via the new link to preserve in-memory auth state
    await page.click('text=Dashboard');
    
    await expect(page.locator('h2', { hasText: 'My Cheat Sheets' })).toBeVisible();
    await expect(page.locator('text=You haven\'t saved any cheat sheets yet.')).toBeVisible();
  });

  test('should display saved cheat sheets', async ({ page }) => {
    // Mock classes data
    await page.route('**/api/classes/', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    // Mock cheat sheets with data
    await page.route('**/api/cheatsheets/', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: 1, title: 'Calculus Final', created_at: '2026-05-01', updated_at: '2026-05-02' },
          { id: 2, title: 'Physics Midterm', created_at: '2026-04-10', updated_at: '2026-04-15' }
        ])
      });
    });

    // Navigate to dashboard via the new link to preserve in-memory auth state
    await page.click('text=Dashboard');
    
    // Check that both sheet cards are rendered
    await expect(page.locator('.sheet-card')).toHaveCount(2);
    await expect(page.locator('h3', { hasText: 'Calculus Final' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Physics Midterm' })).toBeVisible();
  });

  test('create new sheet button navigates to creator', async ({ page }) => {
    await page.route('**/api/classes/', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.route('**/api/cheatsheets/', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.click('text=Dashboard');
    await page.click('button:has-text("Create Your First Sheet")');
    
    // Should navigate to root/creator
    await expect(page).toHaveURL('http://localhost:5173/');
  });
});
