import { expect } from '@playwright/test';

export async function submitLogin(page) {
  const [request] = await Promise.all([
    page.waitForRequest(request => new URL(request.url()).pathname === '/api/token/' && request.method() === 'POST'),
    page.getByRole('button', { name: 'Log In', exact: true }).click(),
  ]);
  const response = await request.response();
  expect(response, 'Sign-in token request failed before a response').not.toBeNull();
  expect(response.status(), 'Sign-in token response must be HTTP 200').toBe(200);
}
