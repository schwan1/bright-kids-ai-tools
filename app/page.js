'use client';

export default function HomePage() {
  return (
    <div>
      <header>
        <h1>Bright Kids AI – Beta Tools</h1>
        <div className="tag">A playful place for parents & children to try new tools and share feedback 🎈</div>
      </header>

      <div className="wrap">
        <div className="hero">
          <p><strong>Welcome!</strong> Choose a tool to explore. If something feels off, that’s the point—we’d love your feedback to make it brilliant.</p>
        </div>

        <div className="grid">
          <div className="card">
            <h2>🎨 Bright Canvas <span className="badge">NEW</span></h2>
            <p><em>“Turn imagination into images – one prompt at a time.”</em></p>
            <p>Upload a reference image, describe the change, and generate. Download results, reuse as source, and iterate.</p>
            <a className="btn" href="/canvas">Launch Bright Canvas</a>
          </div>

          <div className="card">
            <h2>📚 Storybook Builder</h2>
            <p>Draft page layouts and export to PDF/ePub. <strong>Coming soon!</strong></p>
            <a className="btn secondary" href="#" onClick={(e)=>{e.preventDefault(); alert('Coming soon!')}}>Preview</a>
          </div>

          <div className="card">
            <h2>🧩 Activity Maker</h2>
            <p>Create printable puzzles & colouring sheets. <strong>Coming soon!</strong></p>
            <a className="btn secondary" href="#" onClick={(e)=>{e.preventDefault(); alert('Coming soon!')}}>Preview</a>
          </div>
        </div>
      </div>

      <footer>
        Have ideas or found a hiccup? Pop us a note at <a href="mailto:feedback@brightkids.ai">feedback@brightkids.ai</a> ✉️
      </footer>
    </div>
  );
}
