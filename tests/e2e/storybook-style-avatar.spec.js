import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Storybook Avatar Style Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/storybook');
    await page.waitForLoadState('networkidle');
  });

  const createTestImage = () => {
    // Create a small test image (1x1 pixel PNG)
    const testImagePath = path.join(process.cwd(), 'test-avatar-image.png');
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, testImageBuffer);
    return testImagePath;
  };

  const cleanupTestImage = (testImagePath) => {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  };

  test('should use Whimsical watercolor style for avatar generation', async ({ page }) => {
    const testImagePath = createTestImage();
    let capturedRequest = null;

    try {
      // Mock the API response and capture the request
      await page.route('/api/generate', async route => {
        const request = route.request();
        const formData = await request.postData();
        capturedRequest = {
          method: request.method(),
          postData: formData
        };

        // Create a fake 1024x1536 PNG response
        const fakeImageBuffer = Buffer.alloc(1000, 0x89); // Fake PNG data
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: fakeImageBuffer,
        });
      });

      // Select Whimsical watercolor (should be selected by default)
      const watercolorTile = page.locator('[role=\"radio\"][aria-label=\"Whimsical watercolor\"]');
      await watercolorTile.click();
      await expect(watercolorTile).toHaveAttribute('aria-checked', 'true');

      // Upload the test image
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for avatar to appear
      await page.waitForSelector('img[alt=\"Generated character avatar\"]', { timeout: 15000 });
      const avatarImg = page.locator('img[alt=\"Generated character avatar\"]');

      // Check data-style attribute
      await expect(avatarImg).toHaveAttribute('data-style', 'Whimsical watercolor');

      // Verify the API request contained the correct style and size
      expect(capturedRequest).toBeTruthy();
      expect(capturedRequest.postData).toContain('Whimsical watercolor');
      expect(capturedRequest.postData).toContain('1024x1536');

      // Check natural dimensions (after image loads)
      const dimensions = await avatarImg.evaluate((img) => ({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      }));

      // Allow 1px tolerance for dimensions
      expect(Math.abs(dimensions.naturalWidth - 1024)).toBeLessThanOrEqual(1);
      expect(Math.abs(dimensions.naturalHeight - 1536)).toBeLessThanOrEqual(1);
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should regenerate avatar with Modern 3D rendered style', async ({ page }) => {
    const testImagePath = createTestImage();
    let requestCount = 0;
    let lastPrompt = '';

    try {
      await page.route('/api/generate', async route => {
        requestCount++;
        const request = route.request();
        const formData = await request.postData();

        // Extract prompt to verify it includes style
        if (formData && formData.includes('Modern 3D rendered')) {
          lastPrompt = formData;
        }

        const fakeImageBuffer = Buffer.alloc(1000 + requestCount * 10, 0x89); // Different response each time
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: fakeImageBuffer,
        });
      });

      // First upload with default style (Whimsical watercolor)
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for avatar to appear
      await page.waitForSelector('img[alt=\"Generated character avatar\"]', { timeout: 15000 });
      const avatarImg = page.locator('img[alt=\"Generated character avatar\"]');
      const originalSrc = await avatarImg.getAttribute('src');

      // Switch to Modern 3D rendered
      const modernTile = page.locator('[role=\"radio\"][aria-label=\"Modern 3D rendered\"]');
      await modernTile.click();
      await expect(modernTile).toHaveAttribute('aria-checked', 'true');

      // Click regenerate button
      const regenerateButton = page.locator('button', { hasText: 'Regenerate' });
      await regenerateButton.click();

      // Wait for new avatar and verify it changed
      await page.waitForFunction((originalSrc) => {
        const img = document.querySelector('img[alt=\"Generated character avatar\"]');
        return img && img.src !== originalSrc;
      }, originalSrc, { timeout: 15000 });

      // Check new data-style attribute
      await expect(avatarImg).toHaveAttribute('data-style', 'Modern 3D rendered');

      // Verify the prompt included the selected style
      expect(lastPrompt).toContain('Modern 3D rendered');
      expect(requestCount).toBe(2);
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should use Comic graphic style correctly', async ({ page }) => {
    const testImagePath = createTestImage();
    let capturedPrompt = '';

    try {
      await page.route('/api/generate', async route => {
        const request = route.request();
        const formData = await request.postData();
        capturedPrompt = formData;

        const fakeImageBuffer = Buffer.alloc(1500, 0x89);
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: fakeImageBuffer,
        });
      });

      // Select Comic / graphic style
      const comicTile = page.locator('[role=\"radio\"][aria-label=\"Comic / graphic style\"]');
      await comicTile.click();
      await expect(comicTile).toHaveAttribute('aria-checked', 'true');

      // Upload the test image
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for avatar to appear
      await page.waitForSelector('img[alt=\"Generated character avatar\"]', { timeout: 15000 });
      const avatarImg = page.locator('img[alt=\"Generated character avatar\"]');

      // Check data-style attribute
      await expect(avatarImg).toHaveAttribute('data-style', 'Comic / graphic style');

      // Verify the prompt contains the robust template
      expect(capturedPrompt).toContain('Comic / graphic style');
      expect(capturedPrompt).toContain('Stylize strongly away from photorealism');
      expect(capturedPrompt).toContain('No text, no watermark, not photographic');
      expect(capturedPrompt).toContain('1024x1536');
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should intercept API request with correct parameters', async ({ page }) => {
    const testImagePath = createTestImage();
    let interceptedRequest = null;

    try {
      await page.route('/api/generate', async route => {
        const request = route.request();
        interceptedRequest = {
          method: request.method(),
          url: request.url(),
          headers: request.headers(),
          postData: await request.postData()
        };

        const fakeImageBuffer = Buffer.alloc(1000, 0x89);
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: fakeImageBuffer,
        });
      });

      // Select 2D digital style
      const digitalTile = page.locator('[role=\"radio\"][aria-label=\"2D digital illustration\"]');
      await digitalTile.click();

      // Upload test image
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for request
      await page.waitForSelector('img[alt=\"Generated character avatar\"]', { timeout: 15000 });

      // Verify request structure
      expect(interceptedRequest).toBeTruthy();
      expect(interceptedRequest.method).toBe('POST');
      expect(interceptedRequest.url).toContain('/api/generate');

      // Check multipart form data contains correct fields
      const postData = interceptedRequest.postData;
      expect(postData).toContain('Content-Disposition: form-data; name=\"image\"');
      expect(postData).toContain('Content-Disposition: form-data; name=\"prompt\"');
      expect(postData).toContain('Content-Disposition: form-data; name=\"size\"');
      expect(postData).toContain('2D digital illustration');
      expect(postData).toContain('1024x1536');
    } finally {
      cleanupTestImage(testImagePath);
    }
  });
});