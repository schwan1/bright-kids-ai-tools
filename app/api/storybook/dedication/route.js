export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';
    let dedication, style, imageBlob;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data (binary upload - more efficient)
      const formData = await request.formData();
      dedication = formData.get('dedication');
      style = formData.get('style');
      const avatarFile = formData.get('avatar');
      
      if (!avatarFile || !avatarFile.arrayBuffer) {
        return new Response(JSON.stringify({ error: 'Avatar image required for dedication page' }), { status: 400 });
      }
      
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      imageBlob = new Blob([buffer], { type: avatarFile.type || 'image/png' });
    } else {
      // Handle JSON (base64 - backward compatible)
      const data = await request.json();
      dedication = data.dedication;
      style = data.style;
      const avatarB64 = data.avatarB64;
      
      if (!avatarB64) {
        return new Response(JSON.stringify({ error: 'Avatar image required for dedication page' }), { status: 400 });
      }
      
      const imageBuffer = Buffer.from(avatarB64, 'base64');
      imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    }

    try {
      // Get style-specific text instructions
      const textStyleInstructions = getTextStyleForDedication(style);
      
      // Create dedication page prompt
      const dedicationPrompt = `Create a beautiful children's storybook dedication page illustration featuring the same character from the provided image. The page should have:
- A gentle, heartwarming scene with the character in a peaceful, happy moment
- Soft, warm atmosphere perfect for a book dedication
- Simple, elegant background that doesn't distract from the text
- Style: ${style}
- Character positioned to leave clear space for text

COLOR PALETTE - SOFT AND WARM:
- LIGHT, warm colors: cream, pale gold, soft peach, baby blue, lavender
- Gentle, heartwarming atmosphere with plenty of light and breathing room
- Avoid dark tones - keep everything soft, bright, and inviting
- Peaceful, uplifting mood with gentle highlights

CRITICAL - ANATOMICAL CORRECTNESS:
- Character must have exactly TWO arms, TWO hands, TWO legs, TWO feet
- Proper human proportions for children's book character
- All body parts in correct positions and quantities
- No extra limbs, no missing limbs, no distorted anatomy

IMPORTANT - INCLUDE THIS TEXT IN THE IMAGE (centered in middle/upper portion):
${dedication ? `"${dedication}"` : ''}

AND AT THE BOTTOM, INCLUDE:
"Created By Bright Kids AI"

${textStyleInstructions}

CRITICAL TEXT FITTING RULES:
- ALL text must fit COMPLETELY within image boundaries
- Dedication text margins: 100px from left/right edges, 80px from top
- Dedication text: maximum 70% of image width (716px max)
- Bottom branding margins: 100px from left/right, 80px from bottom
- Break dedication into 2-3 lines if needed
- Ensure NO letters are cut off at any edge
- All text must be fully visible within the frame
- Top text (dedication) centered in upper/middle area
- Bottom text ("Created By Bright Kids AI") smaller, centered at bottom
- Leave the character visible but ensure text has prominence`;

      // Use the avatar as the source image
      const apiFormData = new FormData();

      apiFormData.append('model', 'gpt-image-1');
      apiFormData.append('prompt', dedicationPrompt);
      apiFormData.append('image', imageBlob, 'avatar.png');
      apiFormData.append('size', '1024x1536'); // 2:3 aspect ratio

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
        console.error('OpenAI API error for dedication:', imageResponse.status, errorText);
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
        dedicationImage: imgBase64,
        message: 'Dedication page generated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (generationError) {
      console.error('Dedication generation error:', generationError);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate dedication page',
        details: generationError.message 
      }), { status: 500 });
    }

  } catch (error) {
    console.error('Dedication API error:', error);
    return new Response(JSON.stringify({ error: 'Server error during dedication generation' }), { status: 500 });
  }
}

function getTextStyleForDedication(style) {
  const styleLower = (style || '').toLowerCase();
  
  if (styleLower.includes('watercolor') || styleLower.includes('traditional')) {
    return `TEXT STYLE FOR DEDICATION:
- Hand-lettered, elegant font style
- Warm, heartfelt appearance with flowing letters
- Dedication text: Medium size, centered in upper/middle area
- "Created By Bright Kids AI": Smaller, centered at bottom
- Text color: Warm READABLE tones (golden amber, warm brown, soft charcoal - NOT deep navy)
- Place on LIGHT backgrounds or add pale cream text box
- Subtle shadows or glow for readability
- Decorative flourishes or small hearts/stars around text`;
  } else if (styleLower.includes('2d digital')) {
    return `TEXT STYLE FOR DEDICATION:
- Clean, modern sans-serif font
- Friendly, rounded letters
- Dedication text: Medium size, centered in upper/middle area
- "Created By Bright Kids AI": Smaller, centered at bottom
- Text color: Dark with subtle outline
- Simple, elegant presentation`;
  } else if (styleLower.includes('comic') || styleLower.includes('graphic')) {
    return `TEXT STYLE FOR DEDICATION:
- Bold comic-style lettering
- Dedication text: Medium size, centered in upper/middle area
- "Created By Bright Kids AI": Smaller, centered at bottom
- Text color: Black with white outline
- Dynamic but heartfelt presentation`;
  } else if (styleLower.includes('3d') || styleLower.includes('modern')) {
    return `TEXT STYLE FOR DEDICATION:
- Modern, smooth 3D-looking letters
- Dedication text: Medium size, centered in upper/middle area
- "Created By Bright Kids AI": Smaller, centered at bottom
- Polished, contemporary appearance
- Subtle depth and glow effects`;
  }
  
  return `TEXT STYLE FOR DEDICATION:
- Clear, elegant children's book font
- Dedication text: Medium size, centered in upper/middle area
- "Created By Bright Kids AI": Smaller, centered at bottom
- High contrast with background for readability`;
}

