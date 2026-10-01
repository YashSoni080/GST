import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Skeleton, Spinner, EmptyState, Callout, Modal } from '../components/ui';

const SUGGESTION_GROUPS = [
  {
    label: 'Credits & ledgers',
    items: [
      'What is our unutilized IGST balance as of today?',
      'Show all vendors with blocked credit under Section 17(5)',
      'Are there any unpaid vendor bills older than 180 days under Rule 37?',
      'What is our total turnover and net tax payable?',
    ],
  },
  {
    label: 'E-invoicing & e-way bills',
    items: [
      'What invoices are currently pending IRN generation?',
      'What is the statutory E-Way bill threshold and validity?',
    ],
  },
  {
    label: 'Audit, notices & risk',
    items: ['What is our current Department Audit Risk Score and notices status?'],
  },
  {
    label: 'Statutory playbook',
    items: [
      'Explain Reverse Charge Mechanism (RCM) rules',
      'What are the mandatory rules for GSTR-2B reconciliation?',
      'Add 18% GST on 25000 and show the CGST/SGST split',
    ],
  },
];

const SUGGESTIONS = SUGGESTION_GROUPS.flatMap((g) => g.items);

const PROVIDER_LABELS = {
  builtin: 'Built-in Tax Intelligence',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
};

const isNumericCell = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return Number.isFinite(v);
  const n = Number(String(v).replace(/[₹$,%\s]/g, ''));
  return Number.isFinite(n) && String(v).replace(/[₹$,%\s]/g, '') !== '';
};

const fmtTime = (t) =>
  t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

function formatMarkdown(text) {
  if (!text) return '';
  // 1. Escape raw HTML entities
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Bold text **bold**
  let formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. Inline code `code`
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code style="background: rgba(0,0,0,0.06); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>'
  );

  // 4. Bullet lists
  formatted = formatted.replace(/^[-•*]\s+(.+)$/gm, '• $1');

  // 5. Line breaks
  formatted = formatted.replace(/\n/g, '<br />');

  return formatted;
}

const makeInitialMessage = () => ({
  sender: 'ai',
  at: Date.now(),
  text: 'Hello! I am your **AI GST Compliance Copilot**. I analyze your live ledger data, verify compliance with statutory rules, and assess departmental audit exposure in real-time.\n\nAsk me anything about your unutilized tax credits, blocked credits under Section 17(5), pending e-invoices, departmental notices, Rule 37 180-day vendor aging, or GST statutory provisions.',
});

