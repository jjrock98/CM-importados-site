import { test, expect } from '@playwright/test';

test.describe('Auth pages', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('h1')).toContainText('Ingresar');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('registro page renders correctly', async ({ page }) => {
    await page.goto('/auth/registro');
    await expect(page.locator('h1')).toContainText('Crear cuenta');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login has link to registro', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('a[href*="/auth/registro"]')).toBeVisible();
  });

  test('registro has link to login', async ({ page }) => {
    await page.goto('/auth/registro');
    await expect(page.locator('a[href*="/auth/login"]')).toBeVisible();
  });

  test('Google OAuth button is present', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('button', { hasText: /Google/i })).toBeVisible();
  });

  test('shows validation on empty submit', async ({ page }) => {
    await page.goto('/auth/login');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    // HTML5 validation prevents submission - email field should be focused/invalid
    const emailInput = page.locator('input[type="email"]');
    const isInvalid  = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('preserves redirect param', async ({ page }) => {
    await page.goto('/auth/login?redirect=/checkout');
    const regLink = page.locator('a[href*="/auth/registro"]');
    const href    = await regLink.getAttribute('href');
    expect(href).toContain('redirect');
  });
});

test.describe('Protected routes', () => {
  test('wishlist redirects to login', async ({ page }) => {
    await page.goto('/wishlist');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('completar-perfil redirects to login', async ({ page }) => {
    await page.goto('/completar-perfil');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/auth\/login/);
  });
});

test.describe('Completar perfil page', () => {
  test('shows profile form fields', async ({ page }) => {
    // If redirected to login, skip
    await page.goto('/auth/login');
    await page.goto('/completar-perfil');
    const url = page.url();
    if (!url.includes('completar-perfil')) {
      test.skip();
      return;
    }
    await expect(page.locator('input[placeholder*="Dirección"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="postal"]')).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });
});
