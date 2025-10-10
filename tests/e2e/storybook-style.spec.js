import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Storybook Style Selector and 2:3 Aspect Ratio Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/storybook');
    await page.waitForLoadState('networkidle');
  });

  test('should render four style tiles with correct image paths', async ({ page }) => {
    // Check that all four style tiles are rendered
    const styleTiles = page.locator('[role="radio"]');
    await expect(styleTiles).toHaveCount(4);

    // Check that each tile has an image with the correct src path
    const expectedImages = [
      '/storybook/images/traditional_watercolor.png',
      '/storybook/images/2D_digital.png',
      '/storybook/images/comic_graphic.png',
      '/storybook/images/modern_3D_rendered.png'
    ];

    for (const imageSrc of expectedImages) {
      const image = page.locator(`img[src="${imageSrc}"]`);
      await expect(image).toBeVisible();
    }
  });

  test('should show description popover on hover and focus', async ({ page }) => {
    const firstTile = page.locator('[role="radio"]').first();

    // Test hover
    await firstTile.hover();
    const tooltip = page.locator('[role="tooltip"]').first();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Traditional children\'s storybook style');

    // Move away and check tooltip disappears
    await page.mouse.move(0, 0);
    await expect(tooltip).not.toBeVisible();

    // Test focus
    await firstTile.focus();
    await expect(tooltip).toBeVisible();

    // Blur and check tooltip disappears
    await page.keyboard.press('Tab');
    await expect(tooltip).not.toBeVisible();
  });

  test('should toggle selection state with mouse clicks', async ({ page }) => {
    const styleTiles = page.locator('[role="radio"]');

    // First tile should be selected by default (Whimsical watercolor)
    await expect(styleTiles.first()).toHaveAttribute('aria-checked', 'true');

    // Click second tile
    await styleTiles.nth(1).click();
    await expect(styleTiles.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(styleTiles.first()).toHaveAttribute('aria-checked', 'false');

    // Click third tile
    await styleTiles.nth(2).click();
    await expect(styleTiles.nth(2)).toHaveAttribute('aria-checked', 'true');
    await expect(styleTiles.nth(1)).toHaveAttribute('aria-checked', 'false');
  });

  test('should toggle selection state with keyboard navigation', async ({ page }) => {
    const styleTiles = page.locator('[role="radio"]');

    // Focus first tile and press Enter
    await styleTiles.first().focus();
    await expect(styleTiles.first()).toHaveAttribute('aria-checked', 'true');

    // Tab to second tile and press Space
    await page.keyboard.press('Tab');
    await page.keyboard.press(' ');
    await expect(styleTiles.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(styleTiles.first()).toHaveAttribute('aria-checked', 'false');
  });

  test('should generate avatar with 2:3 aspect ratio when reference photo uploaded', async ({ page }) => {
    // Create a small test image (1x1 pixel PNG)
    const testImagePath = path.join(process.cwd(), 'test-image.png');
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, testImageBuffer);

    // Mock the API response to return a fake 2:3 image
    await page.route('/api/generate', async route => {
      // Create a fake 1024x1536 PNG response
      const fakeImageBuffer = Buffer.alloc(100, 0x89); // Fake PNG data
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: fakeImageBuffer,
      });
    });

    // Upload the test image
    const fileInput = page.locator('#referencePhoto');
    await fileInput.setInputFiles(testImagePath);

    // Wait for avatar to appear
    const avatarImg = page.locator('img[alt="Generated character avatar"]');
    await expect(avatarImg).toBeVisible({ timeout: 10000 });

    // Check that the image has the correct dimensions or aspect ratio
    const dimensions = await avatarImg.evaluate((img) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: img.width,
      height: img.height
    }));

    // Allow for some tolerance in aspect ratio calculation
    const aspectRatio = dimensions.naturalWidth / dimensions.naturalHeight;
    const expectedAspectRatio = 2/3;
    const tolerance = 0.01;

    expect(Math.abs(aspectRatio - expectedAspectRatio)).toBeLessThan(tolerance);

    // Clean up
    fs.unlinkSync(testImagePath);
  });

  test('should regenerate avatar with current style', async ({ page }) => {
    // Create a test image
    const testImagePath = path.join(process.cwd(), 'test-image.png');
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, testImageBuffer);

    let requestCount = 0;
    let lastPrompt = '';

    await page.route('/api/generate', async route => {
      requestCount++;
      const request = route.request();
      const formData = await request.postData();

      // Extract prompt to verify it includes style
      if (formData && formData.includes('prompt')) {
        const matches = formData.match(/name="prompt"[^]*?Content-Disposition/);
        if (matches) {
          lastPrompt = matches[0];
        }
      }

      const fakeImageBuffer = Buffer.alloc(100 + requestCount, 0x89); // Different response each time
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: fakeImageBuffer,
      });
    });

    // Upload the test image
    const fileInput = page.locator('#referencePhoto');
    await fileInput.setInputFiles(testImagePath);

    // Wait for avatar to appear
    const avatarImg = page.locator('img[alt="Generated character avatar"]');
    await expect(avatarImg).toBeVisible({ timeout: 10000 });
    const originalSrc = await avatarImg.getAttribute('src');

    // Change style to 2D Digital
    const styleTiles = page.locator('[role="radio"]');
    await styleTiles.nth(1).click(); // 2D digital

    // Click regenerate button
    const regenerateButton = page.locator('button', { hasText: 'Regenerate' });
    await regenerateButton.click();

    // Wait for new avatar and verify it changed
    await page.waitForFunction((originalSrc) => {
      const img = document.querySelector('img[alt="Generated character avatar"]');
      return img && img.src !== originalSrc;
    }, originalSrc, { timeout: 10000 });

    // Verify the prompt included the selected style
    expect(lastPrompt).toContain('2D digital illustration');
    expect(requestCount).toBe(2);

    // Clean up
    fs.unlinkSync(testImagePath);
  });

  test('should generate page illustrations with 2:3 aspect ratio', async ({ page }) => {
    // Mock API responses
    await page.route('/api/storybook/text', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Test Story',
          pages: [
            {
              page: 1,
              text: 'Once upon a time...',
              illustrationPrompt: 'A magical forest scene',
              style: 'Whimsical watercolor'
            }
          ]
        }),
      });
    });

    await page.route('/api/storybook/image', async route => {
      const request = route.request();
      const requestBody = await request.postDataJSON();

      // Verify size is 1024x1536
      expect(requestBody.batch[0].size).toBe('1024x1536');

      const fakeImageB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ page: 1, b64: fakeImageB64 }]
        }),
      });
    });

    // Fill in required form fields
    await page.fill('#name', 'Test Child');
    await page.fill('#challenge', 'Test challenge');

    // Generate story
    await page.click('button', { hasText: 'Draft the story' });

    // Wait for story to appear
    await expect(page.locator('h3', { hasText: 'Test Story' })).toBeVisible({ timeout: 10000 });

    // Click illustrate page
    await page.click('button', { hasText: 'Illustrate page' });

    // Wait for page image to appear
    const pageImg = page.locator('.imgwrap img');
    await expect(pageImg).toBeVisible({ timeout: 10000 });

    // Check aspect ratio
    const dimensions = await pageImg.evaluate((img) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    }));

    const aspectRatio = dimensions.naturalWidth / dimensions.naturalHeight;
    const expectedAspectRatio = 2/3;
    const tolerance = 0.01;

    expect(Math.abs(aspectRatio - expectedAspectRatio)).toBeLessThan(tolerance);
  });

  test('should include selected style in API requests', async ({ page }) => {
    let capturedRequest = null;

    // Capture storybook image requests
    await page.route('/api/storybook/image', async route => {
      capturedRequest = await route.request().postDataJSON();

      const fakeImageB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ page: 1, b64: fakeImageB64 }]
        }),
      });
    });

    await page.route('/api/storybook/text', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Test Story',
          pages: [
            {
              page: 1,
              text: 'Once upon a time...',
              illustrationPrompt: 'A magical forest scene'
            }
          ]
        }),
      });
    });

    // Change to Comic style
    const styleTiles = page.locator('[role="radio"]');
    await styleTiles.nth(2).click(); // Comic / graphic style

    // Fill form and generate story
    await page.fill('#name', 'Test Child');
    await page.fill('#challenge', 'Test challenge');
    await page.click('button', { hasText: 'Draft the story' });

    await expect(page.locator('h3', { hasText: 'Test Story' })).toBeVisible({ timeout: 10000 });

    // Click illustrate page
    await page.click('button', { hasText: 'Illustrate page' });
    await page.waitForTimeout(1000); // Give time for request

    // Verify the request included the selected style
    expect(capturedRequest).toBeTruthy();
    expect(capturedRequest.batch[0].style).toBe('Comic / graphic style');
    expect(capturedRequest.batch[0].size).toBe('1024x1536');
  });
});