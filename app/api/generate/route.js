export const runtime = 'nodejs';

// Constants
const OPENAI_API_URL = 'https://api.openai.com/v1/images/edits';
const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);
const DEFAULT_SIZE = '1024x1024';
const IMAGE_MODEL = 'gpt-image-1'; // Model for image edits

// Helper functions
function validateApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable is not set');
    throw new Error('OpenAI API key not configured');
  }
}

function validateAndNormalizeSize(size) {
  const normalizedSize = (size || DEFAULT_SIZE).toString();
  
  if (!ALLOWED_SIZES.has(normalizedSize)) {
    return DEFAULT_SIZE;
  }
  
  // Handle 'auto' size - fallback to square format
  return normalizedSize === 'auto' ? DEFAULT_SIZE : normalizedSize;
}

function createFormDataForOpenAI(prompt, image, mask, size) {
  const formData = new FormData();
  
  formData.append('model', IMAGE_MODEL);
  formData.append('prompt', prompt);
  formData.append('image', image, 'upload.png');
  formData.append('size', size);
  
  if (mask) {
    formData.append('mask', mask, 'mask.png');
  }
  
  return formData;
}

function createErrorResponse(message, status = 500, details = null) {
  const errorData = { error: message };
  if (details) {
    errorData.details = details;
    errorData.status = status;
  }
  
  return new Response(JSON.stringify(errorData), { status });
}

function createImageResponse(imageBuffer) {
  return new Response(imageBuffer, {
    headers: { 
      'Content-Type': 'image/png', 
      'Cache-Control': 'no-store' 
    },
  });
}

export async function POST(request) {
  try {
    // Validate environment setup
    validateApiKey();
    
    // Parse and validate request data
    const formData = await request.formData();
    const prompt = formData.get('prompt') || '';
    const image = formData.get('image');
    const mask = formData.get('mask');
    const requestedSize = formData.get('size');
    
    // Validate required fields
    if (!image) {
      return createErrorResponse('Image is required', 400);
    }
    
    // Normalize and validate size
    const validatedSize = validateAndNormalizeSize(requestedSize);
    
    // Prepare OpenAI API request
    const openAIFormData = createFormDataForOpenAI(prompt, image, mask, validatedSize);
    
    // Make request to OpenAI API
    const openAIResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}` 
      },
      body: openAIFormData,
      cache: 'no-store',
    });
    
    // Handle API errors
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', openAIResponse.status, errorText);
      
      return createErrorResponse(
        'OpenAI API error', 
        openAIResponse.status, 
        errorText
      );
    }
    
    // Parse and validate API response
    const responseData = await openAIResponse.json();
    const base64Image = responseData.data?.[0]?.b64_json;
    
    if (!base64Image) {
      console.error('No image data received from OpenAI API');
      return createErrorResponse('No image returned from API', 502);
    }
    
    // Convert and return image
    const imageBuffer = Buffer.from(base64Image, 'base64');
    return createImageResponse(imageBuffer);
    
  } catch (error) {
    console.error('Image generation error:', error);
    
    // Return appropriate error response based on error type
    if (error.message === 'OpenAI API key not configured') {
      return createErrorResponse(error.message, 500);
    }
    
    return createErrorResponse('Internal server error', 500);
  }
}
