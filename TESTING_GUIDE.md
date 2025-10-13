# Cover Page Feature - Testing Guide

## Quick Test Instructions

### Prerequisites
- Server running on http://localhost:3000
- Valid OpenAI API key configured in `.env.local`
- A test photo of a child (or any person) for avatar generation

### Step-by-Step Testing

#### 1. Navigate to Storybook Page
```
Open browser: http://localhost:3000/storybook
```

#### 2. Fill Out Child Information
- **Child's name**: Enter any name (e.g., "Emma")
- **Age**: Select any age (e.g., 5 years old)
- **Interests**: Enter comma-separated interests (e.g., "unicorns, rainbows, flowers")
- **Challenge**: Enter a challenge (e.g., "Making new friends at school")

#### 3. Select Illustration Style
- Click on one of the 4 style options:
  - Traditional (Watercolor)
  - 2D Digital
  - Comic Graphic
  - Modern 3D

#### 4. Upload Reference Photo
- Click "Reference photo" file input
- Select a child's photo (PNG, JPEG, or WEBP)
- Wait for avatar generation (15-30 seconds)
- Verify avatar appears below the file input

#### 5. Generate Story
- Click "Draft the story" button
- Wait for story generation (20-30 seconds)
- Verify story title and pages appear in the preview section

#### 6. Generate Cover Page ⭐ NEW FEATURE
- Scroll to the "📖 Cover Page" section (appears above story pages)
- Click "Generate cover" button
- Wait for cover generation (15-30 seconds)
- Verify:
  - Cover image displays the same character as the avatar
  - Cover has a magical, storybook-style background
  - Title and dedication (if entered) appear below the image
  - Button changes to "Regenerate cover"

#### 7. Optional: Illustrate Story Pages
- Click "Illustrate all" to generate all page illustrations
- Or click individual "Illustrate page" buttons for specific pages

#### 8. Test PDF Export
- Click "Export PDF" button
- Open the downloaded PDF file
- Verify:
  - First page is the illustrated cover with title
  - Story pages follow with their illustrations
  - Affirmation page appears at the end (if enabled)

#### 9. Test Image Export
- Click "Export images" button
- Extract the downloaded ZIP file
- Verify:
  - `00-cover.png` exists and contains the cover illustration
  - Page images are numbered sequentially (`page-01.png`, etc.)
  - All images are 1024x1536 pixels

### Expected Results

✅ **Cover Page Should Include:**
- The child's character (consistent with avatar)
- Whimsical, storybook-style background
- Magical elements (sparkles, decorative borders, etc.)
- Matches the selected illustration style
- Same dimensions as story pages (1024x1536)
- NO text or watermarks in the image itself

✅ **Cover Section UI Should Show:**
- Special border highlighting (peach/coral accent color)
- Title and dedication text below the cover image
- Clear "Generate cover" button
- Disabled state when avatar is missing
- Loading state during generation

### Troubleshooting

**Problem: "Generate cover" button is disabled**
- Solution: Make sure you've uploaded a reference photo and generated a story first

**Problem: Cover generation fails**
- Check browser console for error messages
- Verify OpenAI API key is configured
- Ensure avatar was successfully generated
- Try regenerating the avatar if it seems corrupted

**Problem: Cover doesn't match the style**
- Try regenerating the cover (click "Regenerate cover")
- Verify the correct style is selected in the style picker
- Check that avatar was generated with the current style

**Problem: Character looks different on cover vs. story pages**
- This can happen due to AI variance
- Try regenerating the cover
- Ensure you're using the same illustration style throughout

### API Endpoint Tests

Test the cover API directly (requires avatar base64):

```bash
# Test validation (should return error)
curl -X POST http://localhost:3000/api/storybook/cover \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: {"error":"Title and child name are required"}
```

### Performance Notes

- **Avatar generation**: ~15-30 seconds
- **Story generation**: ~20-30 seconds  
- **Cover generation**: ~15-30 seconds
- **Page illustration**: ~30-40 seconds each

Total time for complete storybook with cover:
- Story text: 30s
- Avatar: 30s
- Cover: 30s
- 10 pages: 400s (6-7 minutes)
- **Total: ~8-9 minutes**

### Known Limitations

1. Cover generation requires an avatar to be generated first
2. AI may produce slight variations in character appearance
3. Large images may need resizing before upload
4. Maximum 12 story pages supported

### Success Criteria

- [ ] Cover page displays in the UI
- [ ] Cover includes the character from the avatar
- [ ] Cover has storybook-style decorative elements
- [ ] Cover matches selected illustration style
- [ ] PDF export includes cover as first page
- [ ] ZIP export includes cover as `00-cover.png`
- [ ] Regenerate button works correctly
- [ ] No console errors during generation
- [ ] Cover dimensions are 1024x1536 pixels

