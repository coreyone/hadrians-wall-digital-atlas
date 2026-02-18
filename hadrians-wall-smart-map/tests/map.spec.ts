import { test, expect } from '@playwright/test';

test.describe("Hadrian's Wall Smart Map E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Increase timeout and wait for any marker
    await page.waitForSelector('.maplibregl-marker', { timeout: 30000 });
  });

  test('map markers should contain valid SVG icons', async ({ page }) => {
    const markers = page.locator('.maplibregl-marker');
    const count = await markers.count();
    expect(count).toBeGreaterThan(0);

    // Check first 5 markers for SVG content
    for (let i = 0; i < Math.min(count, 5); i++) {
      const marker = markers.nth(i);
      const svg = marker.locator('svg');
      await expect(svg).toBeVisible();
      
      const pathCount = await svg.locator('path, circle, polyline, line').count();
      expect(pathCount).toBeGreaterThan(0);
    }
  });

  test('clicking a marker should open details in sidebar', async ({ page }) => {
    const poiMarker = page.locator('.poi-marker').first();
    await poiMarker.click();
    
    const sidebar = page.locator('aside');
    await expect(sidebar).toContainText(/Back/i);
  });
});
