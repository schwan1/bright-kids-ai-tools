import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Storybook Cover-Avatar Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/storybook');
    await page.waitForLoadState('networkidle');
  });

  const createTestImage = () => {
    const testImagePath = path.join(process.cwd(), 'test-cover-image.png');
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

  test('should generate cover on photo upload with selected style', async ({ page }) => {
    const testImagePath = createTestImage();
    let capturedRequest = null;

    try {
      // Mock storybook image API (for cover generation)
      await page.route('/api/storybook/image', async route => {
        const request = route.request();
        const requestBody = await request.postDataJSON();
        capturedRequest = requestBody;

        // Return a fake cover image
        const fakeImageB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ page: 1, b64: fakeImageB64 }]
          })
        });
      });

      // Select Modern 3D style
      const modernTile = page.locator('[role="radio"][aria-label="Modern 3D rendered"]');
      await modernTile.click();
      await expect(modernTile).toHaveAttribute('aria-checked', 'true');

      // Upload the test image
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for avatar to appear (derived from cover)
      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });
      const avatarImg = page.locator('img[alt="Generated character avatar"]');

      // Verify cover generation API was called with correct parameters
      expect(capturedRequest).toBeTruthy();
      expect(capturedRequest.batch[0].prompt).toContain('Modern 3D rendered');
      expect(capturedRequest.batch[0].size).toBe('1024x1536');
      expect(capturedRequest.batch[0].sourceB64).toBeTruthy();

      // Check avatar attributes and source
      await expect(avatarImg).toHaveAttribute('data-source', 'cover-derived');
      await expect(avatarImg).toHaveAttribute('data-style', 'Modern 3D rendered');
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should derive avatar from generated cover', async ({ page }) => {
    const testImagePath = createTestImage();

    try {
      // Mock storybook image API
      await page.route('/api/storybook/image', async route => {
        const fakeImageB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ page: 1, b64: fakeImageB64 }]
          })
        });
      });

      // Upload photo
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for avatar to appear (derived from cover)
      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });

      // Check that avatar appears after cover
      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });
      const avatarImg = page.locator('img[alt="Generated character avatar"]');

      // Verify avatar has cover-derived data attribute
      await expect(avatarImg).toHaveAttribute('data-source', 'cover-derived');

      // Check avatar dimensions (should be 2:3)
      const avatarDimensions = await avatarImg.evaluate((img) => ({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      }));

      const aspectRatio = avatarDimensions.naturalWidth / avatarDimensions.naturalHeight;
      const expectedAspectRatio = 2/3;
      const tolerance = 0.01;

      expect(Math.abs(aspectRatio - expectedAspectRatio)).toBeLessThan(tolerance);
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should regenerate cover with style changes', async ({ page }) => {
    const testImagePath = createTestImage();
    let requestCount = 0;
    let lastStyle = '';

    try {
      await page.route('/api/storybook/image', async route => {
        requestCount++;
        const request = route.request();
        const requestBody = await request.postDataJSON();

        if (requestBody.batch[0].prompt) {
          // Extract style from prompt
          const prompt = requestBody.batch[0].prompt;
          if (prompt.includes('Whimsical watercolor')) lastStyle = 'Whimsical watercolor';
          if (prompt.includes('Comic / graphic style')) lastStyle = 'Comic / graphic style';
        }

        const fakeImageB64 = Buffer.alloc(100 + requestCount, 0x89).toString('base64');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ page: 1, b64: fakeImageB64 }]
          })
        });
      });

      // Upload photo with default style (Whimsical watercolor)
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for initial avatar (derived from cover)
      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });
      const avatarImg = page.locator('img[alt="Generated character avatar"]');
      const originalSrc = await avatarImg.getAttribute('src');

      // Switch to Comic style
      const comicTile = page.locator('[role="radio"][aria-label="Comic / graphic style"]');
      await comicTile.click();
      await expect(comicTile).toHaveAttribute('aria-checked', 'true');

      // Click regenerate button (should now be "Regenerate" for avatar)
      const regenerateButton = page.locator('button', { hasText: 'Regenerate' });
      await regenerateButton.click();

      // Wait for cover to change
      await page.waitForFunction((originalSrc) => {
        const img = document.querySelector('img[alt="Generated character avatar"]');
        return img && img.src !== originalSrc;
      }, originalSrc, { timeout: 30000 });

      // Verify the new request used Comic style
      expect(lastStyle).toBe('Comic / graphic style');
      expect(requestCount).toBe(2);
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should maintain style consistency in sequential page generation', async ({ page }) => {
    const testImagePath = createTestImage();
    let apiCalls = [];

    try {
      // Mock text generation API
      await page.route('/api/storybook/text', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            title: 'Test Story',
            pages: [
              {
                page: 1,
                text: 'Cover page text...',
                illustrationPrompt: 'Cover scene',
                style: 'Comic / graphic style'
              },
              {
                page: 2,
                text: 'Page 2 text...',
                illustrationPrompt: 'Forest scene',
                style: 'Comic / graphic style'
              },
              {
                page: 3,
                text: 'Page 3 text...',
                illustrationPrompt: 'Mountain scene',
                style: 'Comic / graphic style'
              }
            ]
          })
        });
      });

      // Mock image generation API
      await page.route('/api/storybook/image', async route => {
        const request = route.request();
        const requestBody = await request.postDataJSON();
        apiCalls.push(requestBody);

        const results = requestBody.batch.map((item, index) => ({
          page: item.page || (index + 1),
          b64: Buffer.alloc(100 + item.page, 0x89).toString('base64')
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results })
        });
      });

      // Select Comic style and upload photo
      const comicTile = page.locator('[role="radio"][aria-label="Comic / graphic style"]');
      await comicTile.click();

      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Wait for avatar generation (cover is generated behind the scenes)
      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });

      // Fill form and generate story
      await page.fill('#name', 'Test Child');
      await page.fill('#challenge', 'Test challenge');
      await page.click('button', { hasText: 'Draft the story' });

      // Wait for story to appear
      await expect(page.locator('h3', { hasText: 'Test Story' })).toBeVisible({ timeout: 15000 });

      // Click "Illustrate all"
      await page.click('button', { hasText: 'Illustrate all' });
      await page.waitForTimeout(2000);

      // Verify sequential generation started from cover
      expect(apiCalls.length).toBeGreaterThanOrEqual(2); // Cover + at least one sequential call

      // Check that the cover API call included sourceB64 (reference photo)
      const coverCall = apiCalls[0];
      expect(coverCall.batch[0].sourceB64).toBeTruthy();
      expect(coverCall.batch[0].style).toBe('Comic / graphic style');

      // Check sequential pages used previousPageB64
      if (apiCalls.length > 1) {
        const sequentialCall = apiCalls[1];
        expect(sequentialCall.batch[0].previousPageB64).toBeTruthy();
        expect(sequentialCall.batch[0].style).toBe('Comic / graphic style');
      }
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should handle cover generation errors gracefully', async ({ page }) => {
    const testImagePath = createTestImage();

    try {
      // Mock API to return error
      await page.route('/api/storybook/image', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Cover generation failed' })
        });
      });

      // Upload photo
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      // Should show error message
      await expect(page.locator('div', { hasText: 'Error: Cover generation failed' })).toBeVisible({ timeout: 10000 });

      // Avatar should not appear (cover generation failed)
      await expect(page.locator('img[alt="Generated character avatar"]')).not.toBeVisible();
    } finally {
      cleanupTestImage(testImagePath);
    }
  });

  test('should validate 2:3 aspect ratio enforcement across all generated images', async ({ page }) => {
    const testImagePath = createTestImage();
    const generatedImages = [];

    try {
      // Mock all image APIs
      await page.route('/api/storybook/text', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            title: 'Test Story',
            pages: [
              { page: 1, text: 'Cover', illustrationPrompt: 'Cover scene', style: 'Whimsical watercolor' },
              { page: 2, text: 'Page 2', illustrationPrompt: 'Scene 2', style: 'Whimsical watercolor' }
            ]
          })
        });
      });

      await page.route('/api/storybook/image', async route => {
        const request = route.request();
        const requestBody = await request.postDataJSON();

        // Verify all requests specify 1024x1536
        requestBody.batch.forEach(item => {
          expect(item.size).toBe('1024x1536');
        });

        const results = requestBody.batch.map(item => ({
          page: item.page,
          b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results })
        });
      });

      // Upload photo and generate story
      const fileInput = page.locator('#referencePhoto');
      await fileInput.setInputFiles(testImagePath);

      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });

      await page.fill('#name', 'Test Child');
      await page.fill('#challenge', 'Test challenge');
      await page.click('button', { hasText: 'Draft the story' });

      await expect(page.locator('h3', { hasText: 'Test Story' })).toBeVisible({ timeout: 15000 });
      await page.click('button', { hasText: 'Illustrate all' });

      // Wait for all images to load
      await page.waitForSelector('img[alt="Generated character avatar"]', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Check all generated images have 2:3 aspect ratio
      const allImages = page.locator('img[src*="blob:"]');
      const imageCount = await allImages.count();

      for (let i = 0; i < imageCount; i++) {
        const img = allImages.nth(i);
        const dimensions = await img.evaluate((el) => ({
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight
        }));

        if (dimensions.naturalWidth > 0 && dimensions.naturalHeight > 0) {
          const aspectRatio = dimensions.naturalWidth / dimensions.naturalHeight;
          const expectedAspectRatio = 2/3;
          const tolerance = 0.01;

          expect(Math.abs(aspectRatio - expectedAspectRatio)).toBeLessThan(tolerance);
        }
      }
    } finally {
      cleanupTestImage(testImagePath);
    }
  });
});