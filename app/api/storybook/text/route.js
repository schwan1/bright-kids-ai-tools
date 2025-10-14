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

    // Build the prompt per hero-focused spec
    const systemPrompt = `You are a compassionate children's author.
Use warm, simple language suitable for the stated reading level.
Keep British spelling. Write picture-book narration with clear scene changes and gentle pacing: calm build‑up → small challenge → child‑led solution → proud ending.
Thread the child's interests and favourite toy from beginning to end. Avoid violence, shame, medical advice, or moralising about being "normal".
Output valid JSON only, matching the required schema.`;

    const triggerPhrases = ['loud noise','loud noises','noise','cinema','movie theater','movie theatre'];
    const haystack = `${(goal.challenge||'').toLowerCase()} ${(goal.context||'').toLowerCase()} ${(child.sensitivities||[]).join(' ').toLowerCase()}`;
    const noiseTriggered = triggerPhrases.some(p => haystack.includes(p));

    const userPrompt = `# === STORY REQUEST ===
meta:
  app: "Wendy the Storybook Maker"
  british_spelling: true
  output_markdown_only: false

child_profile:
  name: "${child.name}"
  age_years: ${child.age}
  pronouns: "${child.pronouns || ''}"
  interests: [${(child.interests||[]).join(', ')}]
  favourite_toy: "${child.favoriteToy || ''}"
  play_setting: ""

reading_and_style:
  reading_level: "${child.readingLevel}"
  tone: "${goal.tone}"
  pages: ${style.pageCount}
  illustration_style: "${style.illustrationStyle}"

support_needs:
  sensitivities: [${(child.sensitivities||[]).join(', ')}]
  supports_available: []

learning_focus: [${(goal.learningFocus||[]).join(', ')}]

story_setup:
  challenge_short: "${goal.challenge}"
  context_detail: "${goal.context || ''}"

cinema_noise_logic:
  trigger_phrases: [loud noise, loud noises, noise, cinema, movie theater, movie theatre]
  plan_when_triggered:
    seating: "choose aisle seats near exit"
    timing: "arrive early before the room gets busy"
    headphones: "use ear defenders/headphones during trailers"
    step_out: "child may step out, reset, and return when ready"
    co_regulation: "hand-squeeze signal + five slow breaths"
    preview: "name ‘loud parts’ ahead of time; practise with short clips"

content_rules:
  hero_child: true
  strengths_based: true
  sensory_friendly: true
  include_refrains: 2
  avoid: [violence, shame, medical advice, moralising about being normal]

structure:
  title_page: true
  page_count: ${style.pageCount}
  pov: "close third"
  rhyme_mode: false
  caregiver_note: true

instructions: |
  Keep British spelling. 2–3 short sentences per page (maximum) so text fits.
  Child is the hero with real agency; adults offer choices, child decides.
  If cinema/noise triggers are present, include at least two accommodations from the plan above, woven naturally.
  Close with an affirmation naming the child's strength.

# App integration requirements:
# Return JSON with: title, summary, pages[], affirmation, dedication (optional), refrains (optional)
# pages[]: { page, text, illustrationPrompt, alt, style }
`; 

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