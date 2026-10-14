import { test, expect } from '@playwright/test';
import { submitLogin } from './helpers/submit-login.js';

for (const outcome of [200, 401, 503, 'transport-failure']) {
  test(`sign-in diagnostics distinguish ${outcome}`, async ({ page }) => {
    let requests = 0;
    await page.route('http://diagnostics.invalid/**', async route => {
      if (new URL(route.request().url()).pathname === '/api/token/') {
        requests++;
        expect(route.request().method()).toBe('POST');
        if (outcome === 'transport-failure') return route.abort('failed');
        return route.fulfill({ status: outcome, json: {} });
      }
      return route.fulfill({ contentType: 'text/html', body: '<button onclick="fetch(\'/api/token/\', {method: \'POST\'}).catch(() => {})">Log In</button>' });
    });
    await page.goto('http://diagnostics.invalid/login');
    if (outcome === 200) await submitLogin(page);
    else await expect(submitLogin(page)).rejects.toThrow(outcome === 'transport-failure'
      ? /Sign-in token request failed before a response/
      : /Sign-in token response must be HTTP 200/);
    expect(requests).toBe(1);
  });
}
