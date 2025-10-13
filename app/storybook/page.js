'use client';
import { useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

export default function StorybookPage() {
  const [childInfo, setChildInfo] = useState({
    name: '',
    age: 5,
    interests: '',
    readingLevel: 'Pre-reader',
    sensitivities: ''
  });

  const [goal, setGoal] = useState({
    challenge: '',
    context: '',
    tone: 'Gentle',
    learningFocus: ''
  });

  const [style, setStyle] = useState({
    illustrationStyle: 'Whimsical watercolor',
    pageCount: 10,
    includeAffirmation: true,
    dedication: ''
  });

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState({});
  const [coverImage, setCoverImage] = useState(null);
  const [dedicationImage, setDedicationImage] = useState(null);
  const [illustrateLoading, setIllustrateLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Avatar generation state
  const [referenceFile, setReferenceFile] = useState(null);
  const [avatarURL, setAvatarURL] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoveredStyle, setHoveredStyle] = useState(null);
  const [avatarMeta, setAvatarMeta] = useState(null);
  const [avatarDescription, setAvatarDescription] = useState('');
  const [avatarFromDescBusy, setAvatarFromDescBusy] = useState(false);

  // Auto-regenerate avatar when style changes
  useEffect(() => {
    if (avatarURL && !avatarBusy && !avatarFromDescBusy) {
      if (referenceFile) {
        console.log('Style changed to:', style.illustrationStyle, '- regenerating avatar from reference');
        generateAvatarFromReference(referenceFile, style.illustrationStyle);
      } else if (avatarDescription.trim()) {
        console.log('Style changed to:', style.illustrationStyle, '- regenerating avatar from description');
        generateAvatarFromDescription(avatarDescription, style.illustrationStyle);
      }
    }
  }, [style.illustrationStyle]);

  // Convert any image file to PNG format with size optimization
  function convertToPNG(file) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate dimensions to keep under 4MB while maintaining quality
        let { width, height } = img;
        const maxDimension = 1024; // Reasonable max for avatar generation

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Set canvas dimensions to optimized size
        canvas.width = width;
        canvas.height = height;

        // Draw image to canvas with optimized dimensions
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to PNG blob with compression
        canvas.toBlob((blob) => {
          // Check if blob is under 4MB (OpenAI limit)
          if (blob.size > 4 * 1024 * 1024) {
            // If still too large, try with more compression
            const smallerCanvas = document.createElement('canvas');
            const smallerCtx = smallerCanvas.getContext('2d');
            const reducedSize = Math.min(512, Math.min(width, height));
            const reducedRatio = reducedSize / Math.max(width, height);

            smallerCanvas.width = Math.round(width * reducedRatio);
            smallerCanvas.height = Math.round(height * reducedRatio);
            smallerCtx.drawImage(img, 0, 0, smallerCanvas.width, smallerCanvas.height);

            smallerCanvas.toBlob(resolve, 'image/png', 0.8);
          } else {
            resolve(blob);
          }
        }, 'image/png', 0.9);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // Returns a DATA URL to avoid blob URL invalidation during dev/HMR
  async function enforceAspectRatioToDataUrl(input) {
    return new Promise(async (resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        const targetWidth = 1024;
        const targetHeight = 1536;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Normalize input to an image src string
        let src;
        if (typeof input === 'string') {
          // data: URL or blob: URL
          src = input;
        } else if (input instanceof Blob) {
          src = URL.createObjectURL(input);
        } else {
          return reject(new Error('Unsupported input to enforceAspectRatioToDataUrl'));
        }

        img.onload = () => {
          const currentAspect = img.naturalWidth / img.naturalHeight;
          const targetAspect = targetWidth / targetHeight;

          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          let drawWidth, drawHeight, offsetX, offsetY;
          if (currentAspect > targetAspect) {
            drawHeight = targetHeight;
            drawWidth = drawHeight * currentAspect;
            offsetX = (targetWidth - drawWidth) / 2;
            offsetY = 0;
          } else {
            drawWidth = targetWidth;
            drawHeight = drawWidth / currentAspect;
            offsetX = 0;
            offsetY = (targetHeight - drawHeight) / 2;
          }

          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
          const dataUrl = canvas.toDataURL('image/png', 0.95);
          resolve(dataUrl);

          if (src.startsWith('blob:')) {
            URL.revokeObjectURL(src);
          }
        };

        img.onerror = reject;
        img.src = src;
      } catch (e) {
        reject(e);
      }
    });
  }

  // Helper function to get style image path
  function getStyleImagePath(styleName) {
    const styleMap = {
      'Whimsical watercolor': '/storybook/images/traditional_watercolor.png',
      '2D digital illustration': '/storybook/images/2D_digital.png',
      'Comic / graphic style': '/storybook/images/comic_graphic.png',
      'Modern 3D rendered': '/storybook/images/modern_3D_rendered.png'
    };
    return styleMap[styleName] || '/storybook/images/traditional_watercolor.png';
  }

  // Helper function to load style image as base64
  async function loadStyleImageAsBase64(imagePath) {
    const response = await fetch(imagePath);
    const blob = await response.blob();
    return urlToBase64(URL.createObjectURL(blob));
  }

  // Derive avatar from cover image by cropping to character-centric view
  function deriveAvatarFromCover(coverImageURL) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Set canvas to target avatar dimensions (1024x1536)
        canvas.width = 1024;
        canvas.height = 1536;

        // Calculate center-biased crop (75% of minimum dimension, centered)
        const cropRatio = 0.75;
        const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
        const cropSize = sourceSize * cropRatio;
        const offsetX = (img.naturalWidth - cropSize) / 2;
        const offsetY = (img.naturalHeight - cropSize) / 2;

        // Draw cropped and scaled image
        ctx.drawImage(
          img,
          offsetX, offsetY, cropSize, cropSize, // Source rectangle
          0, 0, canvas.width, canvas.height // Destination rectangle
        );

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 0.95);
      };

      img.onerror = reject;
      img.src = coverImageURL;
    });
  }

  async function generateAvatarFromReference(file, currentStyle) {
    if (!file) return;

    setAvatarBusy(true);
    setAvatarError(null);

    try {
      // Convert file to PNG and get base64
      const pngFile = file.type === 'image/png' ? file : await convertToPNG(file);
      const sourceB64 = await urlToBase64(URL.createObjectURL(pngFile));

      // Load the selected style tile image as base
      const styleImagePath = getStyleImagePath(currentStyle);
      const styleImageB64 = await loadStyleImageAsBase64(styleImagePath);

      // Compose avatar prompt - transform the person's photo to match the target style
      const avatarPrompt = `Transform this person into ${currentStyle} children's book illustration style. Keep their key facial features, hair color/style, skin tone, and any accessories like glasses. Create a warm, friendly children's book character with a cozy background scene. Style should match: ${currentStyle}. No text, no watermarks.`;

      // Generate avatar by transforming the person's photo to match the style
      const batch = [{
        page: 1,
        prompt: avatarPrompt,
        style: currentStyle,
        size: '1024x1536',
        sourceB64: sourceB64,
        styleBaseB64: styleImageB64
      }];

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Avatar generation API error:', response.status, error);
        throw new Error(error.error || `Avatar generation failed (${response.status})`);
      }

      const data = await response.json();
      const result = data.results[0];

      if (result.b64) {
        console.log('Received base64 data, length:', result.b64.length);
        console.log('Base64 starts with:', result.b64.substring(0, 50));

        try {
          // Enforce 2:3 (1024x1536) and store as DATA URL to avoid blob invalidation
          const srcDataUrl = `data:image/png;base64,${result.b64}`;
          const fixedDataUrl = await enforceAspectRatioToDataUrl(srcDataUrl);

          // Cleanup old avatar URL if it was a blob URL
          if (avatarURL && avatarURL.startsWith('blob:')) {
            URL.revokeObjectURL(avatarURL);
          }

          setAvatarURL(fixedDataUrl);

          // Store metadata for testability
          setAvatarMeta({
            styleUsed: currentStyle,
            width: 1024,
            height: 1536,
            source: 'style-based'
          });

          console.log('Avatar generated successfully with style:', currentStyle);

          // Clear any previous errors
          setAvatarError(null);
        } catch (conversionError) {
          console.error('Error converting base64 to blob:', conversionError);
          throw new Error('Failed to process avatar image');
        }
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Avatar generation failed:', error);
      setAvatarError(error.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function generateAvatarFromDescription(description, currentStyle) {
    const desc = (description || '').trim();
    if (!desc) {
      alert('Please enter a child description first.');
      return;
    }

    setAvatarFromDescBusy(true);
    setAvatarError(null);

    try {
      const styleImagePath = getStyleImagePath(currentStyle);
      const styleImageB64 = await loadStyleImageAsBase64(styleImagePath);

      const avatarPrompt =
        `Create a front-facing, friendly child character portrait (waist-up or full-body) in ${currentStyle} children's book style. ` +
        `Base the appearance on this description: ${desc}. Ensure natural proportions (two arms, two legs, five fingers per hand), ` +
        `a consistent look for future pages (hair, skin tone, face shape, clothing colors), soft cheerful palette, and a clean background. ` +
        `No text, no watermarks, no borders.`;

      const batch = [{
        page: 1,
        prompt: avatarPrompt,
        style: currentStyle,
        size: '1024x1536',
        // Use the selected style tile as the 'source' so we go through the edits endpoint
        sourceB64: styleImageB64,
        styleBaseB64: styleImageB64
      }];

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Avatar generation failed (${response.status})`);
      }

      const data = await response.json();
      const result = data.results[0];

      if (result.b64) {
        const srcDataUrl = `data:image/png;base64,${result.b64}`;
        const fixedDataUrl = await enforceAspectRatioToDataUrl(srcDataUrl);

        if (avatarURL && avatarURL.startsWith('blob:')) {
          URL.revokeObjectURL(avatarURL);
        }

        setAvatarURL(fixedDataUrl);
        setReferenceFile(null);
        setAvatarMeta({
          styleUsed: currentStyle,
          width: 1024,
          height: 1536,
          source: 'description'
        });
        setAvatarError(null);
        console.log('Avatar generated successfully from description with style:', currentStyle);
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Avatar (description) generation failed:', err);
      setAvatarError(err.message);
    } finally {
      setAvatarFromDescBusy(false);
    }
  }

  function handleReferenceFileChange(e) {
    const file = e.target.files?.[0] || null;
    setReferenceFile(file);

    if (file) {
      generateAvatarFromReference(file, style.illustrationStyle);
    } else {
      // Clear avatar if no file
      if (avatarURL) {
        URL.revokeObjectURL(avatarURL);
      }
      setAvatarURL(null);
      setAvatarError(null);
    }
  }

  function regenerateAvatar() {
    if (referenceFile) {
      generateAvatarFromReference(referenceFile, style.illustrationStyle);
    } else if (avatarDescription.trim()) {
      generateAvatarFromDescription(avatarDescription, style.illustrationStyle);
    }
  }

  function validateInputs() {
    const errors = [];

    if (!childInfo.name.trim()) {
      errors.push("Child's name is required");
    }

    if (childInfo.age < 2 || childInfo.age > 10) {
      errors.push("Age must be between 2 and 10 years");
    }

    if (!goal.challenge.trim()) {
      errors.push("Challenge or situation is required");
    }

    if (style.pageCount < 6 || style.pageCount > 12) {
      errors.push("Page count must be between 6 and 12");
    }

    // Basic content safety checks
    const unsafeTerms = ['violent', 'scary', 'horror', 'death', 'kill', 'weapon', 'gun', 'knife', 'blood'];
    const textToCheck = `${goal.challenge} ${goal.context}`.toLowerCase();

    for (const term of unsafeTerms) {
      if (textToCheck.includes(term)) {
        errors.push("Please use gentle, age-appropriate themes suitable for children's stories");
        break;
      }
    }

    return errors;
  }

  async function draftStory() {
    const validationErrors = validateInputs();
    if (validationErrors.length > 0) {
      alert('Please fix the following issues:\n\n' + validationErrors.join('\n'));
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        child: {
          ...childInfo,
          interests: childInfo.interests.split(',').map(s => s.trim()).filter(Boolean),
          sensitivities: childInfo.sensitivities.split(',').map(s => s.trim()).filter(Boolean)
        },
        goal: {
          ...goal,
          learningFocus: goal.learningFocus.split(',').map(s => s.trim()).filter(Boolean)
        },
        style
      };

      const response = await fetch('/api/storybook/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate story');
      }

      const storyData = await response.json();
      setStory(storyData);
    } catch (error) {
      console.error('Story generation failed:', error);
      alert('Story generation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(images).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      if (avatarURL && typeof avatarURL === 'string' && avatarURL.startsWith('blob:')) {
        URL.revokeObjectURL(avatarURL);
      }
      if (coverImage && typeof coverImage === 'string' && coverImage.startsWith('blob:')) {
        URL.revokeObjectURL(coverImage);
      }
      if (dedicationImage && typeof dedicationImage === 'string' && dedicationImage.startsWith('blob:')) {
        URL.revokeObjectURL(dedicationImage);
      }
    };
  }, [images, avatarURL, coverImage, dedicationImage]);

  // Convert URL to base64
  async function urlToBase64(url) {
    // Fast path for data URLs
    if (typeof url === 'string' && url.startsWith('data:image')) {
      return url.split(',')[1];
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1]; // Remove data:image/png;base64, prefix
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      throw new Error('Could not read image data; the URL may be invalidated. Please regenerate the image.');
    }
  }

  async function generateCover() {
    if (!story || !avatarURL) {
      alert('Please generate a story and avatar first before creating the cover.');
      return;
    }

    setIllustrateLoading(true);
    try {
      // Get avatar as base64
      const avatarB64 = await urlToBase64(avatarURL);

      const response = await fetch('/api/storybook/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          childName: childInfo.name,
          avatarB64: avatarB64,
          style: style.illustrationStyle
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate cover');
      }

      const data = await response.json();
      
      if (data.coverImage) {
        // Cleanup old cover if exists
        if (coverImage && coverImage.startsWith('blob:')) {
          URL.revokeObjectURL(coverImage);
        }

        // Enforce 2:3 (1024x1536) and store as DATA URL
        const fixedDataUrl = await enforceAspectRatioToDataUrl(`data:image/png;base64,${data.coverImage}`);
        setCoverImage(fixedDataUrl);
        console.log('Cover generated successfully');
      }
    } catch (error) {
      console.error('Cover generation failed:', error);
      alert('Cover generation failed: ' + error.message);
    } finally {
      setIllustrateLoading(false);
    }
  }

  async function generateDedication() {
    if (!story || !avatarURL) {
      alert('Please generate a story and avatar first before creating the dedication page.');
      return;
    }

    setIllustrateLoading(true);
    try {
      // Get avatar as base64
      const avatarB64 = await urlToBase64(avatarURL);

      const response = await fetch('/api/storybook/dedication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dedication: story.dedication || style.dedication || `For ${childInfo.name}, with love`,
          avatarB64: avatarB64,
          style: style.illustrationStyle
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate dedication page');
      }

      const data = await response.json();
      
      if (data.dedicationImage) {
        // Cleanup old dedication if exists
        if (dedicationImage && dedicationImage.startsWith('blob:')) {
          URL.revokeObjectURL(dedicationImage);
        }

        // Enforce 2:3 (1024x1536) and store as DATA URL
        const fixedDataUrl = await enforceAspectRatioToDataUrl(`data:image/png;base64,${data.dedicationImage}`);
        setDedicationImage(fixedDataUrl);
        console.log('Dedication page generated successfully');
      }
    } catch (error) {
      console.error('Dedication generation failed:', error);
      alert('Dedication generation failed: ' + error.message);
    } finally {
      setIllustrateLoading(false);
    }
  }

  async function illustrateAll() {
    if (!story?.pages || story.pages.length === 0) return;
    if (!avatarURL) {
      alert('Please generate an avatar first before illustrating all pages.');
      return;
    }

    setIllustrateLoading(true);

    try {
      let totalSteps = 0;
      let currentStep = 0;

      // Count what needs to be generated
      const needCover = !coverImage;
      const needDedication = !dedicationImage;
      const missingPages = story.pages.filter(p => !images[p.page]);
      
      totalSteps = (needCover ? 1 : 0) + missingPages.length + (needDedication ? 1 : 0);
      setProgress({ current: 0, total: totalSteps });

      // Step 1: Generate cover if missing
      if (needCover) {
        setProgress({ current: currentStep++, total: totalSteps });
        await generateCover();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 2: Generate missing story pages sequentially
      if (missingPages.length > 0) {
        const newImages = { ...images };
        // Always use avatar as reference for all pages (not previous page)
        const avatarB64 = avatarURL ? await urlToBase64(avatarURL) : null;

        for (let i = 0; i < missingPages.length; i++) {
          const page = missingPages[i];
          setProgress({ current: currentStep++, total: totalSteps });

          // Always use avatar as the source for character consistency
          const prompt = `Keep the same main character as the provided source image (face, hair, skin tone, proportions, clothing). Now depict: ${page.illustrationPrompt}. Maintain ${page.style || style.illustrationStyle} children's book style.`;

          const batch = [{
            page: page.page,
            prompt: prompt,
            style: page.style || style.illustrationStyle,
            size: '1024x1536',
            sourceB64: avatarB64,
            pageText: page.text
          }];

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate images');
          }

          const data = await response.json();
          const result = data.results[0];

          if (result.b64) {
            if (newImages[result.page]) {
              URL.revokeObjectURL(newImages[result.page]);
            }

            const fixedDataUrl = await enforceAspectRatioToDataUrl(`data:image/png;base64,${result.b64}`);
            newImages[result.page] = fixedDataUrl;
          } else if (result.error) {
            console.error(`Failed to generate image for page ${result.page}:`, result.error);
            throw new Error(`Failed to generate image for page ${result.page}: ${result.error}`);
          }

          // Small delay between requests
          if (i < missingPages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        setImages(newImages);
      }

      // Step 3: Generate dedication if missing
      if (needDedication) {
        setProgress({ current: currentStep++, total: totalSteps });
        await generateDedication();
      }

      setProgress({ current: totalSteps, total: totalSteps });
      console.log('All illustrations generated successfully');
    } catch (error) {
      console.error('Image generation failed:', error);
      alert('Image generation failed: ' + error.message);
    } finally {
      setIllustrateLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  }

  async function illustratePage(page) {
    setIllustrateLoading(true);
    try {
      const pageData = story.pages.find(p => p.page === page);
      if (!pageData) return;

      // Always use avatar as source for character consistency
      const sourceB64 = avatarURL ? await urlToBase64(avatarURL) : null;
      const batchPayload = [{
        page: pageData.page,
        prompt: `Keep the same main character as the provided source image (face, hair, skin tone, proportions, clothing). Now depict: ${pageData.illustrationPrompt}. Maintain ${pageData.style || style.illustrationStyle} children's book style.`,
        style: pageData.style || style.illustrationStyle,
        size: '1024x1536',
        sourceB64,
        pageText: pageData.text
      }];

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchPayload })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate image');
      }

      const data = await response.json();
      const result = data.results[0];

      if (result.b64) {
        // Cleanup old image URL if exists
        if (images[page]) {
          URL.revokeObjectURL(images[page]);
        }

        // Enforce 2:3 (1024x1536) and store as DATA URL
        const fixedDataUrl = await enforceAspectRatioToDataUrl(`data:image/png;base64,${result.b64}`);
        setImages(prev => ({
          ...prev,
          [page]: fixedDataUrl
        }));
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Page illustration failed:', error);
      alert('Page illustration failed: ' + error.message);
    } finally {
      setIllustrateLoading(false);
    }
  }

  // Helper function to sanitize text for PDF (remove non-WinAnsi characters)
  function sanitizeForPDF(text) {
    if (!text) return '';
    // Replace common problematic characters
    return text
      .replace(/[""]/g, '"')  // Smart quotes to regular quotes
      .replace(/['']/g, "'")  // Smart apostrophes to regular apostrophes
      .replace(/[—–]/g, '-')  // Em/en dashes to hyphens
      .replace(/[…]/g, '...')  // Ellipsis to three dots
      .replace(/[^\x20-\x7E]/g, '');  // Remove any non-ASCII characters
  }

  async function exportToPDF() {
    if (!story) return;

    try {
      const pdfDoc = await PDFDocument.create();

      // Add cover page (image only, text is in the image)
      if (coverImage) {
        const coverPage = pdfDoc.addPage([612, 792]); // Letter size
        const pageHeight = coverPage.getHeight();
        const pageWidth = coverPage.getWidth();

        try {
          const coverResponse = await fetch(coverImage);
          const coverBytes = await coverResponse.arrayBuffer();
          const coverImgEmbed = await pdfDoc.embedPng(coverBytes);

          // Scale image to FIT within page while maintaining aspect ratio (no cropping)
          const imgAspect = coverImgEmbed.width / coverImgEmbed.height;
          const pageAspect = pageWidth / pageHeight;

          let imgWidth, imgHeight, imgX, imgY;

          if (imgAspect > pageAspect) {
            // Image is wider than page - fit by width
            imgWidth = pageWidth;
            imgHeight = imgWidth / imgAspect;
            imgX = 0;
            imgY = (pageHeight - imgHeight) / 2;
          } else {
            // Image is taller than page - fit by height
            imgHeight = pageHeight;
            imgWidth = imgHeight * imgAspect;
            imgX = (pageWidth - imgWidth) / 2;
            imgY = 0;
          }

          coverPage.drawImage(coverImgEmbed, {
            x: imgX,
            y: imgY,
            width: imgWidth,
            height: imgHeight,
          });
        } catch (coverError) {
          console.error('Error embedding cover image:', coverError);
        }
      }

      // Add story pages (images only, text is in the images)
      for (const page of story.pages) {
        if (images[page.page]) {
          const storyPage = pdfDoc.addPage([612, 792]);
          const pageHeight = storyPage.getHeight();
          const pageWidth = storyPage.getWidth();

          try {
            const imageResponse = await fetch(images[page.page]);
            const imageBytes = await imageResponse.arrayBuffer();
            const pageImage = await pdfDoc.embedPng(imageBytes);

            // Scale image to FIT within page while maintaining aspect ratio (no cropping)
            const imgAspect = pageImage.width / pageImage.height;
            const pageAspect = pageWidth / pageHeight;

            let imgWidth, imgHeight, imgX, imgY;

            if (imgAspect > pageAspect) {
              // Image is wider than page - fit by width
              imgWidth = pageWidth;
              imgHeight = imgWidth / imgAspect;
              imgX = 0;
              imgY = (pageHeight - imgHeight) / 2;
            } else {
              // Image is taller than page - fit by height
              imgHeight = pageHeight;
              imgWidth = imgHeight * imgAspect;
              imgX = (pageWidth - imgWidth) / 2;
              imgY = 0;
            }

            storyPage.drawImage(pageImage, {
              x: imgX,
              y: imgY,
              width: imgWidth,
              height: imgHeight,
            });
          } catch (imageError) {
            console.error('Error embedding image for page', page.page, imageError);
          }
        }
      }

      // Add dedication page (image with text, if generated)
      if (dedicationImage) {
        const dedicationPage = pdfDoc.addPage([612, 792]);
        const pageHeight = dedicationPage.getHeight();
        const pageWidth = dedicationPage.getWidth();

        try {
          const dedicationResponse = await fetch(dedicationImage);
          const dedicationBytes = await dedicationResponse.arrayBuffer();
          const dedicationImgEmbed = await pdfDoc.embedPng(dedicationBytes);

          // Scale image to FIT within page while maintaining aspect ratio (no cropping)
          const imgAspect = dedicationImgEmbed.width / dedicationImgEmbed.height;
          const pageAspect = pageWidth / pageHeight;

          let imgWidth, imgHeight, imgX, imgY;

          if (imgAspect > pageAspect) {
            // Image is wider than page - fit by width
            imgWidth = pageWidth;
            imgHeight = imgWidth / imgAspect;
            imgX = 0;
            imgY = (pageHeight - imgHeight) / 2;
          } else {
            // Image is taller than page - fit by height
            imgHeight = pageHeight;
            imgWidth = imgHeight * imgAspect;
            imgX = (pageWidth - imgWidth) / 2;
            imgY = 0;
          }

          dedicationPage.drawImage(dedicationImgEmbed, {
            x: imgX,
            y: imgY,
            width: imgWidth,
            height: imgHeight,
          });
        } catch (dedicationError) {
          console.error('Error embedding dedication image:', dedicationError);
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${story.title.replace(/[^a-zA-Z0-9]/g, '_')}_storybook.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export failed: ' + error.message);
    }
  }

  async function exportImages() {
    if (!story || (Object.keys(images).length === 0 && !coverImage)) {
      alert('No images to export. Please generate illustrations first.');
      return;
    }

    try {
      const zip = new JSZip();

      // Add cover image first if available
      if (coverImage) {
        const coverResponse = await fetch(coverImage);
        const coverBlob = await coverResponse.blob();
        zip.file('00-cover.png', coverBlob);
      }

      // Add each page image to the ZIP
      for (const [pageNum, imageUrl] of Object.entries(images)) {
        if (imageUrl) {
          const response = await fetch(imageUrl);
          const imageBlob = await response.blob();
          zip.file(`page-${String(pageNum).padStart(2, '0')}.png`, imageBlob);
        }
      }

      // Add dedication page last if available
      if (dedicationImage) {
        const dedicationResponse = await fetch(dedicationImage);
        const dedicationBlob = await dedicationResponse.blob();
        zip.file('99-dedication.png', dedicationBlob);
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${story.title.replace(/[^a-zA-Z0-9]/g, '_')}_images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Images export failed:', error);
      alert('Images export failed: ' + error.message);
    }
  }

  return (
    <div className="wendy">
      <div className="wrap">
        <div className="topbar">
          <a className="back" href="/">← Back to Home</a>
          <h1>📚 Wendy the Storybook Maker</h1>
        </div>
        <div className="tag">Share a little about your child. Wendy will write a loving 10‑page story and create cozy illustrations to match.</div>

        <div className="board">
          {/* Form Section */}
          <section className="card">
            <h2>Tell Wendy About Your Child</h2>

            <div style={{marginBottom: '24px'}}>
              <h3>About your child</h3>
              <div style={{display: 'grid', gap: '12px'}}>
                <div>
                  <label htmlFor="name">Child's name</label>
                  <input
                    id="name"
                    type="text"
                    value={childInfo.name}
                    onChange={(e) => setChildInfo({...childInfo, name: e.target.value})}
                    placeholder="e.g., Ava"
                  />
                </div>

                <div>
                  <label htmlFor="age">Age</label>
                  <select
                    id="age"
                    value={childInfo.age}
                    onChange={(e) => setChildInfo({...childInfo, age: Number(e.target.value)})}
                  >
                    <option value={2}>2 years old</option>
                    <option value={3}>3 years old</option>
                    <option value={4}>4 years old</option>
                    <option value={5}>5 years old</option>
                    <option value={6}>6 years old</option>
                    <option value={7}>7 years old</option>
                    <option value={8}>8 years old</option>
                    <option value={9}>9 years old</option>
                    <option value={10}>10 years old</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="interests">Interests (comma-separated)</label>
                  <input
                    id="interests"
                    type="text"
                    value={childInfo.interests}
                    onChange={(e) => setChildInfo({...childInfo, interests: e.target.value})}
                    placeholder="e.g., dinosaurs, beach, animals, art, music"
                  />
                  <div className="meta" style={{fontSize: '11px', marginTop: '4px'}}>
                    Helps Wendy weave your child's favorites into the story
                  </div>
                </div>

                <div>
                  <label htmlFor="readingLevel">Reading level</label>
                  <select
                    id="readingLevel"
                    value={childInfo.readingLevel}
                    onChange={(e) => setChildInfo({...childInfo, readingLevel: e.target.value})}
                  >
                    <option value="Pre-reader">Pre-reader</option>
                    <option value="Early reader">Early reader</option>
                    <option value="Independent reader">Independent reader</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sensitivities">Sensitivities or supports (comma-separated)</label>
                  <input
                    id="sensitivities"
                    type="text"
                    value={childInfo.sensitivities}
                    onChange={(e) => setChildInfo({...childInfo, sensitivities: e.target.value})}
                    placeholder="e.g., loud sounds, new situations"
                  />
                </div>
              </div>
            </div>

            <div style={{marginBottom: '24px'}}>
              <h3>What do you want to help with?</h3>
              <div style={{display: 'grid', gap: '12px'}}>
                <div>
                  <label htmlFor="challenge">Challenge or situation</label>
                  <input
                    id="challenge"
                    type="text"
                    value={goal.challenge}
                    onChange={(e) => setGoal({...goal, challenge: e.target.value})}
                    placeholder="e.g., First day of kindergarten jitters"
                  />
                </div>

                <div>
                  <label htmlFor="context">Context or details</label>
                  <textarea
                    id="context"
                    value={goal.context}
                    onChange={(e) => setGoal({...goal, context: e.target.value})}
                    placeholder="e.g., Worried about drop-off; new classroom"
                    style={{minHeight: '80px'}}
                  />
                </div>

                <div>
                  <label htmlFor="tone">Tone</label>
                  <select
                    id="tone"
                    value={goal.tone}
                    onChange={(e) => setGoal({...goal, tone: e.target.value})}
                  >
                    <option value="Gentle">Gentle</option>
                    <option value="Encouraging">Encouraging</option>
                    <option value="Playful">Playful</option>
                    <option value="Calm">Calm</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="learningFocus">Learning focus (comma-separated)</label>
                  <input
                    id="learningFocus"
                    type="text"
                    value={goal.learningFocus}
                    onChange={(e) => setGoal({...goal, learningFocus: e.target.value})}
                    placeholder="e.g., emotions, routines, courage"
                  />
                </div>
              </div>
            </div>

            <div style={{marginBottom: '24px'}}>
              <h3>Style & output</h3>
              <div style={{display: 'grid', gap: '12px'}}>
                <div>
                  <label id="illustrationStyleLabel">Illustration style</label>
                  <div
                    role="radiogroup"
                    aria-labelledby="illustrationStyleLabel"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '16px',
                      marginTop: '12px'
                    }}
                  >
                    {[
                      { value: 'Whimsical watercolor', image: 'traditional_watercolor.png', name: 'Traditional', description: 'Traditional children\'s storybook style with pencil‑and‑ink outlines and soft watercolor washes; warm, cozy palettes.' },
                      { value: '2D digital illustration', image: '2D_digital.png', name: '2D Digital', description: 'Bright, bold 2D cartoon style with clean outlines, flat colors, and playful character expressions.' },
                      { value: 'Comic / graphic style', image: 'comic_graphic.png', name: 'Comic Graphic', description: 'Comic book look with bold outlines, halftone textures, and dramatic contrast.' },
                      { value: 'Modern 3D rendered', image: 'modern_3D_rendered.png', name: 'Modern 3D', description: 'Modern 3D Pixar‑like rendering with soft lighting, smooth textures, and friendly rounded forms.' }
                    ].map((styleOption) => (
                      <div
                        key={styleOption.value}
                        role="radio"
                        aria-checked={style.illustrationStyle === styleOption.value}
                        aria-label={styleOption.value}
                        aria-describedby={`desc-${styleOption.value.replace(/\s+/g, '-').toLowerCase()}`}
                        aria-disabled={avatarBusy}
                        tabIndex={0}
                        onClick={() => !avatarBusy && setStyle({...style, illustrationStyle: styleOption.value})}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !avatarBusy) {
                            e.preventDefault();
                            setStyle({...style, illustrationStyle: styleOption.value});
                          }
                        }}
                        onMouseEnter={() => !avatarBusy && setHoveredStyle(styleOption.value)}
                        onMouseLeave={() => setHoveredStyle(null)}
                        onFocus={() => !avatarBusy && setHoveredStyle(styleOption.value)}
                        onBlur={() => setHoveredStyle(null)}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px',
                          borderRadius: '12px',
                          border: `2px solid ${style.illustrationStyle === styleOption.value ? 'var(--wendy-accent)' : (hoveredStyle === styleOption.value ? '#3a4a62' : '#2a3a52')}`,
                          backgroundColor: style.illustrationStyle === styleOption.value ? 'rgba(255,154,110,.1)' : (hoveredStyle === styleOption.value ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)'),
                          cursor: avatarBusy ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: style.illustrationStyle === styleOption.value ? '0 0 12px rgba(255,154,110,.3)' : 'none',
                          opacity: avatarBusy ? 0.6 : 1
                        }}
                      >
                        <div style={{
                          aspectRatio: '2/3',
                          width: '100%',
                          marginBottom: '8px'
                        }}>
                          <img
                            src={`/storybook/images/${styleOption.image}`}
                            alt=""
                            role="presentation"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: '8px'
                            }}
                          />
                        </div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          textAlign: 'center',
                          color: style.illustrationStyle === styleOption.value ? 'var(--wendy-accent)' : 'var(--text)'
                        }}>
                          {styleOption.name}
                        </div>
                        {/* Checkmark overlay for selected state */}
                        {style.illustrationStyle === styleOption.value && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--wendy-accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,.3)'
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20,6 9,17 4,12"></polyline>
                            </svg>
                          </div>
                        )}
                        {/* Visually hidden label for screen readers only */}
                        <span style={{
                          position: 'absolute',
                          width: '1px',
                          height: '1px',
                          padding: '0',
                          margin: '-1px',
                          overflow: 'hidden',
                          clip: 'rect(0, 0, 0, 0)',
                          whiteSpace: 'nowrap',
                          border: '0'
                        }}>
                          {styleOption.value}
                        </span>
                        {/* Description popover */}
                        <div
                          id={`desc-${styleOption.value.replace(/\s+/g, '-').toLowerCase()}`}
                          role="tooltip"
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            padding: '8px 12px',
                            background: 'var(--ink)',
                            border: '1px solid #2a3a52',
                            borderRadius: '8px',
                            fontSize: '12px',
                            maxWidth: '200px',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            opacity: hoveredStyle === styleOption.value ? 1 : 0,
                            visibility: hoveredStyle === styleOption.value ? 'visible' : 'hidden',
                            transition: 'opacity 0.2s ease, visibility 0.2s ease',
                            pointerEvents: 'none'
                          }}
                        >
                          {styleOption.description}
                          {/* Arrow */}
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid var(--ink)'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pageCount">Number of pages</label>
                  <select
                    id="pageCount"
                    value={style.pageCount}
                    onChange={(e) => setStyle({...style, pageCount: Number(e.target.value)})}
                  >
                    <option value={6}>6 pages</option>
                    <option value={8}>8 pages</option>
                    <option value={10}>10 pages</option>
                    <option value={12}>12 pages</option>
                  </select>
                </div>

                {/* Character Generation Section */}
                <div style={{marginTop: '20px', padding: '16px', border: '1px solid #2a3a52', borderRadius: '12px', background: 'rgba(255,154,110,.05)'}}>
                  <h3 style={{margin: '0 0 12px 0'}}>Character Generation</h3>

                  <div style={{marginBottom: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                      <label htmlFor="referencePhoto" style={{margin: 0}}>Reference photo</label>
                      <div style={{position: 'relative'}}>
                        <button
                          type="button"
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                          onFocus={() => setShowTooltip(true)}
                          onBlur={() => setShowTooltip(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--wendy-accent)',
                            cursor: 'help',
                            fontSize: '14px',
                            padding: '2px'
                          }}
                          aria-describedby="tooltip"
                        >
                          ?
                        </button>
                        {showTooltip && (
                          <div
                            id="tooltip"
                            role="tooltip"
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: '8px',
                              padding: '8px 12px',
                              background: 'var(--ink)',
                              border: '1px solid #2a3a52',
                              borderRadius: '8px',
                              fontSize: '12px',
                              maxWidth: '200px',
                              zIndex: 10,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                          >
                            We'll generate a storybook-style avatar from your photo and use it to keep characters consistent across all pages.
                          </div>
                        )}
                      </div>
                    </div>
                    <input
                      id="referencePhoto"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleReferenceFileChange}
                    />
                  </div>

                  {/* Child description alternative */}
                  <div style={{marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(42, 58, 82, 0.3)'}}>
                    <label htmlFor="childDescription" style={{display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14}}>
                      Child description (if you do not want to upload a photo)
                    </label>
                    <textarea
                      id="childDescription"
                      value={avatarDescription}
                      onChange={(e) => setAvatarDescription(e.target.value)}
                      rows={3}
                      placeholder="Example: A 6-year-old girl with short dark hair, warm brown eyes, medium-light skin, loves stars and planets, usually wears a lavender shirt and comfy jeans."
                      style={{
                        width: '100%',
                        padding: 8,
                        resize: 'vertical',
                        border: '1px solid #2a3a52',
                        borderRadius: 4,
                        fontFamily: 'inherit',
                        background: 'var(--ink)',
                        color: 'inherit'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => generateAvatarFromDescription(avatarDescription, style.illustrationStyle)}
                      disabled={!avatarDescription.trim() || avatarBusy || avatarFromDescBusy}
                      style={{
                        marginTop: 8,
                        padding: '8px 16px',
                        backgroundColor: (!avatarDescription.trim() || avatarBusy || avatarFromDescBusy) ? '#666' : 'var(--wendy-accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: (!avatarDescription.trim() || avatarBusy || avatarFromDescBusy) ? 'not-allowed' : 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {avatarFromDescBusy ? 'Generating avatar from description...' : 'Generate avatar from description'}
                    </button>
                  </div>

                  <div className="meta" style={{fontSize: '12px', marginTop: '12px', marginBottom: '12px'}}>Your avatar sets the character look for the cover and all pages.</div>

                  {avatarBusy && avatarURL && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
                      <div style={{width: '16px', height: '16px', border: '2px solid var(--wendy-accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                      <span style={{fontSize: '12px'}}>Updating avatar with new style...</span>
                    </div>
                  )}

                  {avatarBusy && !avatarURL && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
                      <div style={{width: '16px', height: '16px', border: '2px solid var(--wendy-accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                      <span style={{fontSize: '12px'}}>Generating avatar from photo...</span>
                    </div>
                  )}

                  {avatarFromDescBusy && !avatarURL && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
                      <div style={{width: '16px', height: '16px', border: '2px solid var(--wendy-accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                      <span style={{fontSize: '12px'}}>Generating avatar from description...</span>
                    </div>
                  )}

                  {avatarError && (
                    <div style={{color: '#ff6b6b', fontSize: '12px', marginBottom: '12px'}}>
                      Error: {avatarError}
                    </div>
                  )}

                  {avatarURL && (
                    <div style={{marginBottom: '12px'}}>
                      <img
                        src={avatarURL}
                        alt="Generated character avatar"
                        data-style={avatarMeta?.styleUsed}
                        data-source={avatarMeta?.source}
                        style={{maxWidth: '240px', height: 'auto', borderRadius: '8px', border: '1px solid #2a3a52'}}
                        onError={(e) => {
                          console.error('Avatar image failed to load:', avatarURL);
                          console.error('Image error event:', e);
                        }}
                        onLoad={() => {
                          console.log('Avatar image loaded successfully:', avatarURL);
                        }}
                      />
                      <div className="meta" style={{fontSize: '11px', marginTop: '4px'}}>This avatar will be used for the cover and to keep characters consistent.</div>
                    </div>
                  )}

                  {/* Debug info */}
                  {avatarURL && (
                    <div style={{fontSize: '10px', color: '#666', marginBottom: '12px'}}>
                      Debug: Avatar URL = {avatarURL.substring(0, 50)}...
                    </div>
                  )}

                  {avatarURL && (
                    <button
                      className="btn secondary"
                      onClick={regenerateAvatar}
                      disabled={avatarBusy}
                      style={{fontSize: '12px', padding: '6px 10px'}}
                    >
                      {avatarBusy ? 'Generating...' : 'Regenerate'}
                    </button>
                  )}
                </div>

                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input
                    id="includeAffirmation"
                    type="checkbox"
                    checked={style.includeAffirmation}
                    onChange={(e) => setStyle({...style, includeAffirmation: e.target.checked})}
                    aria-describedby="affirmation-help"
                  />
                  <label htmlFor="includeAffirmation">Include affirmation</label>
                  <span id="affirmation-help" className="meta" style={{fontSize: '12px'}}>
                    (Optional positive statement for your child)
                  </span>
                </div>

                <div>
                  <label htmlFor="dedication">Dedication (optional)</label>
                  <input
                    id="dedication"
                    type="text"
                    value={style.dedication}
                    onChange={(e) => setStyle({...style, dedication: e.target.value})}
                    placeholder="e.g., For Ava, who is brave and kind."
                  />
                </div>
              </div>
            </div>

            <button
              className="btn"
              onClick={draftStory}
              disabled={loading || !childInfo.name.trim() || !goal.challenge.trim()}
              style={{width: '100%'}}
              aria-describedby="draft-help"
            >
              {loading ? 'Wendy is writing...' : 'Draft the story'}
            </button>

            <div id="draft-help" className="meta" style={{marginTop: '8px', fontSize: '12px', textAlign: 'center'}}>
              Wendy does not store personal information unless you choose to save.
            </div>
          </section>

          {/* Preview Section */}
          <section className="card">
            <h2>Story Preview</h2>
            <div className="panel">
              {!story ? (
                <div className="meta" style={{textAlign: 'center', padding: '40px 20px'}}>
                  No pages yet—tell Wendy about your child to begin.
                </div>
              ) : (
                <div>
                  <h3 style={{marginTop: 0}}>{story.title}</h3>
                  {story.summary && (
                    <p className="meta" style={{marginBottom: '20px'}}>{story.summary}</p>
                  )}

                  {/* Cover Page */}
                  <div style={{marginBottom: '24px', padding: '16px', border: '2px solid var(--wendy-accent)', borderRadius: '12px', background: 'rgba(255,154,110,.05)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                      <strong style={{color: 'var(--wendy-accent)', fontSize: '16px'}}>📖 Cover Page</strong>
                      <button
                        className="btn secondary"
                        style={{fontSize: '12px', padding: '6px 10px'}}
                        onClick={generateCover}
                        disabled={illustrateLoading || !avatarURL}
                      >
                        {illustrateLoading ? 'Working...' : coverImage ? 'Regenerate cover' : 'Generate cover'}
                      </button>
                    </div>

                    <div className="imgwrap" style={{minHeight: '300px', marginBottom: '12px'}}>
                      {coverImage ? (
                        <img src={coverImage} alt={`Cover for ${story.title}`} style={{maxWidth: '100%', height: 'auto', borderRadius: '8px'}} />
                      ) : (
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--meta)'}}>
                          <span className="meta">No cover yet</span>
                          {!avatarURL && <span className="meta" style={{fontSize: '11px', marginTop: '8px'}}>Upload a reference photo first</span>}
                        </div>
                      )}
                    </div>

                    <div style={{textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,.02)', borderRadius: '8px'}}>
                      <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '8px'}}>{story.title}</div>
                      {story.dedication && (
                        <div style={{fontSize: '14px', fontStyle: 'italic', color: 'var(--meta)'}}>{story.dedication}</div>
                      )}
                    </div>
                  </div>

                  {story.pages && story.pages.map((page) => (
                    <div key={page.page} style={{marginBottom: '24px', padding: '16px', border: '1px solid #2a3a52', borderRadius: '12px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                        <strong>Page {page.page}</strong>
                        <button
                          className="btn secondary"
                          style={{fontSize: '12px', padding: '6px 10px'}}
                          onClick={() => illustratePage(page.page)}
                          disabled={illustrateLoading}
                        >
                          {illustrateLoading ? 'Working...' : 'Illustrate page'}
                        </button>
                      </div>

                      <div className="imgwrap" style={{minHeight: '200px', marginBottom: '12px'}}>
                        {images[page.page] ? (
                          <img src={images[page.page]} alt={page.alt} style={{maxWidth: '100%', height: 'auto'}} />
                        ) : (
                          <span className="meta">No image yet</span>
                        )}
                      </div>

                      <p style={{margin: 0}}>{page.text}</p>
                    </div>
                  ))}

                  {story.affirmation && (
                    <div style={{padding: '16px', background: 'rgba(255,154,110,.1)', borderRadius: '12px', marginTop: '20px'}}>
                      <strong>Affirmation:</strong> {story.affirmation}
                    </div>
                  )}

                  {/* Dedication Page */}
                  <div style={{marginBottom: '24px', padding: '16px', border: '2px solid #7bd389', borderRadius: '12px', background: 'rgba(123,211,137,.05)', marginTop: '20px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                      <strong style={{color: '#7bd389', fontSize: '16px'}}>📝 Dedication Page</strong>
                      <button
                        className="btn secondary"
                        style={{fontSize: '12px', padding: '6px 10px'}}
                        onClick={generateDedication}
                        disabled={illustrateLoading || !avatarURL || !story}
                      >
                        {illustrateLoading ? 'Working...' : dedicationImage ? 'Regenerate dedication' : 'Generate dedication'}
                      </button>
                    </div>

                    <div className="imgwrap" style={{minHeight: '300px', marginBottom: '12px'}}>
                      {dedicationImage ? (
                        <img src={dedicationImage} alt="Dedication page" style={{maxWidth: '100%', height: 'auto', borderRadius: '8px'}} />
                      ) : (
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--meta)'}}>
                          <span className="meta">No dedication page yet</span>
                          {!avatarURL && <span className="meta" style={{fontSize: '11px', marginTop: '8px'}}>Upload a reference photo first</span>}
                        </div>
                      )}
                    </div>

                    <div style={{textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,.02)', borderRadius: '8px'}}>
                      {story?.dedication || style.dedication ? (
                        <div style={{fontSize: '14px', fontStyle: 'italic', color: 'var(--text)', marginBottom: '8px'}}>{story?.dedication || style.dedication}</div>
                      ) : (
                        <div style={{fontSize: '14px', fontStyle: 'italic', color: 'var(--muted)', marginBottom: '8px'}}>For {childInfo.name}, with love</div>
                      )}
                      <div style={{fontSize: '12px', color: 'var(--wendy-accent)', fontWeight: 'bold'}}>Created By Bright Kids AI</div>
                    </div>
                  </div>

                  {illustrateLoading && progress.total > 0 && (
                    <div style={{marginTop: '16px'}}>
                      <div className="progress-container">
                        <div className="progress" style={{width: `${(progress.current / progress.total) * 100}%`}}></div>
                      </div>
                      <div className="meta" style={{textAlign: 'center', marginTop: '4px'}}>
                        Generating images... {progress.current} of {progress.total}
                      </div>
                    </div>
                  )}

                  <div className="buttons" style={{marginTop: '20px'}}>
                    <button
                      className="btn"
                      onClick={illustrateAll}
                      disabled={illustrateLoading || !story?.pages || story.pages.length === 0}
                    >
                      {illustrateLoading ? 'Illustrating...' : 'Illustrate all'}
                    </button>
                    <button className="btn secondary" onClick={exportToPDF} disabled={!story}>
                      Export PDF
                    </button>
                    <button 
                      className="btn secondary" 
                      onClick={exportImages} 
                      disabled={Object.keys(images).length === 0 && !coverImage}
                    >
                      Export images
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}