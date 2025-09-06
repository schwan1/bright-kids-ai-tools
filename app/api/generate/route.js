export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 });
    }

    const form = await request.formData();
    const prompt = form.get('prompt') || '';
    let size = (form.get('size') || '1024x1024').toString();

    const allowed = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);
    if (!allowed.has(size)) size = '1024x1024';
    if (size === 'auto') size = '1024x1024'; // client maps auto; fallback to square

    const image = form.get('image');
    const mask  = form.get('mask'); // optional
    if (!image) {
      return new Response(JSON.stringify({ error: 'image required' }), { status: 400 });
    }

    const fd = new FormData();
    fd.append('model', 'dall-e-2');
    fd.append('prompt', prompt);
    fd.append('image[]', image, 'upload.png');
    if (mask) fd.append('mask', mask, 'mask.png');
    fd.append('size', size);

    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: fd,
      cache: 'no-store',
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('OpenAI API error:', r.status, txt);
      return new Response(JSON.stringify({ 
        error: 'OpenAI API error', 
        status: r.status, 
        details: txt 
      }), { status: r.status });
    }

    const json = await r.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return new Response(JSON.stringify({ error: 'No image returned' }), { status: 502 });

    const buf = Buffer.from(b64, 'base64');
    return new Response(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }
}
