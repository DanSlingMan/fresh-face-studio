import { useState, useEffect, useRef } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const PASSWORD = 'freshface2026';
const SESSION_KEY = 'ffs_studio_auth';
const HISTORY_KEY = 'ffs_studio_history';

const TOPIC_CATEGORIES = [
  {
    label: 'Seasonal & Timely',
    topics: [
      'Summer skincare tips for beach living',
      'How to protect your skin from salt and sun',
      'Holiday gift guide: skincare edition',
      'Spring skin reset: what your face needs right now',
    ],
  },
  {
    label: 'Treatment Education',
    topics: [
      'What to expect at your first facial',
      'Chemical peel vs. microneedling — which is right for you?',
      "Why dermaplaning isn't as scary as it sounds",
      'The truth about microneedling downtime',
    ],
  },
  {
    label: 'Ingredient & Product',
    topics: [
      'Ingredients I actually use on my own skin',
      'Why I chose Dermalogica for my studio',
      'Retinol: when to start and how to use it',
      'SPF: the one product everyone needs',
    ],
  },
  {
    label: 'Behind the Scenes',
    topics: [
      'A day at the bungalow',
      'Why I became an esthetician',
      'What I wish every client knew before their appointment',
      'The story behind Fresh Face Studio',
    ],
  },
  {
    label: 'Client Stories (anonymized)',
    topics: [
      'How we transformed sun-damaged skin in 3 sessions',
      'The acne journey: patience, peels, and progress',
      'Why consistency beats intensity in skincare',
    ],
  },
];

const CONTENT_TYPES = [
  { value: 'both', label: 'Blog Post + Instagram Caption' },
  { value: 'blog', label: 'Blog Post Only' },
  { value: 'instagram', label: 'Instagram Caption Only' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(contentType) {
  const basePrompt = `You are Maria's content writing assistant for Fresh Face Studio, a boutique skincare studio in a 1950s beach bungalow in North Myrtle Beach, SC.

Maria's voice is: warm, personal, knowledgeable but never clinical, a little bit funny, like a friend who happens to be a skincare expert. She says things like 'it's not just skincare, it's soul care.' She's passionate about her clients and treats every face like the only one that matters.

Fresh Face Studio offers: Classic Facials ($90), Custom Facials ($140), Back Facials ($110), Chemical Peels ($130), Microneedling ($250+), Nanoneedling LuminFusion ($150), MicroPeels ($150), Dermaplaning ($50), Lash Lift & Tint ($85), Brow Lamination & Tint ($75), Brow Tint ($30), Brow Lamination ($40), Lip Wax ($20), Brow Wax ($20), Microdermabrasion Add-On ($40).

The studio is in a renovated 1950s beach bungalow. Maria uses Dermalogica products. She offers house calls. Open Mon-Sat 9-5. Phone: (843) 457-2448. Website: yourfreshface.com. Instagram: @freshface.studio.`;

  if (contentType === 'blog') {
    return `${basePrompt}

When generating content, ONLY output a blog post in this exact format:

---BLOG POST---
[Title]

[Full blog post in markdown, 400-800 words, conversational and warm, SEO-optimized with natural keyword usage for North Myrtle Beach / Myrtle Beach skincare. End with a soft CTA to book.]

---END---`;
  }

  if (contentType === 'instagram') {
    return `${basePrompt}

When generating content, ONLY output an Instagram caption in this exact format:

---INSTAGRAM CAPTION---
[Instagram caption, 150-300 words, personal and engaging, with line breaks for readability. Include a call to action. End with 15-20 relevant hashtags including #freshfacestudio #myrtlebeach #northmyrtlebeach #skincare #esthetician #facials]

---END---`;
  }

  return `${basePrompt}

When generating content, ALWAYS output in this exact format:

---BLOG POST---
[Title]

[Full blog post in markdown, 400-800 words, conversational and warm, SEO-optimized with natural keyword usage for North Myrtle Beach / Myrtle Beach skincare. End with a soft CTA to book.]

---INSTAGRAM CAPTION---
[Instagram caption, 150-300 words, personal and engaging, with line breaks for readability. Include a call to action. End with 15-20 relevant hashtags including #freshfacestudio #myrtlebeach #northmyrtlebeach #skincare #esthetician #facials]

---END---`;
}

function parseOutput(text, contentType) {
  const blogMatch = text.match(/---BLOG POST---([\s\S]*?)(?=---INSTAGRAM CAPTION---|---END---)/);
  const igMatch = text.match(/---INSTAGRAM CAPTION---([\s\S]*?)(?=---END---)/);

  const blogRaw = blogMatch ? blogMatch[1].trim() : '';
  const igRaw = igMatch ? igMatch[1].trim() : '';

  // Split blog into title + body
  let blogTitle = '';
  let blogBody = '';
  if (blogRaw) {
    const lines = blogRaw.split('\n');
    blogTitle = lines[0].replace(/^#+\s*/, '').trim();
    blogBody = lines.slice(1).join('\n').trim();
  }

  return { blogTitle, blogBody, igCaption: igRaw };
}

function buildMarkdownFile(title, body) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const today = new Date().toISOString().split('T')[0];
  const frontmatter = `---
title: "${title}"
description: ""
pubDate: ${today}
heroImage: ""
draft: true
---\n\n`;
  return { content: frontmatter + `# ${title}\n\n` + body, slug };
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text, setCopied) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy to Clipboard' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`cs-btn cs-btn--outline cs-btn--sm${copied ? ' cs-btn--success' : ''}`}
      onClick={() => copyToClipboard(text, setCopied)}
    >
      {copied ? '✓ Copied!' : label}
    </button>
  );
}

