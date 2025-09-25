export const runtime = 'nodejs';

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

    // Process each image request sequentially to avoid rate limits
    for (const item of batch) {
      const { page, prompt, style, size = '1024x1024', sourceB64 } = item;

      if (!prompt) {
        console.error(`No prompt provided for page ${page}`);
        results.push({ page, error: 'No prompt provided' });
        continue;
      }

      try {
        // Enhanced prompt with style and formatting guidelines
        const enhancedPrompt = `${prompt}. Style: ${style}. Palette: deep-navy, candlelight-amber, peach-coral accents, soft edges, picture-book lighting. No text, no watermarks, child-friendly, gentle faces, cozy compositions.`;

        let imageResponse;

        if (sourceB64) {
          // Use image edit endpoint when source image is provided
          const formData = new FormData();

          // Convert base64 to blob
          const imageBuffer = Buffer.from(sourceB64, 'base64');
          const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

          formData.append('model', 'gpt-image-1');
          formData.append('prompt', enhancedPrompt);
          formData.append('image', imageBlob, 'source.png');
          formData.append('size', size);

          imageResponse = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
            cache: 'no-store',
          });
        } else {
          // Use regular generation endpoint when no source image
          imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'dall-e-2',
              prompt: enhancedPrompt,
              size: size,
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

        if (sourceB64) {
          // For edit endpoint, response is binary image data
          const imgArrayBuffer = await imageResponse.arrayBuffer();
          const imgBase64 = Buffer.from(imgArrayBuffer).toString('base64');
          results.push({ page, b64: imgBase64 });
        } else {
          // For generation endpoint, response is JSON with URL
          const imageResult = await imageResponse.json();
          const imageUrl = imageResult.data?.[0]?.url;

          if (!imageUrl) {
            console.error(`No image returned for page ${page}`);
            results.push({ page, error: 'No image returned' });
            continue;
          }

          // Fetch the image and convert to base64
          const imgResponse = await fetch(imageUrl);
          const imgArrayBuffer = await imgResponse.arrayBuffer();
          const imgBase64 = Buffer.from(imgArrayBuffer).toString('base64');
          results.push({ page, b64: imgBase64 });
        }

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