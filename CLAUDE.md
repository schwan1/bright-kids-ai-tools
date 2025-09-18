# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Bright Kids AI Tools** — a Next.js application that provides AI-powered creative tools for parents and children.

Current tools:
- **Bright Canvas**: Upload a reference image and apply prompt-based edits via OpenAI Images API.
- **Wendy the Storybook Maker**: Parents enter child info and a parenting goal; Wendy drafts a title plus ~10 pages of age-appropriate story text and generates matching illustrations. Exports to PDF/images.

## Common Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The development server runs on port 3000 by default.

## Architecture

### Core Structure
- **Next.js 14** with App Router (not Pages Router)
- **Client-side rendering** — most components use `'use client'`
- **Minimal dependencies** — React, React DOM, Next.js
- **Single CSS file** — all styling in `app/globals.css` using CSS custom properties

### Key Files
- `app/layout.js` — Root layout with global CSS and metadata
- `app/globals.css` — Styling system with dark theme
- `app/page.js` — Landing page with tool grid
- `app/canvas/page.js` — Bright Canvas interface
- `app/api/generate/route.js` — Proxies to OpenAI Image Edits API (model `gpt-image-1`)

New (Wendy):
- `app/storybook/page.js` — Wendy the Storybook Maker UI (form, preview, batch illustration, export)
- `app/api/storybook/text/route.js` — Generates structured story JSON (Chat Completions)
- `app/api/storybook/image/route.js` — Generates per-page illustrations (Images API)
- Optional: `app/api/storybook/pdf/route.js` — Server-side PDF rendering (if needed)

### API Integration

Existing:
- `/api/generate` (image edit)
  - Input: `FormData` with `image`, `prompt`, `size`
  - Calls: `POST /v1/images/edits` with `model: gpt-image-1`
  - Output: binary PNG

Wendy (text):
- `/api/storybook/text`
  - Input: JSON (see “Contracts” → Story request)
  - Calls: `POST /v1/chat/completions` (recommended model: `gpt-4o-mini`) with `response_format: { type: 'json_object' }`
  - Output: JSON story object (title, pages[], optional affirmation, dedication)

Wendy (images):
- `/api/storybook/image`
  - Input: JSON `{ batch: Array<{ page, prompt, style, size? }>} `
  - Calls: `POST /v1/images/generations` (model `gpt-image-1`) per item (sequential or batched)
  - Output: JSON `{ results: Array<{ page, b64 }> }`

Optional:
- `/api/storybook/pdf`
  - Input: JSON `{ story, images }`
  - Output: binary PDF
  - Implementation options: headless Chromium render, `pdfkit`, or client-side `pdf-lib`/`jspdf`

## Contracts

### Story request (client → text API)
```json
{
  "child": {
    "name": "Ava",
    "age": 5,
    "interests": ["dinosaurs", "beach"],
    "readingLevel": "Pre-reader",
    "sensitivities": ["loud sounds"]
  },
  "goal": {
    "challenge": "First day of kindergarten jitters",
    "context": "Worried about drop-off; new classroom",
    "tone": "Gentle",
    "learningFocus": ["emotions", "routines"]
  },
  "style": {
    "illustrationStyle": "Whimsical watercolor",
    "pageCount": 10,
    "includeAffirmation": true,
    "dedication": "For Ava, who is brave and kind."
  }
}
```

### Storybook response (text API → client)
```json
{
  "title": "Ava's Brave First Morning",
  "summary": "A gentle story easing first-day jitters with a predictable drop-off routine.",
  "pages": [
    {
      "page": 1,
      "text": "On the first bright morning, Ava packed her tiny backpack...",
      "illustrationPrompt": "Whimsical watercolor of a cozy bedroom with soft morning light, child packing a backpack with a small dino charm.",
      "alt": "Child packs backpack in a softly lit bedroom.",
      "style": "whimsical_watercolor",
      "seed": 12731
    }
  ],
  "affirmation": "I am brave. I can do new things with a calm heart.",
  "dedication": "For Ava, who is brave and kind."
}
```

### Image batch request (client → image API)
```json
{
  "batch": [
    {
      "page": 1,
      "prompt": "Whimsical watercolor of a cozy bedroom with soft morning light...",
      "style": "whimsical_watercolor",
      "size": "1024x1024"
    }
  ]
}
```

### Image batch response (image API → client)
```json
{
  "results": [
    { "page": 1, "b64": "<base64_png>" }
  ]
}
```

### Error shape
```json
{ "error": "message", "status": 400 }
```

## Prompting (Wendy)