export default function AIAssistant() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // AI Configuration State (Persisted in localStorage)
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('gst_ai_provider') || 'builtin');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gst_ai_api_key') || '');
  const [tempApiKey, setTempApiKey] = useState(() => localStorage.getItem('gst_ai_api_key') || '');
  const [tempProvider, setTempProvider] = useState(() => localStorage.getItem('gst_ai_provider') || 'builtin');

  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState(() => [makeInitialMessage()]);

  useEffect(() => {
    if (!messages.some(m => m.sender === 'user')) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading, failed]);

  const handleProviderChange = (value) => {
    setTempProvider(value);
    // Drop a stored key that clearly belongs to the other provider
    const key = tempApiKey.trim();
    if (!key) return;
    const looksGemini = key.startsWith('AIza');
    const looksOpenAI = key.startsWith('sk-');
    if ((value === 'gemini' && looksOpenAI) || (value === 'openai' && looksGemini)) {
      setTempApiKey('');
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setAiProvider(tempProvider);
    setApiKey(tempApiKey.trim());
    localStorage.setItem('gst_ai_provider', tempProvider);
    if (tempApiKey.trim()) {
      localStorage.setItem('gst_ai_api_key', tempApiKey.trim());
    } else {
      localStorage.removeItem('gst_ai_api_key');
    }
    setShowSettings(false);
    toast.success('AI settings saved', `${PROVIDER_LABELS[tempProvider] || tempProvider} is now the configured engine.`);
  };

  const handleSend = useCallback(
    async (qText, opts = {}) => {
      if (loading) return;
      const textToSend = (qText || query).trim();
      if (!textToSend) return;

      const retry = Boolean(opts.retry);
      setFailed(null);
      setQuery('');
      setLoading(true);

      let base = messages;
      const tail = base[base.length - 1];
      if (retry && tail && tail.sender === 'user' && tail.text === textToSend) {
        base = base.slice(0, -1);
      }
      const history = base.slice(-12).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      if (!retry) {
        setMessages((prev) => [...prev, { sender: 'user', text: textToSend, at: Date.now() }]);
      }

      try {
        const options = { provider: aiProvider, history };
        if (aiProvider !== 'builtin' && apiKey) {
          options.apiKey = apiKey;
        }

        const res = await api.queryAIAssistant(textToSend, options);
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            at: Date.now(),
            text: res?.answer || 'No response details received from compliance engine.',
            metrics: res?.metrics,
            table: res?.table,
            engine: res?.engine,
            warning: res?.warning,
          },
        ]);
        toast.success('Answer received', `Responded by ${res?.engine?.label || PROVIDER_LABELS[aiProvider]}.`);
      } catch (err) {
        const message =
          err?.message || 'Unable to connect to the AI compliance engine. Please ensure the server is running.';
        setFailed({ text: textToSend, message });
        toast.error('Query failed', message);
      } finally {
        setLoading(false);
      }
    },
    [loading, query, messages, aiProvider, apiKey, toast],
  );

  const handleClear = () => {
    setMessages([makeInitialMessage()]);
    setQuery('');
    setFailed(null);
    setShowClearConfirm(false);
    toast.info('Conversation cleared', 'A fresh thread with your GST copilot has been started.');
  };

  const configuredEngine =
    aiProvider === 'gemini' && apiKey
      ? { id: 'gemini', label: 'Google Gemini (Cloud LLM)', mode: 'cloud' }
      : aiProvider === 'openai' && apiKey
      ? { id: 'openai', label: 'OpenAI GPT-4o-mini (Cloud LLM)', mode: 'cloud' }
      : aiProvider === 'gemini'
      ? { id: 'gemini', label: 'Google Gemini — key required', mode: 'builtin' }
      : aiProvider === 'openai'
      ? { id: 'openai', label: 'OpenAI — key required', mode: 'builtin' }
      : { id: 'builtin', label: 'Built-in Tax Intelligence (Zero-Config)', mode: 'builtin' };

  // The server reports which engine actually answered the last message
  const lastEngine = [...messages].reverse().find((m) => m.engine)?.engine;
  const activeEngine = lastEngine || configuredEngine;
  const activeModeLabel =
    activeEngine.mode === 'cloud' ? `${activeEngine.label} (Cloud LLM)` : activeEngine.label || 'Built-in Tax Intelligence (Zero-Config)';

  const hasConversation = messages.some((m) => m.sender === 'user');

  const openSettings = () => {
    setTempProvider(aiProvider);
    setTempApiKey(apiKey);
    setShowSettings(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      {/* Top Engine & Quick Actions Bar */}
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Engine</span>
          <span
            className={`badge ${activeEngine.mode === 'cloud' ? 'violet' : 'gray'}`}
            title={activeModeLabel}
          >
            🤖 {activeModeLabel}
          </span>
          <button type="button" className="btn outline small" onClick={openSettings}>
            ⚙️ AI Settings
          </button>
        </div>

        <button
          type="button"
          className="btn outline small"
          onClick={() => setShowClearConfirm(true)}
          disabled={loading}
          title="Clear conversation"
        >
          🗑️ Clear Chat
        </button>
      </div>

      {/* Suggested Chips Bar — shown once a conversation is underway */}
      {hasConversation && (
        <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }}>
          <span
            className="section-label"
            style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
          >
            Suggested
          </span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="pill"
              style={{ fontSize: 12 }}
              onClick={() => handleSend(s)}
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages Thread Container */}
      <div
        className="card"
        role="log"
        aria-label="Conversation with the GST compliance copilot"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 20,
          background: '#fff',
        }}
      >
        {!hasConversation ? (
          <EmptyState
            icon="🤖"
            title="Ask your GST Compliance Copilot"
            description="I analyse your live ledger data, verify compliance with statutory rules and assess departmental audit exposure in real-time. Pick a prompt below or type your own question."
          >
            <div
              style={{
                width: '100%',
                maxWidth: 840,
                textAlign: 'left',
                marginTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {SUGGESTION_GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="section-label" style={{ marginBottom: 8 }}>{g.label}</div>
                  <div className="pills">
                    {g.items.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="pill"
                        style={{ whiteSpace: 'normal', textAlign: 'left' }}
                        onClick={() => handleSend(s)}
                        disabled={loading}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </EmptyState>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                className={m.sender === 'user' ? '' : 'card'}
                style={{
                  padding: '12px 16px',
                  borderRadius: m.sender === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  background: m.sender === 'user' ? 'var(--primary)' : undefined,
                  color: m.sender === 'user' ? '#fff' : 'var(--text)',
                  border: m.sender === 'user' ? 'none' : undefined,
                  boxShadow: m.sender === 'user' ? '0 10px 22px -14px rgba(31, 94, 255, 0.9)' : undefined,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 14,
                    marginBottom: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: 0.85,
                  }}
                >
                  <span>{m.sender === 'user' ? 'You (Tax Manager)' : '🤖 GST Compliance Copilot'}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{fmtTime(m.at)}</span>
                </div>
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }} />
              </div>

              {/* Engine fallback notice reported by the server */}
              {m.warning && (
                <Callout
                  tone="risk"
                  icon="⚠️"
                  title="Engine fallback"
                  description={m.warning}
                  style={{ padding: '10px 14px' }}
                />
              )}

              {/* Which engine actually produced this answer */}
              {m.sender === 'ai' && m.engine && (
                <div style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.02em' }}>
                  Answered by {m.engine.label}
                  {m.engine.mode === 'cloud' ? ' · Cloud LLM' : ' · runs locally on your ledger data'}
                </div>
              )}

              {/* Optional AI Extracted Metrics */}
              {m.metrics && Array.isArray(m.metrics) && m.metrics.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {m.metrics.map((met, i) => (
                    <div
                      key={i}
                      className="card"
                      style={{ padding: '9px 14px', minWidth: 130, boxShadow: 'none' }}
                    >
                      <div className="stat-label" style={{ fontSize: 10.5 }}>{met.label}</div>
                      <div
                        className="stat-value num"
                        style={{
                          fontSize: 17,
                          marginTop: 3,
                          color:
                            met.type === 'positive'
                              ? 'var(--teal)'
                              : met.type === 'negative'
                              ? 'var(--red)'
                              : met.type === 'warning'
                              ? 'var(--amber)'
                              : 'var(--primary)',
                        }}
                      >
                        {met.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional AI Data Table */}
              {m.table && m.table.headers && m.table.rows && (
                <div className="card" style={{ padding: '4px 6px 6px' }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {m.table.headers.map((h, i) => {
                            const numeric = (m.table.rows || []).some((row) => isNumericCell(row[i]));
                            return (
                              <th key={i} className={numeric ? 'num' : ''}>{h}</th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {m.table.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => {
                              const numeric = isNumericCell(cell);
                              return (
                                <td key={cIdx} className={numeric ? 'num' : ''}>{cell}</td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Inline failure card with retry */}
        {failed && (
          <Callout
            tone="danger"
            icon="⚠️"
            title="The copilot could not answer that"
            description={failed.message}
            actions={
              <>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => handleSend(failed.text, { retry: true })}
                  disabled={loading}
                >
                  ↻ Retry
                </button>
                <button type="button" className="btn outline small" onClick={() => setFailed(null)}>
                  Dismiss
                </button>
              </>
            }
          />
        )}

        {/* Thinking indicator */}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              className="card"
              style={{
                padding: '11px 16px',
                borderRadius: '14px 14px 14px 3px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Spinner size="sm" />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                Analyzing live ledger records and synthesizing compliance state…
              </span>
            </div>
            <Skeleton lines={2} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'stretch' }}
      >
        <textarea
          className="input"
          rows={2}
          aria-label="Ask the GST compliance copilot"
          placeholder="Ask anything (e.g. 'What is our unutilized IGST balance?', 'How does RCM work?', or 'What is my turnover?')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          style={{ flex: 1, minHeight: 56, resize: 'none', padding: '10px 14px' }}
        />
        <button
          type="submit"
          className="btn"
          disabled={loading || !query.trim()}
          aria-busy={loading}
          style={{ padding: '0 22px', alignSelf: 'stretch' }}
        >
          {loading ? (
            <>
              <span className="spinner sm" aria-hidden="true" />
              Thinking…
            </>
          ) : (
            'Ask Copilot'
          )}
        </button>
      </form>

      <div className="row" style={{ justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          <span className="kbd-hint">Enter</span> to send · <span className="kbd-hint">Shift + Enter</span> for a new line
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }} aria-live="polite">
          {loading ? 'Copilot is thinking…' : `${messages.length} message${messages.length === 1 ? '' : 's'} in this thread`}
        </span>
      </div>

      {/* Clear conversation confirmation */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear this conversation?"
        subtitle="Chat history, metrics and table results will be removed from this session."
        maxWidth={460}
        footer={
          <>
            <button type="button" className="btn outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </button>
            <button type="button" className="btn danger" onClick={handleClear}>
              Clear conversation
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Your engine selection and API key stay untouched — only the chat thread is reset.
        </p>
      </Modal>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="⚙️ AI Copilot Engine Configuration"
        subtitle="Use the built-in zero-config tax engine, or connect Google Gemini / OpenAI with your own key."
        maxWidth={520}
        footer={
          <>
            <button type="button" className="btn outline" onClick={() => setShowSettings(false)}>
              Cancel
            </button>
            <button type="submit" form="ai-settings-form" className="btn">
              Save Settings
            </button>
          </>
        }
      >
        <form
          id="ai-settings-form"
          onSubmit={handleSaveSettings}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ai-provider">AI Provider</label>
            <select
              id="ai-provider"
              className="input"
              value={tempProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              <option value="builtin">Built-in Tax Intelligence (Zero-Config / Free / Offline)</option>
              <option value="gemini">Google Gemini 2.5 Flash (Cloud LLM)</option>
              <option value="openai">OpenAI GPT-4o-mini (Cloud LLM)</option>
            </select>
          </div>

          {tempProvider !== 'builtin' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="ai-api-key">
                {tempProvider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}
              </label>
              <input
                id="ai-api-key"
                type="password"
                className="input"
                autoComplete="off"
                placeholder={tempProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
              />
              <span className="form-hint">
                {tempApiKey.trim()
                  ? 'Key is kept in your browser and sent with each query to answer via the cloud LLM.'
                  : 'No key entered — the copilot will fall back to the built-in engine (or the server key if one is configured).'}
              </span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
