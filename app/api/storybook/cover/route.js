export const runtime = 'nodejs';

function getTextStyleForCover(style) {
  const styleLower = (style || '').toLowerCase();
  
  if (styleLower.includes('watercolor') || styleLower.includes('traditional')) {
    return `- Text style: Hand-lettered, whimsical font style like children's book titles
- Font appearance: Flowing, organic letters with soft edges, like painted by hand
- Text color: Warm READABLE tones (golden amber, warm brown, or soft charcoal - avoid deep navy)
- Place text on LIGHT background areas or add light cream/ivory text box
- Add subtle shadows or glow around text for depth
- Text should look painted/brushed, matching LIGHT watercolor aesthetic
- Consider decorative flourishes or swirls around the letters`;
  } else if (styleLower.includes('2d digital')) {
    return `- Text style: Bold, clean sans-serif font like modern children's books
- Font appearance: Rounded, friendly letters with smooth edges
- Text color: Bright, bold colors with white or light outline/stroke
- Add drop shadow for pop and readability
- Text should look crisp and digital, matching the illustration style
- Letters should be evenly spaced and perfectly aligned`;
  } else if (styleLower.includes('comic') || styleLower.includes('graphic')) {
    return `- Text style: BOLD COMIC BOOK STYLE LETTERING, ALL UPPERCASE
- Font appearance: Thick, impactful letters like superhero comics
- Text color: Black or dark color with thick white outline/stroke
- Add dynamic effects like slight tilt or impact lines
- Text should have strong presence, commanding attention
- Consider speech bubble style background or banner`;
  } else if (styleLower.includes('3d') || styleLower.includes('modern')) {
    return `- Text style: Modern, clean 3D-looking letters with depth
- Font appearance: Smooth, rounded sans-serif with dimensional quality
- Text color: Gradient or glossy finish, bright and inviting
- Add 3D depth effect with shading/highlights
- Text should look polished and contemporary
- Consider subtle glow or reflection effects`;
  }
  
  // Default
  return `- Text style: Friendly, readable children's book font
- Text color: High contrast with background for readability
- Add outline or shadow for clarity
- Text should be integrated naturally into the illustration`;
}

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';
    let title, childName, style, imageBlob;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data (binary upload - more efficient)
      const formData = await request.formData();
      title = formData.get('title');
      childName = formData.get('childName');
      style = formData.get('style');
      const avatarFile = formData.get('avatar');
      
      if (!avatarFile || !avatarFile.arrayBuffer) {
        return new Response(JSON.stringify({ error: 'Avatar image is required for cover generation' }), { status: 400 });
      }
      
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      imageBlob = new Blob([buffer], { type: avatarFile.type || 'image/png' });
    } else {
      // Handle JSON (base64 - backward compatible)
      const data = await request.json();
      title = data.title;
      childName = data.childName;
      style = data.style;
      const avatarB64 = data.avatarB64;
      
      if (!avatarB64) {
        return new Response(JSON.stringify({ error: 'Avatar image is required for cover generation' }), { status: 400 });
      }
      
      const imageBuffer = Buffer.from(avatarB64, 'base64');
      imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    }

    // Basic validation
    if (!title || !childName) {
      return new Response(JSON.stringify({ error: 'Title and child name are required' }), { status: 400 });
    }

    try {
      // Get style-specific text rendering instructions
      const textStyleInstructions = getTextStyleForCover(style);
      
      // Create a fun, storybook-style cover prompt with text integration
      const coverPrompt = `Create a whimsical children's storybook cover illustration featuring the same character from the provided image. The cover should have:
- A magical, inviting storybook scene that reflects the theme: "${title}"
- The character in a prominent, central position looking happy and excited
- A colorful, enchanting background with storybook elements (sparkles, swirls, decorative borders)
- Warm, friendly atmosphere with rich details
- Style: ${style}
- Make it look like a professional children's book cover with depth and charm

COLOR PALETTE - BRIGHT AND CHEERFUL:
- LIGHT sky (soft blue, pale lavender, or peach sunrise - NOT deep navy)
- Warm golden-yellow sunlight and highlights
- Pastel peach-pink, mint-green, cream whites as accents
- Bright, airy, magical atmosphere with plenty of light
- Avoid dark or heavy backgrounds - keep everything light and inviting

CRITICAL - ANATOMICAL CORRECTNESS:
- Character must have exactly TWO arms, TWO hands, TWO legs, TWO feet
- Proper human proportions for children's book character
- All body parts in correct positions and quantities
- No extra limbs, no missing limbs, no distorted anatomy
- Fingers clearly defined (5 per hand when visible)

IMPORTANT - INCLUDE THE TITLE TEXT IN THE IMAGE:
- Draw the title text "${title}" at the bottom third of the image
${textStyleInstructions}

CRITICAL TEXT FITTING RULES:
- ALL title text must fit COMPLETELY within image boundaries
- Leave minimum 100px margin from left and right edges
- Leave minimum 80px margin from bottom edge
- Title should be no wider than 75% of image width (768px maximum)
- Break title into 2-3 lines if needed to fit properly
- Ensure NO letters are cut off at any edge
- All text must be fully visible and readable within the frame
- Text placement: centered at bottom, leaving room for character above

- The character should be the hero of their story, front and center`;

      // Use the avatar as the source image to maintain character consistency
      const apiFormData = new FormData();

      apiFormData.append('model', 'gpt-image-1');
      apiFormData.append('prompt', coverPrompt);
      apiFormData.append('image', imageBlob, 'avatar.png');
      apiFormData.append('size', '1024x1536'); // 2:3 aspect ratio matching style images

      const imageResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: apiFormData,
        cache: 'no-store',
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error('OpenAI API error for cover:', imageResponse.status, errorText);
        return new Response(JSON.stringify({
          error: `OpenAI API error: ${imageResponse.status}`,
          details: errorText
        }), { status: imageResponse.status });
      }

      // Handle response - can be JSON or binary
      const contentType = imageResponse.headers.get('content-type') || '';
      let imgBase64;

      if (contentType.includes('application/json')) {
        const json = await imageResponse.json();
        imgBase64 = json?.data?.[0]?.b64_json;
        if (!imgBase64) {
          return new Response(JSON.stringify({ error: 'No image returned (JSON response without b64_json)' }), { status: 502 });
        }
      } else {
        const imgArrayBuffer = await imageResponse.arrayBuffer();
        imgBase64 = Buffer.from(imgArrayBuffer).toString('base64');
      }

      return new Response(JSON.stringify({ 
        coverImage: imgBase64,
        message: 'Cover generated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (generationError) {
      console.error('Cover generation error:', generationError);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate cover image',
        details: generationError.message 
      }), { status: 500 });
    }

  } catch (error) {
    console.error('Cover API error:', error);
    return new Response(JSON.stringify({ error: 'Server error during cover generation' }), { status: 500 });
  }
}