System (text API):
```
You are Wendy, a kind children’s author and parent coach.
Write age-appropriate picture-book text (2–5 sentences per page) with gentle, predictable structure and rich sensory detail.
Never include instruction meta. Output valid JSON only, matching the provided schema exactly.
```

User template (filled from request):
```
CHILD
- Name: {name}
- Age: {age}
- Interests: {interests}
- Reading level: {readingLevel}
- Sensitivities/supports: {sensitivities}

GOAL
- Challenge: {challenge}
- Context: {context}
- Tone: {tone}
- Learning focus: {learningFocus}

STYLE
- Illustration style: {illustrationStyle}
- Page count: {pageCount}
- Include affirmation: {includeAffirmation}
- Dedication: {dedication}

Write a title and {pageCount} pages. Each page: 2–5 short sentences.
If the goal involves anxiety, weave a repeating comfort element (e.g., “hand on heart, slow breath”).
Return JSON with keys: title, summary, pages[], affirmation (if requested), dedication.
For each page: page (number), text, illustrationPrompt (no text-in-image), alt, style, seed (random int).
```

Image prompt template (per page):
```
{illustrationPrompt}. Style: {style}. Palette: deep-navy, candlelight-amber, peach-coral accents, soft edges, picture-book lighting.
No text, no watermarks, child-friendly, gentle faces, cozy compositions.
```

## UI Patterns

Wendy page layout:
- Left: Form (“About your child”, “What do you want to help with?”, “Style & output”)
- Right: Story preview (title + ordered list of pages with image slot and text)
- Actions: “Draft the story”, “Illustrate all”, per-page “Regenerate”, export PDF/images

Copy (ready to use):
- Homepage card:
  - Title: “📚 Wendy the Storybook Maker”
  - Subhead: “Personalized bedtime stories that help kids practice life skills.”
  - Body: “Tell Wendy about your child and goal. She’ll craft a gentle 10‑page story with matching illustrations.”
  - CTA: “Launch Wendy”
- Page header:
  - Title: “📚 Wendy the Storybook Maker”
  - Tagline: “Share a little about your child. Wendy will write a loving 10‑page story and create cozy illustrations to match.”

Safety & guardrails:
- Refuse violent/scary/age-inappropriate themes
- No text in images; child-safe composition
- Do not persist PII unless explicitly saved by user

## Styling

We keep the dark base and add a warm “candlelight” Wendy layer.

Palette:
- Base (already in `globals.css`): `--bg #0b0f14`, `--panel #0e1827`, `--ink #0b111a`, `--text #e8eef5`
- Wendy accents:
  - `--wendy-accent: #ff9a6e`
  - `--wendy-accent2: #9b5de5`
  - `--wendy-glow: rgba(255,154,110,.28)`
  - `--wendy-leaf: #7bd389`

Scoped theme (wrap page root with `.wendy`):
```css
.wendy .hero{background:linear-gradient(135deg, rgba(255,154,110,.18), rgba(155,93,229,.18)); border-color:#2a3a52}
.wendy .btn{background:linear-gradient(135deg, var(--wendy-accent), #ffb48d)}
.wendy .btn.secondary{background:linear-gradient(135deg, var(--wendy-accent2), #b07af2)}
.wendy .card{box-shadow:0 12px 36px var(--wendy-glow)}
.wendy .badge{background:var(--wendy-accent)}
.wendy .progress{height:6px; background:linear-gradient(90deg, var(--wendy-accent), var(--wendy-accent2))}
```

## Environment Variables

Required:
- `OPENAI_API_KEY` — OpenAI API key for text and image generation

## Development Notes

- App uses client rendering; image blobs are object URLs with cleanup.
- No auth; no persistence by default.
- Mobile-first layout; grid collapses to single column under ~940px.
- Bright Canvas uses `/api/generate` (image edits). Wendy uses dedicated text and image routes.
- Link homepage “Storybook Builder” card to `/storybook` (rename to “Wendy the Storybook Maker” in copy).

## Implementation Checklist (Wendy)

- [ ] Add route `app/storybook/page.js` with `.wendy` scope
- [ ] Implement `/api/storybook/text/route.js` (Chat Completions JSON schema)
- [ ] Implement `/api/storybook/image/route.js` (Images generations; batch loop)
- [ ] Add scoped CSS variables/classes to `app/globals.css`
- [ ] Update homepage card copy and CTA link to `/storybook`
- [ ] Add PDF export (client-side first; server-side optional)
- [ ] QA: content safety, mobile, performance (batch/parallel image calls as needed)