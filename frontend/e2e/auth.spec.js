import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock /api/classes/ to prevent Vite proxy ECONNREFUSED errors in the logs
  await page.route('**/api/classes/', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify([]), // Return empty array or mock classes data
    });
  });
});

test.describe('Authentication Flow', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login'); // Navigate correctly to the login page first
    
    // Check for title or specific element, adjust this to match your actual UI!
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });

  test('should show error on invalid login', async ({ page }) => {
    // Intercept the API route used for login to mock a failure
    await page.route('**/api/token/', async route => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'No active account found with the given credentials' }),
      });
    });

    await page.goto('/login'); // Assuming this is your login route

    // Fill the login form
    await page.fill('#login-username', 'wronguser'); // Adjust selector
    await page.fill('#login-password', 'wrongpassword'); // Adjust selector
    
    // Wait for the dialog and the submit click concurrently so the assertion
    // is deterministic (fails if no dialog is shown).
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[type="submit"]'), // Adjust selector if needed
    ]);
    expect(dialog.message()).toContain('No active account');
    await dialog.dismiss();
  });

  test('successful login navigates to dashboard', async ({ page }) => {
    // Mock the backend token generation
    await page.route('**/api/token/', async route => {
      await route.fulfill({
        status: 200,
        // Include a fake JWT structure. jwtDecode requires a valid structure (header.payload.signature).
        // This is a minimal valid token payload structure {"username": "testuser"} encoded:
        body: JSON.stringify({
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIn0.signature',
          refresh: 'fakerefreshtoken'
        }),
      });
    });

    await page.goto('/login');
    
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'correctpassword');
    await page.click('button[type="submit"]');

    // Wait for URL to change to the root
    await page.waitForURL('**/');

    // Default route points to CreateCheatSheet or Dashboard
    await expect(page).toHaveURL('http://localhost:5173/');
  });
});
