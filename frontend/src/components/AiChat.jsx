/**
 * src/components/AiChat.jsx
 *
 * Floating AI chat widget — works on both InvestorDashboard and AdminDashboard.
 *
 * Props:
 *   userId    (string)  — logged-in user's _id, passed to agent so it only fetches their data
 *   userRole  (string)  — 'investor' | 'admin'
 *   campaignId (string) — optional, for admin milestone evaluation mode
 *
 * The widget calls the Enigma AI FastAPI server at VITE_AGENT_URL (default: http://localhost:8000).
 * It sends: { query, user_id, user_role, campaign_id, milestone_index }
 * It receives: { text, data }
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:8000';

// Suggested quick-start prompts per role
const INVESTOR_SUGGESTIONS = [
  '📊 Show my portfolio status',
  '🔍 Find fintech startups in seed stage',
  '⚡ Recommend low-risk investments for me',
  '📈 Which startups have the most progress?',
];

const ADMIN_SUGGESTIONS = [
  '📋 List all pending milestone reviews',
  '🔍 How many startups are verified?',
  '💰 Show total platform investment volume',
  '⚠️ Which campaigns have high-risk flags?',
];

function MarkdownText({ text }) {
  // Minimal markdown renderer — bold, bullet lists, inline code
  const lines = text.split('\n');
  return (
    <div className="ai-chat__markdown">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i}>{line.slice(4)}</h4>;
        if (line.startsWith('## '))  return <h3 key={i}>{line.slice(3)}</h3>;
        if (line.startsWith('# '))   return <h2 key={i}>{line.slice(2)}</h2>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={i} style={{ marginLeft: '1rem', color: 'var(--color-text-secondary)' }}>
              {renderInline(line.slice(2))}
            </li>
          );
        }
        if (line.trim() === '') return <br key={i} />;
        return <p key={i} style={{ margin: 0 }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text) {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ background: 'rgba(99,102,241,0.15)', padding: '2px 5px', borderRadius: 4, fontSize: '0.82em' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export default function AiChat({ userId, userRole = 'investor', campaignId = '' }) {
  const [isOpen, setIsOpen]       = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const suggestions = userRole === 'admin' ? ADMIN_SUGGESTIONS : INVESTOR_SUGGESTIONS;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (query) => {
    const text = query || input.trim();
    if (!text || loading) return;

    setInput('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const res = await fetch(`${AGENT_URL}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:           text,
          user_id:         userId  || '',
          user_role:       userRole,
          campaign_id:     campaignId || '',
          milestone_index: null,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Agent error ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.text || 'No response from agent.',
        raw:  data.data,
      }]);
    } catch (err) {
      setError(err.message || 'Could not reach the AI agent. Make sure the agent server is running.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: '⚠️ Agent unavailable. Please ensure the Enigma AI server is running on port 8000.',
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, userId, userRole, campaignId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => setMessages([]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        className="ai-chat__fab"
        onClick={() => setIsOpen(o => !o)}
        title="Enigma AI Assistant"
        aria-label="Toggle AI assistant"
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9" cy="10" r="1" fill="currentColor"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="1" fill="currentColor"/>
          </svg>
        )}
        {!isOpen && <span className="ai-chat__fab-label">AI</span>}
      </button>

      {/* ── Chat panel ── */}
      {isOpen && (
        <div className={`ai-chat__panel ${isExpanded ? 'ai-chat__panel--expanded' : ''}`}>

          {/* Header */}
          <div className="ai-chat__header">
            <div className="ai-chat__header-left">
              <div className="ai-chat__avatar">✦</div>
              <div>
                <div className="ai-chat__title">Enigma AI</div>
                <div className="ai-chat__subtitle">
                  {userRole === 'admin' ? 'Admin Intelligence' : 'Investment Assistant'}
                </div>
              </div>
            </div>
            <div className="ai-chat__header-actions">
              {messages.length > 0 && (
                <button className="ai-chat__icon-btn" onClick={clearChat} title="Clear chat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
              <button
                className="ai-chat__icon-btn"
                onClick={() => setIsExpanded(e => !e)}
                title={isExpanded ? 'Shrink' : 'Expand'}
              >
                {isExpanded ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                )}
              </button>
              <button className="ai-chat__icon-btn" onClick={() => setIsOpen(false)} title="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Message feed */}
          <div className="ai-chat__messages">

            {/* Empty state — suggestions */}
            {messages.length === 0 && (
              <div className="ai-chat__welcome">
                <div className="ai-chat__welcome-icon">✦</div>
                <p className="ai-chat__welcome-title">How can I help you?</p>
                <p className="ai-chat__welcome-sub">
                  {userRole === 'admin'
                    ? 'Ask about platform stats, milestone reviews, or any startup data.'
                    : 'Ask about your portfolio, find startups, or get investment insights.'}
                </p>
                <div className="ai-chat__suggestions">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      className="ai-chat__suggestion"
                      onClick={() => sendMessage(s.replace(/^[^\s]+ /, ''))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`ai-chat__message ai-chat__message--${msg.role} ${msg.isError ? 'ai-chat__message--error' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="ai-chat__msg-avatar">✦</div>
                )}
                <div className="ai-chat__bubble">
                  {msg.role === 'assistant'
                    ? <MarkdownText text={msg.text} />
                    : <span>{msg.text}</span>
                  }
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="ai-chat__message ai-chat__message--assistant">
                <div className="ai-chat__msg-avatar">✦</div>
                <div className="ai-chat__bubble ai-chat__typing">
                  <span className="ai-chat__dot" />
                  <span className="ai-chat__dot" />
                  <span className="ai-chat__dot" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="ai-chat__input-area">
            {error && (
              <div className="ai-chat__error-bar">{error}</div>
            )}
            <div className="ai-chat__input-row">
              <textarea
                ref={inputRef}
                className="ai-chat__input"
                placeholder={userRole === 'admin'
                  ? 'Ask anything about the platform…'
                  : 'Ask about your portfolio or find startups…'
                }
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
              />
              <button
                className={`ai-chat__send ${loading || !input.trim() ? 'ai-chat__send--disabled' : ''}`}
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                title="Send"
              >
                {loading ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: '#ffffff40', borderTopColor: '#fff' }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>
            <div className="ai-chat__footer-note">
              Powered by Gemini 2.5 Flash · Enigma AI
            </div>
          </div>

        </div>
      )}
    </>
  );
}
