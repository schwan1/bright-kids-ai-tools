# Quick Test Guide - Avatar Updates

## 🚀 Test at: http://localhost:3000/storybook

---

## ✅ Test 1: Description-Based Avatar (NEW!)

1. Visit http://localhost:3000/storybook
2. Scroll to "Character Generation" section
3. **Skip the photo upload**
4. Find the new section: "Child description (if you do not want to upload a photo)"
5. Enter a description:
   ```
   A 6-year-old girl with short dark hair, warm brown eyes, 
   medium-light skin, loves stars and planets, usually wears 
   a lavender shirt and comfy jeans.
   ```
6. Click **"Generate avatar from description"**
7. ✅ Avatar should generate (takes ~90 seconds)
8. ✅ Avatar displays below the button

---

## ✅ Test 2: Avatar-Referenced Pages (NEW!)

1. After avatar generated (from photo OR description)
2. Fill in child info and create a story
3. Click **"Illustrate All"**
4. ✅ All pages generate using the avatar as reference
5. ✅ Character looks consistent across ALL pages
6. Check individual pages:
   - Page 1: Same character
   - Page 3: Same character
   - Page 6: Same character

**Expected:** No character drift - all pages match avatar!

---

## ✅ Test 3: Switch Between Photo & Description

### **Start with Photo:**
1. Upload a reference photo
2. Avatar generates
3. Note the avatar appearance

### **Switch to Description:**
4. Enter a description (different from photo)
5. Click "Generate avatar from description"
6. ✅ New avatar generates from description
7. ✅ Photo is cleared (since description was used)

### **Generate Pages:**
8. Create story
9. Click "Illustrate All"
10. ✅ All pages use the description-based avatar

---

## ✅ Test 4: Style Change with Description

1. Enter description and generate avatar
2. Note the style (e.g., "Whimsical watercolor")
3. Change style to different option (e.g., "Modern flat")
4. ✅ Avatar auto-regenerates in new style
5. ✅ Still uses the description (not photo)
6. Generate pages
7. ✅ All pages match new style

---

## 🎯 Expected Behaviors

### **Description Input:**
- ✅ Textarea is multiline
- ✅ Has helpful placeholder text
- ✅ Button disabled when empty
- ✅ Shows loading spinner during generation
- ✅ Error message if generation fails

### **Avatar as Reference:**
- ✅ Page 1 uses avatar
- ✅ Page 2 uses avatar (NOT page 1)
- ✅ Page 3 uses avatar (NOT page 2)
- ✅ All pages use avatar directly
- ✅ No character drift

### **Consistency:**
- ✅ Character looks the same across all pages
- ✅ Hair, eyes, skin tone match avatar
- ✅ Clothing colors consistent
- ✅ Face structure consistent

---

## 🐛 What to Look For

### **Potential Issues:**

1. **Description too short:** Should work, but might be vague
2. **Description too long:** Should work, but might lose details
3. **No avatar before illustrating:** Should show error message
4. **Style change:** Should regenerate avatar automatically
5. **Character drift:** Should NOT happen anymore!

### **Known Limitations:**

- Description-based avatars take ~90 seconds
- Need at least some description details
- AI interprets descriptions (may vary)
- Still need avatar before generating pages

---

## 📝 Example Test Descriptions

Try these:

**Example 1:**
```
A 5-year-old boy with curly brown hair, blue eyes, 
wearing a red t-shirt, loves dinosaurs
```

**Example 2:**
```
A 7-year-old girl with long blonde hair in braids, 
green eyes, wearing a purple dress with flowers
```

**Example 3:**
```
An 8-year-old child with short black hair, brown eyes, 
tan skin, wearing a yellow hoodie
```

---

## ✨ Success Criteria

✅ Description input field visible  
✅ Generate button works  
✅ Avatar generates from description  
✅ Avatar displays correctly  
✅ All pages reference avatar (not previous pages)  
✅ Character consistent across all pages  
✅ Style changes work with descriptions  
✅ Can switch between photo and description  

---

**Ready to test!** 🎨👶📚

