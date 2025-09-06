'use client';
import { useEffect, useRef, useState } from 'react';

export default function CanvasPage() {
  const inputRef = useRef(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [previewDims, setPreviewDims] = useState({ w: 0, h: 0 });
  const [file, setFile] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [resultURL, setResultURL] = useState(null);

  useEffect(() => () => { if (previewURL) URL.revokeObjectURL(previewURL); }, [previewURL]);
  useEffect(() => () => { if (resultURL) URL.revokeObjectURL(resultURL); }, [resultURL]);

  function onSelect(e) {
    const f = e.target.files?.[0] || null;
    if (!f) { setFile(null); setPreviewURL(null); return; }
    setFile(f);
    if (!originalFile) setOriginalFile(f);
    const url = URL.createObjectURL(f);
    setPreviewURL(url);
  }

  function onPreviewLoad(e) {
    const img = e.currentTarget;
    setPreviewDims({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
  }

  function computeRequestedSize() {
    if (size !== 'auto') return size;
    const { w, h } = previewDims;
    if (!w || !h) return '1024x1024';
    const aspect = w / h;
    if (Math.abs(aspect - 1) <= 0.05) return '1024x1024';
    return aspect > 1 ? '1536x1024' : '1024x1536';
  }

  async function start() {
    if (!file) { alert('Please upload an image first.'); return; }
    setBusy(true); setResultURL(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('prompt', prompt);
      fd.append('size', computeRequestedSize());

      const r = await fetch('/api/generate', { method: 'POST', body: fd, cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setResultURL(url);
    } catch (e) {
      console.error(e);
      alert('Generation failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function useAsSource() {
    if (!resultURL) return;
    const blob = await (await fetch(resultURL)).blob();
    const f = new File([blob], 'generated-source.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(f);
    inputRef.current.files = dt.files;
    onSelect({ target: { files: dt.files } });
    setPrompt(''); setSize('auto');
  }

  function reset() {
    if (!originalFile) return;
    const dt = new DataTransfer(); dt.items.add(originalFile);
    inputRef.current.files = dt.files;
    onSelect({ target: { files: dt.files } });
    setPrompt(''); setSize('auto');
  }

  return (
    <div>
      <div className="wrap">
        <div className="topbar">
          <a className="back" href="/">← Back to Home</a>
          <h1>🎨 Bright Canvas</h1>
        </div>
        <p className="tag"><em>“Turn imagination into images – one prompt at a time.”</em></p>

        <div className="board">
          <section className="card controls">
            <h2>Upload & Describe</h2>
            <div className="grid gap">
              <label htmlFor="image">Reference image</label>
              <input ref={inputRef} id="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={onSelect} />

              <label htmlFor="prompt">Describe the changes</label>
              <textarea id="prompt" placeholder="e.g., Move the kids onto a sunny beach, bright turquoise water, playful sandcastle, wide shot."
                        value={prompt} onChange={e=>setPrompt(e.target.value)} />

              <div className="inline">
                <div style={{minWidth:'220px'}}>
                  <label htmlFor="size">Output size</label>
                  <select id="size" style={{width:'100%'}} value={size} onChange={e=>setSize(e.target.value)}>
                    <option value="auto">Auto (match orientation)</option>
                    <option>1024x1024</option>
                    <option>1024x1536</option>
                    <option>1536x1024</option>
                  </select>
                </div>
                <button onClick={start} disabled={busy} style={{minWidth:'140px'}}>{busy ? 'Working…' : 'Start'}</button>
              </div>
              <p className="meta">Tip: “Auto” maps your image’s orientation to an allowed size: square → 1024×1024, portrait → 1024×1536, landscape → 1536×1024.</p>
            </div>
          </section>

          <section className="card">
            <h2>Preview</h2>
            <div className="panel">
              <div className="imgwrap" id="previewWrap">
                {previewURL ? <img src={previewURL} onLoad={onPreviewLoad} alt="preview" /> : <span className="meta">No image selected.</span>}
              </div>
            </div>
            <div className="buttons">
              <button className="subtle" onClick={reset} disabled={!originalFile}>Reset to original</button>
            </div>
          </section>

          <section className="card" style={{gridColumn:'1 / -1'}}>
            <h2>Result</h2>
            <div className="panel">
              <div className="imgwrap" id="resultWrap">
                {resultURL ? <img src={resultURL} alt="result" /> : <span className="meta">Nothing generated yet.</span>}
              </div>
            </div>
            <div className="meta">{resultURL ? `Requested size: ${computeRequestedSize()}` : ''}</div>
            <div className="buttons">
              <a className="subtle" href={resultURL || '#'} download={resultURL ? `image-${Date.now()}.png` : undefined}
                style={{pointerEvents: resultURL ? 'auto' : 'none', opacity: resultURL ? 1 : .6}}>
                Download
              </a>
              <button className="subtle" onClick={useAsSource} disabled={!resultURL}>Use as source</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
