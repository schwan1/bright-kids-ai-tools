# Bright Canvas – Next.js (Vercel)

## Quick start (local)
```bash
unzip bright-canvas-vercel-styled-fix.zip -d bright-canvas-vercel-styled-fix
cd bright-canvas-vercel-styled-fix
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. In Vercel: New Project → Import repo.
3. Add env var: `OPENAI_API_KEY` (Production/Preview/Development).
4. Deploy.

## Notes
- No styled-jsx is used; global CSS lives in `app/globals.css`.
- `next.config.js` uses CommonJS to avoid ESM warnings in some local setups.
