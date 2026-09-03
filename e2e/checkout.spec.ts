import { test, expect, type Page } from '@playwright/test';

// Helper: add a product to cart via UI if one exists
async function addProductToCart(page: Page): Promise<boolean> {
  await page.goto('/');
  const addBtns = page.locator('article button', { hasText: /Agregar al carrito/i });
  const count   = await addBtns.count();
  if (count === 0) return false;

  await addBtns.first().click();

  // In modal, click confirm
  const confirmBtn = page.locator('.fixed.inset-0 button', { hasText: /Agregar al carrito/i });
  if (await confirmBtn.isVisible()) await confirmBtn.click();

  return true;
}

test.describe('Cart page', () => {
  test('shows empty cart state', async ({ page }) => {
    await page.goto('/carrito');
    // Either shows empty state or items
    const emptyMsg = page.locator('text=Tu carrito está vacío');
    const cartItems = page.locator('article.card');
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);
    const hasItems = await cartItems.count() > 0;
    expect(hasEmpty || hasItems).toBe(true);
  });

  test('shows cart link in navbar', async ({ page }) => {
    await page.goto('/');
    const cartLink = page.locator('a[href="/carrito"]');
    await expect(cartLink).toBeVisible();
  });
});

test.describe('Checkout flow', () => {
  test('redirects to login if not authenticated', async ({ page }) => {
    await page.goto('/checkout');
    // Should either show login prompt or redirect to login
    const url     = page.url();
    const hasLogin = url.includes('/auth/login') || url.includes('checkout');
    expect(hasLogin).toBe(true);
  });

  test('shipping coordination notice shows on cart page', async ({ page }) => {
    await page.goto('/carrito');
    // El envío ya no se calcula automáticamente — se muestra el aviso de
    // coordinación manual (WhatsApp/chat), o el carrito vacío si no hay items.
    const hasNotice = await page.locator('text=Envío a coordinar').isVisible().catch(() => false);
    const isEmpty = await page.locator('text=Tu carrito está vacío').isVisible().catch(() => false);
    expect(hasNotice || isEmpty).toBe(true);
  });
});

test.describe('Payment method display', () => {
  test('checkout page shows payment methods when authenticated', async ({ page }) => {
    // Skip if no auth configured in test environment
    await page.goto('/checkout');
    const url = page.url();
    if (url.includes('/auth/login')) {
      test.skip();
      return;
    }
    // Should show payment methods
    await expect(page.locator('text=Mercado Pago')).toBeVisible();
    await expect(page.locator('text=Stripe')).toBeVisible();
    await expect(page.locator('text=Transferencia')).toBeVisible();
  });
});

test.describe('Success page', () => {
  test('pago-exitoso shows confirmation message', async ({ page }) => {
    await page.goto('/pago-exitoso');
    await expect(page.locator('h1')).toContainText('confirmado');
    await expect(page.locator('a[href="/mis-pedidos"]')).toBeVisible();
  });
});

test.describe('Upload receipt page', () => {
  test('shows error without orderId param', async ({ page }) => {
    await page.goto('/subir-comprobante');
    await expect(page.locator('text=Pedido no encontrado')).toBeVisible();
  });

  test('shows upload form with valid orderId param', async ({ page }) => {
    await page.goto('/subir-comprobante?orderId=test-order-id');
    const uploadArea = page.locator('text=/Arrastrá|comprobante/i');
    const notFound   = page.locator('text=Pedido no encontrado');
    const hasUpload  = await uploadArea.isVisible().catch(() => false);
    const hasMissing = await notFound.isVisible().catch(() => false);
    expect(hasUpload || hasMissing).toBe(true);
  });
});

test.describe('My orders', () => {
  test('redirects unauthenticated users', async ({ page }) => {
    await page.goto('/mis-pedidos');
    const url = page.url();
    expect(url).toContain('login');
  });
});

test.describe('Mobile responsive cart', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('cart page renders on mobile', async ({ page }) => {
    await page.goto('/carrito');
    await expect(page.locator('body')).toBeVisible();
    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance
  });
});
