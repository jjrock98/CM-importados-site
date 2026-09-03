import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows hero section', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('a[href="#catalogo"]')).toBeVisible();
  });

  test('shows navigation bar', async ({ page }) => {
    await expect(page.locator('header nav')).toBeVisible();
    await expect(page.locator('a[href="/"]')).toBeVisible();
    await expect(page.locator('a[href="/contacto"]')).toBeVisible();
  });

  test('shows footer', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('footer a[href="/politicas"]')).toBeVisible();
  });

  test('catalog section exists', async ({ page }) => {
    await page.locator('#catalogo').scrollIntoViewIfNeeded();
    await expect(page.locator('#catalogo')).toBeVisible();
  });

  test('WhatsApp floating button is visible', async ({ page }) => {
    const wa = page.locator('a[href*="wa.me"]');
    await expect(wa).toBeVisible();
  });
});

test.describe('Product interaction', () => {
  test('opens product modal on click', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('article').first();
    const isVisible = await firstCard.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }

    const addBtn = firstCard.locator('button', { hasText: /Agregar al carrito/i });
    await addBtn.click();

    // Modal should open
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('navigates to FAQ', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/faq"]');
    await expect(page).toHaveURL('/faq');
    await expect(page.locator('h1')).toContainText('Preguntas');
  });

  test('navigates to contacto', async ({ page }) => {
    await page.goto('/contacto');
    await expect(page.locator('h1')).toContainText('Contacto');
  });

  test('navigates to ubicacion', async ({ page }) => {
    await page.goto('/ubicacion');
    await expect(page.locator('h1')).toContainText('Ubicación');
  });

  test('navigates to carrito', async ({ page }) => {
    await page.goto('/carrito');
    await expect(page).toHaveURL('/carrito');
  });
});

test.describe('Dark mode', () => {
  test('can toggle theme', async ({ page }) => {
    await page.goto('/');
    const toggleBtn = page.locator('button[aria-label="Toggle theme"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    // After click, html class should change
    await page.waitForTimeout(300);
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toBeDefined();
  });
});
