export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 });
    }

    const data = await request.json();
    const { child, goal, style } = data;

    // Basic validation
    if (!child?.name || !goal?.challenge) {
      return new Response(JSON.stringify({ error: 'Child name and challenge are required' }), { status: 400 });
    }

    // Age validation
    if (child.age < 2 || child.age > 10) {
      return new Response(JSON.stringify({ error: 'Child age must be between 2 and 10 years' }), { status: 400 });
    }

    // Page count validation
    if (style.pageCount < 6 || style.pageCount > 12) {
      return new Response(JSON.stringify({ error: 'Page count must be between 6 and 12' }), { status: 400 });
    }

    // Content safety validation
    const unsafeTerms = ['violent', 'scary', 'horror', 'death', 'kill', 'weapon', 'gun', 'knife', 'blood', 'murder'];
    const textToCheck = `${goal.challenge} ${goal.context || ''}`.toLowerCase();

    for (const term of unsafeTerms) {
      if (textToCheck.includes(term)) {
        return new Response(JSON.stringify({
          error: 'Please use gentle, age-appropriate themes suitable for children\'s stories'
        }), { status: 400 });
      }
    }

    // Build the prompt
    const systemPrompt = `You are Wendy, a kind children's author and parent coach. Write age-appropriate picture-book text (2–5 sentences per page) with gentle, predictable structure and rich sensory detail.

IMPORTANT SAFETY GUIDELINES:
- Create only gentle, nurturing, age-appropriate content
- Avoid any scary, violent, or inappropriate themes
- Focus on positive learning and emotional growth
- Use warm, comforting language suitable for young children
- Never include text-in-image instructions in illustration prompts

Output valid JSON only, matching the provided schema exactly.`;

    const userPrompt = `CHILD
- Name: ${child.name}
- Age: ${child.age}
- Interests: ${child.interests?.join(', ') || 'none specified'}
- Reading level: ${child.readingLevel}
- Sensitivities/supports: ${child.sensitivities?.join(', ') || 'none specified'}

GOAL
- Challenge: ${goal.challenge}
- Context: ${goal.context || 'none specified'}
- Tone: ${goal.tone}
- Learning focus: ${goal.learningFocus?.join(', ') || 'none specified'}

STYLE
- Illustration style: ${style.illustrationStyle}
- Page count: ${style.pageCount}
- Include affirmation: ${style.includeAffirmation}
- Dedication: ${style.dedication || 'none specified'}

Write a title and ${style.pageCount} pages. Each page: 2–5 short sentences. If the goal involves anxiety, include a repeating comfort element (e.g., "hand on heart, slow breath"). Return JSON with keys: title, summary, pages[], affirmation (if requested), dedication. For each page include: page, text, illustrationPrompt (no text-in-image), alt, style, seed (random int).`;

    // Call OpenAI Chat Completions API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(JSON.stringify({
        error: 'OpenAI API error',
        status: response.status,
        details: errorText
      }), { status: response.status });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'No content returned from OpenAI' }), { status: 502 });
    }

    let storyData;
    try {
      storyData = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON response from AI' }), { status: 502 });
    }

    // Validate required fields
    if (!storyData.title || !storyData.pages || !Array.isArray(storyData.pages)) {
      return new Response(JSON.stringify({ error: 'Invalid story structure returned' }), { status: 502 });
    }

    // Ensure each page has required fields and add style/seed if missing
    storyData.pages = storyData.pages.map((page, index) => ({
      page: page.page || (index + 1),
      text: page.text || '',
      illustrationPrompt: page.illustrationPrompt || '',
      alt: page.alt || `Page ${index + 1} illustration`,
      style: style.illustrationStyle.toLowerCase().replace(/\s+/g, '_'),
      seed: page.seed || Math.floor(Math.random() * 1000000)
    }));

    return new Response(JSON.stringify(storyData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Text generation error:', error);
    return new Response(JSON.stringify({ error: 'Server error during text generation' }), { status: 500 });
  }
}