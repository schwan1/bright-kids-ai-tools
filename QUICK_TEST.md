# Quick Test Guide - Text Overlay Feature

## 🚀 Quick Start

Your storybook application now has text overlays! Here's how to test:

## Step-by-Step Test

### 1. Navigate to Storybook
```
http://localhost:3000/storybook
```

### 2. Create a Story (Same as before)
- Enter child's name: "Emma"
- Age: 5
- Challenge: "First day at school"
- Upload a reference photo
- Select illustration style (try **Whimsical watercolor** first)
- Click "Draft the story"

### 3. Generate Cover ⭐ NEW!
- Wait for story to generate
- Click **"Generate cover"** in the Cover Page section
- Wait ~30-60 seconds
- **✨ Check: Title should be ON the cover image!**

### 4. Illustrate Pages ⭐ UPDATED!
- Click **"Illustrate all"** or individual page buttons
- Wait for generation
- **✨ Check: Narration text should be ON each page image!**

### 5. Export PDF ✅ FIXED!
- Click **"Export PDF"**
- Open the downloaded PDF
- **✨ Check: No encoding errors!**
- **✨ Check: All text is integrated into images**

## What's Different?

### Before
```
[Image of scene]

Text appears here, separate from image
```

### After
```
┌─────────────────────────┐
│                         │
│   [Scene with text]     │
│   embedded at bottom    │
│                         │
└─────────────────────────┘
```

## Expected Behavior

### Cover Page
- Title appears at **bottom third** of cover image
- **Large, bold text** matching style
- Semi-transparent background for readability
- Title is part of the image itself

### Story Pages
- Narration text at **bottom** of each page
- Style-matched typography:
  - **Watercolor**: Serif font, soft look
  - **2D Digital**: Sans-serif, clean
  - **Comic**: Impact font, bold, UPPERCASE
  - **3D**: Helvetica, modern
- Text wraps automatically
- Background ensures readability

### PDF Export
- ✅ **No more encoding errors!**
- Special characters handled correctly
- Smart quotes → Regular quotes
- Em dashes → Hyphens
- All text renders properly

## Troubleshooting

### "Text overlay failed" in console
- This is a warning, not an error
- Image will display without text overlay
- Try regenerating that specific page

### Cover/page regeneration
- Click "Regenerate cover" for new cover
- Click "Illustrate page" to regenerate individual pages
- Text will be re-added with each generation

### PDF still has errors
- Very unlikely now, but if it happens:
- Check console for specific character causing issue
- File a bug report with the story text

## Performance Notes

- **Cover generation**: ~30-60 seconds (includes text overlay)
- **Page generation**: ~30-60 seconds each (includes text overlay)
- **Text overlay**: Adds ~1-2 seconds per image
- **PDF export**: Instant (text already on images)

## Visual Comparison

### Watercolor Style
```
Font: Georgia (serif)
Look: Warm, traditional
Background: Cream color
Shadow: Soft
Perfect for: Classic fairy tales
```

### 2D Digital Style
```
Font: Arial (sans-serif)
Look: Clean, modern
Background: White
Stroke: White outline
Perfect for: Contemporary stories
```

### Comic Style
```
Font: Impact (bold)
Look: BOLD, UPPERCASE
Background: Bright white
Stroke: Thick white outline
Perfect for: Action, adventure
```

### 3D Modern Style
```
Font: Helvetica
Look: Sleek, contemporary
Background: Light gray
Shadow: Soft, subtle
Perfect for: Modern tales
```

## Success Criteria

✅ Cover has title ON the image
✅ Story pages have narration ON the images
✅ PDF exports without errors
✅ Text style matches illustration style
✅ Text is readable on all backgrounds
✅ Images are 1024x1536 pixels (2:3 ratio)

## Need Help?

### Check the logs:
1. Open browser console (F12)
2. Look for "Text overlay" messages
3. Check for any red errors

### Test individual components:
```bash
# Test overlay API
curl -X POST http://localhost:3000/api/storybook/overlay \
  -H "Content-Type: application/json" \
  -d '{}' 

# Should return: {"error":"Image is required"}
```

## Known Limitations

- Text is always center-aligned
- Font size is automatic (based on image size)
- No custom font upload (yet)
- Maximum 3-4 lines of text per page (automatic wrapping)

## Tips for Best Results

1. **Keep narration concise**: 2-3 sentences per page
2. **Choose style first**: Text rendering matches your chosen style
3. **Review before exporting**: Regenerate if text doesn't look right
4. **Use clear titles**: Short, punchy titles look best on covers

Enjoy your professional children's storybooks! 📚✨

