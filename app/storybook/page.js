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
  const [illustrateLoading, setIllustrateLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Avatar generation state
  const [referenceFile, setReferenceFile] = useState(null);
  const [avatarURL, setAvatarURL] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

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

  async function generateAvatarFromReference(file) {
    if (!file) return;

    setAvatarBusy(true);
    setAvatarError(null);

    try {
      // Convert file to PNG if it's not already
      const pngFile = file.type === 'image/png' ? file : await convertToPNG(file);

      const fd = new FormData();
      fd.append('image', pngFile, 'avatar-source.png');
      fd.append('prompt', 'Create a clean, child storybook-style character avatar of the person in the source photo. Preserve identifying traits (face shape, skin tone, hair color/style, glasses, accessories). Gentle, friendly proportions, soft colors, simple neutral background, clear silhouette, front-facing, no text.');
      fd.append('size', '1024x1024');

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: fd,
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Avatar generation failed');
      }

      const blob = await response.blob();

      // Cleanup old avatar URL
      if (avatarURL) {
        URL.revokeObjectURL(avatarURL);
      }

      const url = URL.createObjectURL(blob);
      setAvatarURL(url);
    } catch (error) {
      console.error('Avatar generation failed:', error);
      setAvatarError(error.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function handleReferenceFileChange(e) {
    const file = e.target.files?.[0] || null;
    setReferenceFile(file);

    if (file) {
      generateAvatarFromReference(file);
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
      generateAvatarFromReference(referenceFile);
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
    };
  }, [images, avatarURL]);

  // Convert URL to base64
  async function urlToBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:image/png;base64, prefix
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  async function illustrateAll() {
    if (!story?.pages || story.pages.length === 0) return;

    // Check if avatar exists
    if (!avatarURL) {
      alert('Please upload a reference photo so the avatar can be created before generating illustrations.');
      return;
    }

    setIllustrateLoading(true);
    setProgress({ current: 0, total: story.pages.length });

    try {
      const newImages = { ...images };
      let previousPageB64 = await urlToBase64(avatarURL); // Start with avatar for cover

      // Generate pages sequentially
      for (let i = 0; i < story.pages.length; i++) {
        const page = story.pages[i];
        setProgress({ current: i, total: story.pages.length });

        let prompt;
        let sourceB64 = null;

        if (page.page === 1) {
          // Cover page - use avatar as source
          prompt = `Design a warm, inviting picture-book cover featuring the generated avatar as the main character. Include the story title "${story.title}" in storybook style lettering at the top. Include the text "Created by Bright Kids AI" at the bottom. Cohesive palette and layout. Clear, readable typography.`;
          sourceB64 = previousPageB64;
        } else {
          // Subsequent pages - use previous page as source for consistency
          prompt = `Keep the same main character(s) and visual style as the previous page image (hair, clothing, skin tone, proportions, palette). Now depict: ${page.illustrationPrompt}.`;
          sourceB64 = previousPageB64;
        }

        const batch = [{
          page: page.page,
          prompt: prompt,
          style: page.style,
          size: '1024x1024',
          sourceB64: sourceB64
        }];

        const response = await fetch('/api/storybook/image', {
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
          // Cleanup old image URL if exists
          if (newImages[result.page]) {
            URL.revokeObjectURL(newImages[result.page]);
          }

          // Convert base64 to blob URL
          const byteCharacters = atob(result.b64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });
          const imageURL = URL.createObjectURL(blob);
          newImages[result.page] = imageURL;

          // Update previousPageB64 for next iteration
          previousPageB64 = result.b64;
        } else if (result.error) {
          console.error(`Failed to generate image for page ${result.page}:`, result.error);
          throw new Error(`Failed to generate image for page ${result.page}: ${result.error}`);
        }

        // Small delay between requests
        if (i < story.pages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress({ current: story.pages.length, total: story.pages.length });
      setImages(newImages);
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

      const response = await fetch('/api/storybook/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: [{
            page: pageData.page,
            prompt: pageData.illustrationPrompt,
            style: pageData.style,
            size: '1024x1024'
          }]
        })
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

        // Convert base64 to blob URL
        const byteCharacters = atob(result.b64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        setImages(prev => ({
          ...prev,
          [page]: URL.createObjectURL(blob)
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

  async function exportToPDF() {
    if (!story) return;

    try {
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Title page
      const titlePage = pdfDoc.addPage([612, 792]); // Letter size
      const titlePageHeight = titlePage.getHeight();
      const titlePageWidth = titlePage.getWidth();

      // Title
      const titleFontSize = 32;
      const titleWidth = helveticaBoldFont.widthOfTextAtSize(story.title, titleFontSize);
      titlePage.drawText(story.title, {
        x: (titlePageWidth - titleWidth) / 2,
        y: titlePageHeight - 150,
        size: titleFontSize,
        font: helveticaBoldFont,
        color: rgb(0.2, 0.2, 0.3),
      });

      // Dedication
      if (story.dedication) {
        const dedicationFontSize = 16;
        const dedicationLines = story.dedication.match(/.{1,50}(\s|$)/g) || [story.dedication];
        dedicationLines.forEach((line, index) => {
          const lineWidth = helveticaFont.widthOfTextAtSize(line.trim(), dedicationFontSize);
          titlePage.drawText(line.trim(), {
            x: (titlePageWidth - lineWidth) / 2,
            y: titlePageHeight - 250 - (index * 25),
            size: dedicationFontSize,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.5),
          });
        });
      }

      // Story pages
      for (const page of story.pages) {
        const storyPage = pdfDoc.addPage([612, 792]);
        const pageHeight = storyPage.getHeight();
        const pageWidth = storyPage.getWidth();

        // Add image if available
        if (images[page.page]) {
          try {
            const imageResponse = await fetch(images[page.page]);
            const imageBytes = await imageResponse.arrayBuffer();
            const image = await pdfDoc.embedPng(imageBytes);

            const imageDims = image.scale(0.5); // Scale down to fit nicely
            const imageX = (pageWidth - imageDims.width) / 2;
            const imageY = pageHeight - 100 - imageDims.height;

            storyPage.drawImage(image, {
              x: imageX,
              y: imageY,
              width: imageDims.width,
              height: imageDims.height,
            });
          } catch (imageError) {
            console.error('Error embedding image for page', page.page, imageError);
          }
        }

        // Add text
        const textFontSize = 16;
        const maxWidth = 500;
        const words = page.text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = helveticaFont.widthOfTextAtSize(testLine, textFontSize);

          if (testWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);

        lines.forEach((line, index) => {
          const lineWidth = helveticaFont.widthOfTextAtSize(line, textFontSize);
          storyPage.drawText(line, {
            x: (pageWidth - lineWidth) / 2,
            y: pageHeight - 600 - (index * 25),
            size: textFontSize,
            font: helveticaFont,
            color: rgb(0.2, 0.2, 0.3),
          });
        });

        // Page number
        const pageNumText = `Page ${page.page}`;
        const pageNumWidth = helveticaFont.widthOfTextAtSize(pageNumText, 12);
        storyPage.drawText(pageNumText, {
          x: (pageWidth - pageNumWidth) / 2,
          y: 50,
          size: 12,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.7),
        });
      }

      // Affirmation page
      if (story.affirmation) {
        const affirmationPage = pdfDoc.addPage([612, 792]);
        const pageHeight = affirmationPage.getHeight();
        const pageWidth = affirmationPage.getWidth();

        const affirmationFontSize = 20;
        const affirmationLines = story.affirmation.match(/.{1,40}(\s|$)/g) || [story.affirmation];

        affirmationLines.forEach((line, index) => {
          const lineWidth = helveticaBoldFont.widthOfTextAtSize(line.trim(), affirmationFontSize);
          affirmationPage.drawText(line.trim(), {
            x: (pageWidth - lineWidth) / 2,
            y: pageHeight - 300 - (index * 30),
            size: affirmationFontSize,
            font: helveticaBoldFont,
            color: rgb(0.8, 0.4, 0.2), // Warm orange
          });
        });
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
    if (!story || Object.keys(images).length === 0) {
      alert('No images to export. Please generate illustrations first.');
      return;
    }

    try {
      const zip = new JSZip();

      // Add each image to the ZIP
      for (const [pageNum, imageUrl] of Object.entries(images)) {
        if (imageUrl) {
          const response = await fetch(imageUrl);
          const imageBlob = await response.blob();
          zip.file(`page-${String(pageNum).padStart(2, '0')}.png`, imageBlob);
        }
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
                  <label htmlFor="illustrationStyle">Illustration style</label>
                  <select
                    id="illustrationStyle"
                    value={style.illustrationStyle}
                    onChange={(e) => setStyle({...style, illustrationStyle: e.target.value})}
                  >
                    <option value="Whimsical watercolor">Whimsical watercolor</option>
                    <option value="Soft pastel">Soft pastel</option>
                    <option value="Cozy pencil sketch">Cozy pencil sketch</option>
                    <option value="Gentle digital art">Gentle digital art</option>
                  </select>
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

                  <div className="meta" style={{fontSize: '12px', marginBottom: '12px'}}>Your avatar sets the character look for the cover and all pages.</div>

                  {avatarBusy && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
                      <div style={{width: '16px', height: '16px', border: '2px solid var(--wendy-accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                      <span style={{fontSize: '12px'}}>Generating avatar...</span>
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
                        style={{maxWidth: '240px', height: 'auto', borderRadius: '8px', border: '1px solid #2a3a52'}}
                      />
                      <div className="meta" style={{fontSize: '11px', marginTop: '4px'}}>This avatar will be used for the cover and to keep characters consistent.</div>
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

                  {story.dedication && (
                    <div style={{padding: '16px', fontStyle: 'italic', textAlign: 'center', marginTop: '16px'}}>
                      {story.dedication}
                    </div>
                  )}

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
                    <button className="btn secondary" onClick={exportImages} disabled={Object.keys(images).length === 0}>
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