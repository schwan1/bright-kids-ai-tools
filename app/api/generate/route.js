export const runtime = 'nodejs';

function getTextStyleForPages(style) {
  const styleLower = (style || '').toLowerCase();
  
  if (styleLower.includes('watercolor') || styleLower.includes('traditional')) {
    return `
TEXT RENDERING (at bottom of image):
- Style: Hand-lettered, storybook font like classic children's books
- Font: Flowing, organic letters with soft, painted appearance
- Color: Warm, readable tones (warm brown or deep charcoal, NOT black)
- Background: LIGHT cream or pale ivory text box with soft edges
- Add gentle shadow or glow for readability
- Text should look hand-painted, matching light watercolor style
- 2-3 lines maximum, centered at bottom

CRITICAL TEXT FITTING:
- ALL text must fit COMPLETELY within image boundaries
- Leave minimum 80px margin from left and right edges
- Leave minimum 60px margin from bottom edge
- Text box width: maximum 85% of image width (870px max)
- Break into multiple lines if needed - no single line wider than 85%
- Ensure NO letters are cut off at any edge
- All text fully visible and readable within the frame`;
  } else if (styleLower.includes('2d digital')) {
    return `
TEXT RENDERING (at bottom of image):
- Style: Bold, clean sans-serif font like modern picture books
- Font: Rounded, friendly letters, crisp and clear
- Color: Dark text with bright white outline for high contrast
- Background: Clean white or VERY light-colored text box with rounded corners
- Add subtle drop shadow for depth
- Text should be perfectly legible, digital quality
- 2-3 lines maximum, centered at bottom

CRITICAL TEXT FITTING:
- ALL text must fit COMPLETELY within image boundaries
- Leave minimum 80px margin from left and right edges
- Leave minimum 60px margin from bottom edge
- Text box width: maximum 85% of image width (870px max)
- Break into multiple lines if needed - no single line wider than 85%
- Ensure NO letters are cut off at any edge
- All text fully visible and readable within the frame`;
  } else if (styleLower.includes('comic') || styleLower.includes('graphic')) {
    return `
TEXT RENDERING (at bottom of image):
- Style: BOLD COMIC BOOK LETTERING, ALL UPPERCASE
- Font: Thick, impactful letters like comic book captions
- Color: Black text with THICK white outline/stroke
- Background: BRIGHT WHITE speech bubble or caption box with bold border
- Strong, attention-grabbing appearance
- Text should command presence like comic panels
- 2-3 lines maximum, centered at bottom

CRITICAL TEXT FITTING:
- ALL text must fit COMPLETELY within image boundaries
- Leave minimum 80px margin from left and right edges
- Leave minimum 60px margin from bottom edge
- Text box width: maximum 85% of image width (870px max)
- Break into multiple lines if needed - no single line wider than 85%
- Ensure NO letters are cut off at any edge
- All text fully visible and readable within the frame`;
  } else if (styleLower.includes('3d') || styleLower.includes('modern')) {
    return `
TEXT RENDERING (at bottom of image):
- Style: Modern, smooth sans-serif with dimensional look
- Font: Clean, rounded letters with slight 3D effect
- Color: Dark text with subtle gradient or glossy finish
- Background: VERY LIGHT, soft modern text box (pale gray or white)
- Add gentle shadow and highlight for depth
- Text should look polished and contemporary
- 2-3 lines maximum, centered at bottom

CRITICAL TEXT FITTING:
- ALL text must fit COMPLETELY within image boundaries
- Leave minimum 80px margin from left and right edges
- Leave minimum 60px margin from bottom edge
- Text box width: maximum 85% of image width (870px max)
- Break into multiple lines if needed - no single line wider than 85%
- Ensure NO letters are cut off at any edge
- All text fully visible and readable within the frame`;
  }
  
  return `
TEXT RENDERING (at bottom of image):
- Style: Clear, friendly children's book font
- Color: High contrast with background
- Background: LIGHT semi-transparent text box for readability
- 2-3 lines maximum, centered at bottom

CRITICAL TEXT FITTING:
- ALL text must fit COMPLETELY within image boundaries
- Leave minimum 80px margin from left and right edges
- Leave minimum 60px margin from bottom edge
- Text box width: maximum 85% of image width (870px max)
- Break into multiple lines if needed
- Ensure NO letters are cut off at any edge`;
}

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 });
    }

    const data = await request.json();
    const { batch } = data;

    // Basic validation
    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      return new Response(JSON.stringify({ error: 'Batch array is required' }), { status: 400 });
    }

    if (batch.length > 12) {
      return new Response(JSON.stringify({ error: 'Maximum 12 images per batch' }), { status: 400 });
    }

    const results = [];

    // Supported sizes for gpt-image-1 (square + portrait/landscape)
    const allowedSizes = new Set([
      '256x256', '512x512', '1024x1024',
      '1024x1536', '1536x1024'
    ]);
    const normalizeSize = (s) => allowedSizes.has(String(s)) ? String(s) : '1024x1536';

    // Process each image request sequentially to avoid rate limits
    for (const item of batch) {
      const { page, prompt, style, size = '1024x1536', sourceB64, styleBaseB64 } = item;
      const openAiSize = normalizeSize(size);

      if (!prompt) {
        console.error(`No prompt provided for page ${page}`);
        results.push({ page, error: 'No prompt provided' });
        continue;
      }

      try {
        // Get text styling instructions if this page has narration
        const textInstructions = item.pageText ? getTextStyleForPages(style) : '';
        
        // Enhanced prompt with style and formatting guidelines
        let enhancedPrompt = `${prompt}. Style: ${style}. 

COLOR PALETTE - BRIGHT AND LIGHT:
- Soft sky-blue, warm golden-yellow, pastel peach-pink, cream whites, gentle lavender, mint-green
- Bright, cheerful, light-filled atmosphere with plenty of white space and airy backgrounds
- Avoid deep-navy or dark heavy tones - keep everything light, bright, and inviting
- Children's book brightness: gentle pastels, sunny highlights, soft shadows
- Uplifting, cozy compositions with gentle faces

CRITICAL - ANATOMICAL CORRECTNESS:
- Characters must have exactly TWO arms, TWO hands, TWO legs, TWO feet
- Proper human proportions for children's book characters
- All body parts in correct positions and quantities
- No extra limbs, no missing limbs, no distorted anatomy
- Fingers should be clearly defined (5 per hand when visible)
- Pay careful attention to character anatomy throughout`;
        
        // Add text rendering instructions if we have page text
        if (item.pageText) {
          enhancedPrompt += `

IMPORTANT - INCLUDE THIS TEXT IN THE IMAGE:
"${item.pageText}"

${textInstructions}

The text must be clearly readable and beautifully integrated into the illustration style.`;
        } else {
          enhancedPrompt += ` No text, no watermarks.`;
        }

        let imageResponse;

        if (styleBaseB64 && sourceB64) {
          // Avatar generation: use the source image (person's photo) as base and transform to match style
          const formData = new FormData();

          // Convert base64 to blob - use source image (person's photo) as the base
          const imageBuffer = Buffer.from(sourceB64, 'base64');
          const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

          formData.append('model', 'gpt-image-1');
          formData.append('prompt', enhancedPrompt);
          formData.append('image', imageBlob, 'source.png');
          formData.append('size', openAiSize);

          imageResponse = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
            cache: 'no-store',
          });
        } else if (sourceB64) {
          // Use source image when provided (regular edit)
          const formData = new FormData();

          // Convert base64 to blob
          const imageBuffer = Buffer.from(sourceB64, 'base64');
          const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

          formData.append('model', 'gpt-image-1');
          formData.append('prompt', enhancedPrompt);
          formData.append('image', imageBlob, 'source.png');
          formData.append('size', openAiSize);

          imageResponse = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
            cache: 'no-store',
          });
        } else {
          // Use dall-e-3 for generation (supports 1024x1024, 1024x1792, 1792x1024)
          // Note: dall-e-3 doesn't support 1024x1536, so we'll generate 1024x1792 and crop
          const dalle3Size = openAiSize === '1024x1536' ? '1024x1792' : openAiSize;
          
          imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: enhancedPrompt,
              size: dalle3Size,
              quality: 'standard',
              n: 1
            }),
            cache: 'no-store',
          });
        }

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error(`OpenAI API error for page ${page}:`, imageResponse.status, errorText);
          results.push({
            page,
            error: `OpenAI API error: ${imageResponse.status}`,
            details: errorText
          });
          continue;
        }

        let imgBase64;
        
        if ((styleBaseB64 && sourceB64) || sourceB64) {
          // For edit endpoint, OpenAI can return either JSON (b64_json) or raw binary
          const contentType = imageResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await imageResponse.json();
            imgBase64 = json?.data?.[0]?.b64_json;
            if (!imgBase64) {
              results.push({ page, error: 'No image returned (JSON response without b64_json)' });
              continue;
            }
          } else {
            const imgArrayBuffer = await imageResponse.arrayBuffer();
            imgBase64 = Buffer.from(imgArrayBuffer).toString('base64');
          }
        } else {
          // gpt-image-1 generations return URL, fetch and convert to base64
          const imageResult = await imageResponse.json();
          const imageUrl = imageResult.data?.[0]?.url;
          
          if (!imageUrl) {
            console.error(`No image URL returned for page ${page}`);
            results.push({ page, error: 'No image URL returned' });
            continue;
          }

          // Fetch the image and convert to base64
          const imgResponse = await fetch(imageUrl);
          const imgArrayBuffer = await imgResponse.arrayBuffer();
          imgBase64 = Buffer.from(imgArrayBuffer).toString('base64');
        }

        results.push({ page, b64: imgBase64 });

        // Small delay between requests to be respectful to the API
        if (batch.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (itemError) {
        console.error(`Error processing page ${page}:`, itemError);
        results.push({ page, error: itemError.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(JSON.stringify({ error: 'Server error during image generation' }), { status: 500 });
  }
}