function BlogOutput({ title, body }) {
  const { content, slug } = buildMarkdownFile(title, body);

  return (
    <div className="cs-output-panel">
      <div className="cs-output-panel__header">
        <h3 className="cs-output-panel__label">Blog Post</h3>
        <div className="cs-output-panel__actions">
          <CopyButton text={`# ${title}\n\n${body}`} />
          <button
            className="cs-btn cs-btn--outline cs-btn--sm"
            onClick={() => downloadTextFile(content, `${slug}.md`)}
          >
            Download .md
          </button>
        </div>
      </div>
      <div className="cs-blog-preview">
        <h2 className="cs-blog-preview__title">{title}</h2>
        <div className="cs-blog-preview__body">
          {body.split('\n').map((line, i) => {
            if (line.startsWith('## ')) return <h3 key={i} className="cs-blog-h3">{line.slice(3)}</h3>;
            if (line.startsWith('### ')) return <h4 key={i} className="cs-blog-h4">{line.slice(4)}</h4>;
            if (line.startsWith('**') && line.endsWith('**')) return <strong key={i}>{line.slice(2, -2)}</strong>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i}>{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}

function InstagramOutput({ caption }) {
  const hashtagIndex = caption.lastIndexOf('#');
  const captionText = hashtagIndex > 0 ? caption.slice(0, hashtagIndex).trim() : caption;
  const hashtags = hashtagIndex > 0 ? caption.slice(hashtagIndex).trim() : '';
  const charCount = caption.length;

  return (
    <div className="cs-output-panel">
      <div className="cs-output-panel__header">
        <h3 className="cs-output-panel__label">Instagram Caption</h3>
        <div className="cs-output-panel__actions">
          <CopyButton text={caption} />
          <span className={`cs-char-count${charCount > 2200 ? ' cs-char-count--warn' : ''}`}>
            {charCount} chars
          </span>
        </div>
      </div>
      <div className="cs-ig-preview">
        <div className="cs-ig-preview__header">
          <div className="cs-ig-avatar">FF</div>
          <div>
            <div className="cs-ig-handle">freshface.studio</div>
            <div className="cs-ig-location">North Myrtle Beach, SC</div>
          </div>
        </div>
        <div className="cs-ig-preview__body">
          {captionText.split('\n').map((line, i) =>
            line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>
          )}
        </div>
        {hashtags && (
          <div className="cs-ig-preview__hashtags">
            {hashtags}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onAuth();
    } else {
      setError(true);
      setValue('');
      setTimeout(() => setError(false), 3000);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="cs-gate">
      <div className="cs-gate__card">
        <div className="cs-gate__logo">Fresh Face Studio</div>
        <p className="cs-gate__subtitle">Content Studio — Private Access</p>
        <form className="cs-gate__form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            className={`cs-gate__input${error ? ' cs-gate__input--error' : ''}`}
            placeholder="Enter password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            autoComplete="current-password"
          />
          <button type="submit" className="cs-btn cs-btn--primary cs-btn--full">
            Enter
          </button>
        </form>
        {error && <p className="cs-gate__error">Incorrect password. Please try again.</p>}
      </div>
    </div>
  );
}

// ─── Main Studio ──────────────────────────────────────────────────────────────

export default function ContentStudio() {
  const [authed, setAuthed] = useState(false);
  const [contentType, setContentType] = useState('both');
  const [inputMode, setInputMode] = useState('suggestions'); // 'suggestions' | 'freeform'
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { blogTitle, blogBody, igCaption, prompt, contentType }
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = current result

  // Check session on mount
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') setAuthed(true);
    try {
      const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(saved);
    } catch {}
  }, []);

  function addToHistory(entry) {
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 5);
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function generate(overridePrompt) {
    const userPrompt = overridePrompt ?? prompt;
    if (!userPrompt.trim()) return;

    setLoading(true);
    setError('');
    setHistoryIndex(-1);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: buildSystemPrompt(contentType),
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '';
      const parsed = parseOutput(rawText, contentType);
      const entry = { ...parsed, prompt: userPrompt, contentType, timestamp: Date.now() };
      setResult(entry);
      addToHistory(entry);
    } catch (err) {
      setError(
        err.message.includes('fetch')
          ? 'Unable to reach the API. Check your connection and try again.'
          : `Something went wrong: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setResult(null);
    setPrompt('');
    setHistoryIndex(-1);
  }

  const displayedResult = historyIndex >= 0 ? history[historyIndex] : result;

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  return (
    <div className="cs-wrap">
      {/* Header */}
      <header className="cs-header">
        <div className="cs-header__inner">
          <h1 className="cs-header__title">Fresh Face Content Studio</h1>
          <p className="cs-header__subtitle">
            Your AI writing partner. Describe what's on your mind, and get a blog post + Instagram caption ready to publish.
          </p>
        </div>
      </header>

      <div className="cs-main">
        {/* Left / Input column */}
        <aside className="cs-sidebar">

          {/* Content type */}
          <section className="cs-section">
            <h2 className="cs-section__title">What do you need?</h2>
            <div className="cs-type-pills">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.value}
                  className={`cs-pill${contentType === ct.value ? ' cs-pill--active' : ''}`}
                  onClick={() => setContentType(ct.value)}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </section>

          {/* Topic mode toggle */}
          <section className="cs-section">
            <div className="cs-mode-toggle">
              <button
                className={`cs-mode-btn${inputMode === 'suggestions' ? ' cs-mode-btn--active' : ''}`}
                onClick={() => setInputMode('suggestions')}
              >
                Topic Suggestions
              </button>
              <button
                className={`cs-mode-btn${inputMode === 'freeform' ? ' cs-mode-btn--active' : ''}`}
                onClick={() => setInputMode('freeform')}
              >
                Write Your Own
              </button>
            </div>
          </section>

          {/* Topic suggestions */}
          {inputMode === 'suggestions' && (
            <section className="cs-section cs-section--topics">
              {TOPIC_CATEGORIES.map(cat => (
                <div key={cat.label} className="cs-topic-category">
                  <h3 className="cs-topic-category__label">{cat.label}</h3>
                  <div className="cs-topic-grid">
                    {cat.topics.map(topic => (
                      <button
                        key={topic}
                        className={`cs-topic-card${prompt === topic ? ' cs-topic-card--selected' : ''}`}
                        onClick={() => { setPrompt(topic); setInputMode('suggestions'); }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Freeform textarea */}
          {inputMode === 'freeform' && (
            <section className="cs-section">
              <textarea
                className="cs-textarea"
                rows={5}
                placeholder="Tell me what you want to write about... e.g. 'I did a custom facial on a bride-to-be today and used the new Dermalogica serum. It was amazing.'"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </section>
          )}

          {/* Selected prompt display (when in suggestions mode and topic selected) */}
          {inputMode === 'suggestions' && prompt && (
            <section className="cs-section">
              <div className="cs-selected-prompt">
                <span className="cs-selected-prompt__label">Selected topic:</span>
                <span className="cs-selected-prompt__text">{prompt}</span>
                <button className="cs-clear-btn" onClick={() => setPrompt('')}>×</button>
              </div>
            </section>
          )}

          {/* Generate button */}
          <section className="cs-section">
            <button
              className="cs-btn cs-btn--primary cs-btn--full cs-btn--lg"
              onClick={() => generate()}
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <span className="cs-loading">
                  <span className="cs-spinner" />
                  Maria's AI is writing...
                </span>
              ) : (
                'Create My Content'
              )}
            </button>
            {error && <p className="cs-error">{error}</p>}
          </section>

          {/* History */}
          {history.length > 0 && (
            <section className="cs-section">
              <h2 className="cs-section__title">Recent Generations</h2>
              <div className="cs-history">
                {history.map((h, i) => (
                  <button
                    key={h.timestamp}
                    className={`cs-history-item${historyIndex === i ? ' cs-history-item--active' : ''}`}
                    onClick={() => { setHistoryIndex(i); setResult(null); }}
                  >
                    <span className="cs-history-item__prompt">{h.prompt.slice(0, 50)}{h.prompt.length > 50 ? '…' : ''}</span>
                    <span className="cs-history-item__type">{CONTENT_TYPES.find(c => c.value === h.contentType)?.label || h.contentType}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Right / Output area */}
        <section className="cs-output">
          {!displayedResult && !loading && (
            <div className="cs-output-empty">
              <div className="cs-output-empty__icon">✨</div>
              <p>Select a topic or describe what you want to write about, then click <strong>Create My Content</strong>.</p>
            </div>
          )}

          {loading && (
            <div className="cs-output-loading">
              <div className="cs-spinner cs-spinner--lg" />
              <p>Writing your content...</p>
            </div>
          )}

          {displayedResult && !loading && (
            <>
              <div className="cs-output-actions">
                {result && (
                  <button
                    className="cs-btn cs-btn--outline cs-btn--sm"
                    onClick={() => generate(displayedResult.prompt)}
                    disabled={loading}
                  >
                    Regenerate
                  </button>
                )}
                <button className="cs-btn cs-btn--ghost cs-btn--sm" onClick={startOver}>
                  Start Over
                </button>
              </div>

              <div className="cs-output-grid">
                {(displayedResult.contentType === 'both' || displayedResult.contentType === 'blog') &&
                  displayedResult.blogTitle && (
                    <BlogOutput title={displayedResult.blogTitle} body={displayedResult.blogBody} />
                  )}
                {(displayedResult.contentType === 'both' || displayedResult.contentType === 'instagram') &&
                  displayedResult.igCaption && (
                    <InstagramOutput caption={displayedResult.igCaption} />
                  )}
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`
        /* ── Scope all styles to .cs-* to avoid leaking ── */

        .cs-wrap {
          min-height: 100vh;
          background: #F7F3EE;
          font-family: 'Nunito Sans', 'Helvetica Neue', sans-serif;
          color: #2D2926;
        }

        /* Gate */
        .cs-gate {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #F7F3EE 0%, #EDE7DF 100%);
          padding: 1.5rem;
        }
        .cs-gate__card {
          background: #FDFBF8;
          border: 1px solid #DDD6CD;
          border-radius: 16px;
          padding: 3rem 2.5rem;
          width: 100%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 8px 32px rgba(44,41,38,0.08);
        }
        .cs-gate__logo {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.5rem;
          font-weight: 600;
          color: #2D2926;
          margin-bottom: 0.5rem;
        }
        .cs-gate__subtitle {
          font-size: 0.875rem;
          color: #7A7471;
          margin-bottom: 2rem;
        }
        .cs-gate__form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .cs-gate__input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1.5px solid #DDD6CD;
          border-radius: 8px;
          font-size: 1rem;
          background: #FDFBF8;
          color: #2D2926;
          transition: border-color 150ms ease;
          outline: none;
        }
        .cs-gate__input:focus {
          border-color: #B8907A;
        }
        .cs-gate__input--error {
          border-color: #c0392b;
          animation: cs-shake 0.3s ease;
        }
        @keyframes cs-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .cs-gate__error {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #c0392b;
        }

        /* Header */
        .cs-header {
          background: #2D2926;
          color: #F7F3EE;
          padding: 2.5rem 0;
        }
        .cs-header__inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }
        .cs-header__title {
          font-family: 'Lora', Georgia, serif;
          font-size: clamp(1.5rem, 3vw, 2.25rem);
          font-weight: 600;
          color: #FDFBF8;
          margin-bottom: 0.5rem;
        }
        .cs-header__subtitle {
          font-size: 1rem;
          color: #A69E9A;
          max-width: 600px;
        }

        /* Main layout */
        .cs-main {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 2rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .cs-main {
            grid-template-columns: 1fr;
          }
        }

        /* Sidebar */
        .cs-sidebar {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* Sections */
        .cs-section {
          background: #FDFBF8;
          border: 1px solid #DDD6CD;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }
        .cs-section--topics {
          padding: 1.25rem;
          max-height: 50vh;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #DDD6CD transparent;
        }
        .cs-section__title {
          font-family: 'Nunito Sans', sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #7A7471;
          margin-bottom: 0.875rem;
        }

        /* Type pills */
        .cs-type-pills {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cs-pill {
          padding: 0.625rem 1rem;
          border: 1.5px solid #DDD6CD;
          border-radius: 8px;
          background: transparent;
          font-size: 0.875rem;
          color: #7A7471;
          cursor: pointer;
          text-align: left;
          transition: all 150ms ease;
        }
        .cs-pill:hover {
          border-color: #B8907A;
          color: #2D2926;
        }
        .cs-pill--active {
          background: #B8907A;
          border-color: #B8907A;
          color: #FDFBF8;
          font-weight: 600;
        }

        /* Mode toggle */
        .cs-mode-toggle {
          display: flex;
          border: 1.5px solid #DDD6CD;
          border-radius: 8px;
          overflow: hidden;
        }
        .cs-mode-btn {
          flex: 1;
          padding: 0.625rem;
          background: transparent;
          border: none;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #7A7471;
          cursor: pointer;
          transition: all 150ms ease;
        }
        .cs-mode-btn--active {
          background: #2D2926;
          color: #FDFBF8;
        }

        /* Topic categories */
        .cs-topic-category {
          margin-bottom: 1.25rem;
        }
        .cs-topic-category:last-child {
          margin-bottom: 0;
        }
        .cs-topic-category__label {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #A69E9A;
          margin-bottom: 0.5rem;
        }
        .cs-topic-grid {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .cs-topic-card {
          padding: 0.625rem 0.875rem;
          background: #F7F3EE;
          border: 1px solid #EDE7DF;
          border-radius: 8px;
          font-size: 0.8125rem;
          color: #2D2926;
          text-align: left;
          cursor: pointer;
          transition: all 150ms ease;
          line-height: 1.4;
        }
        .cs-topic-card:hover {
          background: #EDE7DF;
          border-color: #B8907A;
        }
        .cs-topic-card--selected {
          background: #F0E4DC;
          border-color: #B8907A;
          color: #2D2926;
          font-weight: 600;
        }

        /* Textarea */
        .cs-textarea {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1.5px solid #DDD6CD;
          border-radius: 8px;
          font-size: 0.9375rem;
          font-family: inherit;
          background: #FDFBF8;
          color: #2D2926;
          resize: vertical;
          outline: none;
          transition: border-color 150ms ease;
          line-height: 1.6;
        }
        .cs-textarea:focus {
          border-color: #B8907A;
        }
        .cs-textarea::placeholder {
          color: #A69E9A;
        }

        /* Selected prompt */
        .cs-selected-prompt {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          background: #F0E4DC;
          border: 1px solid #B8907A;
          border-radius: 8px;
          padding: 0.75rem 0.875rem;
          font-size: 0.875rem;
        }
        .cs-selected-prompt__label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #B8907A;
          white-space: nowrap;
          padding-top: 0.1em;
        }
        .cs-selected-prompt__text {
          flex: 1;
          color: #2D2926;
          line-height: 1.5;
        }
        .cs-clear-btn {
          background: none;
          border: none;
          color: #B8907A;
          font-size: 1.25rem;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          flex-shrink: 0;
        }

        /* Error */
        .cs-error {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #c0392b;
          background: #fdf2f2;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          padding: 0.75rem 1rem;
        }

        /* History */
        .cs-history {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .cs-history-item {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          padding: 0.625rem 0.875rem;
          background: #F7F3EE;
          border: 1px solid #EDE7DF;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          transition: all 150ms ease;
        }
        .cs-history-item:hover {
          background: #EDE7DF;
          border-color: #B8907A;
        }
        .cs-history-item--active {
          background: #F0E4DC;
          border-color: #B8907A;
        }
        .cs-history-item__prompt {
          font-size: 0.8125rem;
          color: #2D2926;
        }
        .cs-history-item__type {
          font-size: 0.6875rem;
          color: #A69E9A;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Output area */
        .cs-output {
          min-height: 400px;
        }
        .cs-output-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          min-height: 400px;
          background: #FDFBF8;
          border: 2px dashed #DDD6CD;
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          color: #7A7471;
        }
        .cs-output-empty__icon {
          font-size: 2.5rem;
        }
        .cs-output-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          min-height: 400px;
          color: #7A7471;
        }
        .cs-output-actions {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          justify-content: flex-end;
        }
        .cs-output-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 1100px) {
          .cs-output-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        /* Output panels */
        .cs-output-panel {
          background: #FDFBF8;
          border: 1px solid #DDD6CD;
          border-radius: 12px;
          overflow: hidden;
        }
        .cs-output-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #EDE7DF;
          background: #F7F3EE;
        }
        .cs-output-panel__label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #7A7471;
        }
        .cs-output-panel__actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        /* Blog preview */
        .cs-blog-preview {
          padding: 1.5rem;
          max-height: 600px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #DDD6CD transparent;
        }
        .cs-blog-preview__title {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.375rem;
          font-weight: 600;
          color: #2D2926;
          line-height: 1.3;
          margin-bottom: 1.25rem;
        }
        .cs-blog-preview__body p {
          margin-bottom: 0.875rem;
          font-size: 0.9375rem;
          line-height: 1.75;
          color: #2D2926;
        }
        .cs-blog-h3 {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.125rem;
          font-weight: 600;
          color: #2D2926;
          margin: 1.25rem 0 0.5rem;
        }
        .cs-blog-h4 {
          font-size: 1rem;
          font-weight: 700;
          color: #2D2926;
          margin: 1rem 0 0.375rem;
        }

        /* Instagram preview */
        .cs-ig-preview {
          padding: 1.25rem;
        }
        .cs-ig-preview__header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .cs-ig-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #B8907A, #8B9E87);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #FDFBF8;
          flex-shrink: 0;
        }
        .cs-ig-handle {
          font-size: 0.875rem;
          font-weight: 700;
          color: #2D2926;
        }
        .cs-ig-location {
          font-size: 0.75rem;
          color: #7A7471;
        }
        .cs-ig-preview__body {
          max-height: 300px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #DDD6CD transparent;
          margin-bottom: 1rem;
        }
        .cs-ig-preview__body p {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #2D2926;
          margin-bottom: 0.5rem;
        }
        .cs-ig-preview__hashtags {
          font-size: 0.875rem;
          color: #3897F0;
          line-height: 1.7;
          padding-top: 0.75rem;
          border-top: 1px solid #EDE7DF;
        }

        /* Char count */
        .cs-char-count {
          font-size: 0.75rem;
          color: #A69E9A;
          padding: 0.25rem 0.5rem;
          background: #F7F3EE;
          border-radius: 4px;
        }
        .cs-char-count--warn {
          color: #c0392b;
          background: #fdf2f2;
        }

        /* Buttons */
        .cs-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 150ms ease;
          text-decoration: none;
          border: 1.5px solid transparent;
          white-space: nowrap;
        }
        .cs-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cs-btn--primary {
          background: #B8907A;
          color: #FDFBF8;
          border-color: #B8907A;
        }
        .cs-btn--primary:hover:not(:disabled) {
          background: #9E7A65;
          border-color: #9E7A65;
        }
        .cs-btn--outline {
          background: transparent;
          color: #2D2926;
          border-color: #DDD6CD;
        }
        .cs-btn--outline:hover:not(:disabled) {
          border-color: #B8907A;
          color: #B8907A;
        }
        .cs-btn--ghost {
          background: transparent;
          color: #7A7471;
          border-color: transparent;
        }
        .cs-btn--ghost:hover:not(:disabled) {
          color: #2D2926;
          background: #F7F3EE;
        }
        .cs-btn--success {
          background: #6B7F67 !important;
          border-color: #6B7F67 !important;
          color: #FDFBF8 !important;
        }
        .cs-btn--sm {
          padding: 0.4rem 0.875rem;
          font-size: 0.8125rem;
        }
        .cs-btn--lg {
          padding: 1rem 2rem;
          font-size: 1.0625rem;
        }
        .cs-btn--full {
          width: 100%;
        }

        /* Loading */
        .cs-loading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .cs-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(253,251,248,0.4);
          border-top-color: #FDFBF8;
          border-radius: 50%;
          animation: cs-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .cs-spinner--lg {
          width: 40px;
          height: 40px;
          border-width: 3px;
          border-color: #DDD6CD;
          border-top-color: #B8907A;
        }
        @keyframes cs-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
