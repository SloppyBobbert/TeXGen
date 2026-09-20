import { test, expect } from '@playwright/test';

for (const [size, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`template removal preserves edits through confirmation, undo, compile, and reload (${size})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
    const username = `sections${suffix}`;
    const password = `Sections-${suffix}-aA1!`;
    const title = `Section journey ${suffix}`;
    const registered = await page.request.post('/api/register/', { data: { username, password } });
    expect(registered.status()).toBe(201);
    const tokenResponse = await page.request.post('/api/token/', { data: { username, password } });
    expect(tokenResponse.ok()).toBeTruthy();
    const { access } = await tokenResponse.json();
    const headers = { Authorization: `Bearer ${access}` };
    const templatesResponse = await page.request.get('/api/templates/?subject=E2E%20fixture');
    expect(templatesResponse.ok()).toBeTruthy();
    const templates = await templatesResponse.json();
    const template = templates.find((item) => item.name === 'E2E safe sections');
    expect(template?.generated_sections?.version).toBe(1);
    const created = await page.request.post('/api/cheatsheets/from-template/', { headers, data: { template_id: template.id, title } });
    expect(created.status()).toBe(201);
    const sheet = await created.json();

    await page.goto('/login');
    await page.locator('#login-username').fill(username);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: /Show LaTeX editor/i }).click();
    const editor = page.getByLabel('Generated LaTeX Code:');
    await expect(editor).toHaveValue(sheet.source_latex);
    const edited = sheet.source_latex.replace('y=mx+b', 'y=mx+b+1').replace('% @texgen-section v1 begin c:', '% custom note stays\n% @texgen-section v1 begin c:');
    await editor.fill(edited);
    const order = page.getByRole('button', { name: 'Drag to reorder formulas' });
    if (await order.getAttribute('aria-expanded') === 'false') await order.click();
    const removeSlope = page.getByRole('button', { name: 'Remove Slope Formula from Linear Equations', exact: true });
    if (!await removeSlope.isVisible()) await page.locator('.class-group-header').click();
    await removeSlope.focus();
    await page.keyboard.press('Enter');
    await expect(editor).not.toHaveValue(/% Formula Block: Slope Formula/);
    await expect(editor).toHaveValue(/custom note stays/);
    const beforeConfirm = await editor.inputValue();
    const removeEdited = page.getByRole('button', { name: 'Remove Slope-Intercept Form from Linear Equations', exact: true });
    await removeEdited.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Remove edited topics?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel removal' })).toBeFocused();
    const box = await dialog.boundingBox();
    expect(box.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(editor).toHaveValue(beforeConfirm);
    await expect(removeEdited).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Remove edited topics', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(editor).not.toHaveValue(/y=mx\+b\+1/);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(editor).toHaveValue(beforeConfirm);

    const compiled = page.waitForResponse((response) => response.url().includes('/api/compile/') && response.request().method() === 'POST' && response.ok());
    await page.getByRole('button', { name: /Compile PDF/i }).click();
    await compiled;
    await expect(page.locator('.pdf-page canvas')).toBeVisible({ timeout: 60_000 });
    const saved = page.waitForResponse((response) => response.url().endsWith(`/api/cheatsheets/${sheet.id}/`) && response.request().method() === 'PATCH');
    await page.getByTitle('Save (Ctrl + S)').click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    const persisted = await response.json();
    expect(persisted.source_latex).toBe(beforeConfirm);
    expect(persisted.formula_selections).toEqual([{ formula_id: 'algebra-i.slope-intercept-form' }]);
    expect(persisted.generated_sections.baseline).not.toContain('y=mx+b+1');

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await page.locator('#login-username').fill(username);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: /Show LaTeX editor/i }).click();
    await expect(editor).toHaveValue(beforeConfirm);
    await page.getByRole('button', { name: 'Use raw source' }).click();
    await page.getByLabel('ALGEBRA I', { exact: true }).uncheck();
    await expect(editor).toHaveValue(beforeConfirm);
    await expect(page.getByRole('status')).toContainText('Source was kept unchanged');
    const rawSaved = page.waitForResponse((item) => item.url().endsWith(`/api/cheatsheets/${sheet.id}/`) && item.request().method() === 'PATCH');
    await page.getByTitle('Save (Ctrl + S)').click();
    const rawResponse = await rawSaved;
    expect(rawResponse.ok()).toBeTruthy();
    expect(await rawResponse.json()).toMatchObject({ source_mode: 'raw', source_latex: beforeConfirm, formula_selections: [] });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/dashboard');
    await page.locator('#login-username').fill(username);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: /Show LaTeX editor/i }).click();
    await expect(editor).toHaveValue(beforeConfirm);
    await expect(page.getByRole('button', { name: 'Use raw source' })).toHaveCount(0);
    expect((await page.request.delete(`/api/cheatsheets/${sheet.id}/`, { headers })).status()).toBe(204);
  });
}


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
  await expect(page.locator('.pdf-toolbar-note')).toContainText(/Page 1 of 1/, { timeout: 60_000 });
  await expect(page.locator('.pdf-page canvas')).toBeVisible({ timeout: 60_000 });
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
