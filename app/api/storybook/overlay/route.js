export const runtime = 'nodejs';

import { createCanvas, loadImage, registerFont } from 'canvas';

export async function POST(request) {
  try {
    const data = await request.json();
    const { imageB64, text, style, isCover, title } = data;

    if (!imageB64) {
      return new Response(JSON.stringify({ error: 'Image is required' }), { status: 400 });
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageB64, 'base64');
    
    // Load the image
    const image = await loadImage(imageBuffer);
    
    // Create canvas with same dimensions as image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the original image
    ctx.drawImage(image, 0, 0);

    // Configure text styling based on illustration style
    const textConfig = getTextStyleForIllustration(style, canvas.width, canvas.height);

    if (isCover && title) {
      // Render cover title
      renderCoverTitle(ctx, title, canvas.width, canvas.height, textConfig);
    } else if (text) {
      // Render story narration text
      renderNarrationText(ctx, text, canvas.width, canvas.height, textConfig);
    }

    // Convert canvas to PNG buffer
    const outputBuffer = canvas.toBuffer('image/png');
    const outputB64 = outputBuffer.toString('base64');

    return new Response(JSON.stringify({ imageB64: outputB64 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Text overlay error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to add text overlay',
      details: error.message 
    }), { status: 500 });
  }
}

function getTextStyleForIllustration(style, width, height) {
  const baseSize = Math.floor(width / 20); // Responsive to image size
  
  switch (style.toLowerCase()) {
    case 'whimsical watercolor':
    case 'traditional watercolor':
      return {
        fontFamily: 'Georgia, serif',
        fontSize: baseSize,
        titleSize: baseSize * 1.8,
        color: '#2c3e50',
        shadowColor: 'rgba(255, 255, 255, 0.8)',
        shadowBlur: 4,
        textAlign: 'center',
        lineHeight: baseSize * 1.4,
        padding: Math.floor(height * 0.05),
        backgroundOpacity: 0.75,
        backgroundColor: 'rgba(255, 250, 240, 0.85)'
      };
      
    case '2d digital illustration':
      return {
        fontFamily: 'Arial, sans-serif',
        fontSize: baseSize,
        titleSize: baseSize * 2,
        color: '#1a1a1a',
        shadowColor: 'rgba(255, 255, 255, 0.9)',
        shadowBlur: 3,
        textAlign: 'center',
        lineHeight: baseSize * 1.3,
        padding: Math.floor(height * 0.05),
        backgroundOpacity: 0.8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        strokeColor: '#ffffff',
        strokeWidth: 2
      };
      
    case 'comic / graphic style':
    case 'comic graphic':
      return {
        fontFamily: 'Impact, sans-serif',
        fontSize: baseSize,
        titleSize: baseSize * 2,
        color: '#000000',
        shadowColor: 'rgba(255, 255, 255, 1)',
        shadowBlur: 2,
        textAlign: 'center',
        lineHeight: baseSize * 1.2,
        padding: Math.floor(height * 0.05),
        backgroundOpacity: 0.85,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        strokeColor: '#ffffff',
        strokeWidth: 3,
        uppercase: true
      };
      
    case 'modern 3d rendered':
      return {
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: baseSize,
        titleSize: baseSize * 1.8,
        color: '#2d3748',
        shadowColor: 'rgba(255, 255, 255, 0.7)',
        shadowBlur: 6,
        textAlign: 'center',
        lineHeight: baseSize * 1.4,
        padding: Math.floor(height * 0.05),
        backgroundOpacity: 0.75,
        backgroundColor: 'rgba(248, 250, 252, 0.85)'
      };
      
    default:
      return {
        fontFamily: 'Arial, sans-serif',
        fontSize: baseSize,
        titleSize: baseSize * 1.8,
        color: '#2c3e50',
        shadowColor: 'rgba(255, 255, 255, 0.8)',
        shadowBlur: 4,
        textAlign: 'center',
        lineHeight: baseSize * 1.4,
        padding: Math.floor(height * 0.05),
        backgroundOpacity: 0.75,
        backgroundColor: 'rgba(255, 255, 255, 0.85)'
      };
  }
}

function renderCoverTitle(ctx, title, width, height, config) {
  // Position title in lower third of image
  const y = height * 0.75;
  
  // Draw semi-transparent background
  const textHeight = config.titleSize * 2;
  const bgY = y - config.titleSize;
  
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, bgY - config.padding, width, textHeight + config.padding * 2);

  // Configure text
  ctx.font = `bold ${config.titleSize}px ${config.fontFamily}`;
  ctx.fillStyle = config.color;
  ctx.textAlign = config.textAlign;
  ctx.textBaseline = 'middle';

  // Add shadow for readability
  ctx.shadowColor = config.shadowColor;
  ctx.shadowBlur = config.shadowBlur;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Add stroke if configured
  if (config.strokeColor) {
    ctx.strokeStyle = config.strokeColor;
    ctx.lineWidth = config.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(title, width / 2, y);
  }

  // Draw text
  const displayTitle = config.uppercase ? title.toUpperCase() : title;
  ctx.fillText(displayTitle, width / 2, y);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function renderNarrationText(ctx, text, width, height, config) {
  // Position text at bottom of image
  const maxWidth = width - (config.padding * 2);
  const startY = height - (height * 0.15);

  // Word wrap the text
  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Calculate background height
  const totalTextHeight = lines.length * config.lineHeight + config.padding * 2;
  const bgY = startY - config.padding;

  // Draw semi-transparent background
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, bgY, width, totalTextHeight);

  // Configure text
  ctx.fillStyle = config.color;
  ctx.textAlign = config.textAlign;
  ctx.textBaseline = 'top';

  // Add shadow for readability
  ctx.shadowColor = config.shadowColor;
  ctx.shadowBlur = config.shadowBlur;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Draw each line
  lines.forEach((line, index) => {
    const y = startY + (index * config.lineHeight);
    
    // Add stroke if configured
    if (config.strokeColor) {
      ctx.strokeStyle = config.strokeColor;
      ctx.lineWidth = config.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, width / 2, y);
    }
    
    // Draw text
    const displayLine = config.uppercase ? line.toUpperCase() : line;
    ctx.fillText(displayLine, width / 2, y);
  });
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

