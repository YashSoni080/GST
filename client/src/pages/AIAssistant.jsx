import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';

const SUGGESTIONS = [
  'What is our unutilized IGST balance as of today?',
  'Show all vendors with blocked credit under Section 17(5)',
  'Are there any unpaid vendor bills older than 180 days under Rule 37?',
  'What invoices are currently pending IRN generation?',
  'What is our current Department Audit Risk Score and notices status?',
  'What is our total turnover and net tax payable?',
  'What is the statutory E-Way bill threshold and validity?',
  'Explain Reverse Charge Mechanism (RCM) rules',
  'What are the mandatory rules for GSTR-2B reconciliation?',
  'Add 18% GST on 25000 and show the CGST/SGST split',
];

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

export default function AIAssistant() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // AI Configuration State (Persisted in localStorage)
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('gst_ai_provider') || 'builtin');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gst_ai_api_key') || '');
  const [tempApiKey, setTempApiKey] = useState(() => localStorage.getItem('gst_ai_api_key') || '');
  const [tempProvider, setTempProvider] = useState(() => localStorage.getItem('gst_ai_provider') || 'builtin');

  const messagesEndRef = useRef(null);

  const initialMessage = {
    sender: 'ai',
    text: 'Hello! I am your **AI GST Compliance Copilot**. I analyze your live ledger data, verify compliance with statutory rules, and assess departmental audit exposure in real-time.\n\nAsk me anything about your unutilized tax credits, blocked credits under Section 17(5), pending e-invoices, departmental notices, Rule 37 180-day vendor aging, or GST statutory provisions.',
  };

  const [messages, setMessages] = useState([initialMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
  };

  const handleSend = async (qText) => {
    const textToSend = qText || query;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = { sender: 'user', text: textToSend.trim() };
    const history = messages.slice(-12).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const options = { provider: aiProvider, history };
      if (aiProvider !== 'builtin' && apiKey) {
        options.apiKey = apiKey;
      }

      const res = await api.queryAIAssistant(textToSend.trim(), options);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res?.answer || 'No response details received from compliance engine.',
          metrics: res?.metrics,
          table: res?.table,
          engine: res?.engine,
          warning: res?.warning,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ **Error processing query**: ${err.message || 'Unable to connect to AI compliance engine. Please ensure the server is running.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([initialMessage]);
    setQuery('');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      {/* Top Engine & Quick Prompts Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Engine:</span>
          <span
            className="badge"
            style={{
              fontSize: 11,
              padding: '2px 10px',
              borderRadius: 999,
              background: activeEngine.mode === 'cloud' ? '#e6fffa' : 'var(--border, #e2e8f0)',
              color: activeEngine.mode === 'cloud' ? 'var(--teal, #0d9488)' : 'var(--text)',
            }}
          >
            🤖 {activeModeLabel}
          </span>
          <button
            className="btn outline small"
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6 }}
            onClick={() => {
              setTempProvider(aiProvider);
              setTempApiKey(apiKey);
              setShowSettings(true);
            }}
          >
            ⚙️ AI Settings
          </button>
        </div>

        <button
          className="btn outline small"
          style={{ fontSize: 11, color: 'var(--muted)', borderRadius: 6 }}
          onClick={handleClear}
          title="Clear conversation"
        >
          🗑️ Clear Chat
        </button>
      </div>

      {/* Suggested Chips Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Suggested:
        </span>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            className="btn outline small"
            style={{ fontSize: 11.5, whiteSpace: 'nowrap', borderRadius: 999, padding: '3px 10px' }}
            onClick={() => handleSend(s)}
            disabled={loading}
          >
            💬 {s}
          </button>
        ))}
      </div>

      {/* Messages Thread Container */}
      <div
        className="card"
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
        {messages.map((m, idx) => (
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
              style={{
                padding: '12px 16px',
                borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: m.sender === 'user' ? 'var(--primary)' : '#f8fafc',
                color: m.sender === 'user' ? '#fff' : 'var(--text)',
                border: m.sender === 'user' ? 'none' : '1px solid var(--border)',
                fontSize: 13.5,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, opacity: 0.85 }}>
                {m.sender === 'user' ? 'You (Tax Manager)' : '🤖 GST Compliance Copilot'}
              </div>
              <div dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }} />
            </div>

            {/* Engine fallback notice reported by the server */}
            {m.warning && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#9a3412',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <span>⚠️</span>
                <span>{m.warning}</span>
              </div>
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
                    style={{
                      background: '#fff',
                      border: '1px solid var(--border)',
                      padding: '8px 14px',
                      borderRadius: 8,
                      boxShadow: 'var(--shadow)',
                      minWidth: 120,
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>{met.label}</div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        marginTop: 2,
                        color:
                          met.type === 'positive'
                            ? 'var(--teal)'
                            : met.type === 'negative'
                            ? 'var(--red)'
                            : met.type === 'warning'
                            ? '#d97706'
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
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
                <table style={{ margin: 0, fontSize: 12.5, width: '100%' }}>
                  <thead>
                    <tr>
                      {m.table.headers.map((h, i) => (
                        <th key={i} style={{ padding: '8px 12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.table.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '8px 12px' }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              background: '#f8fafc',
              border: '1px solid var(--border)',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              className="spinner"
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                border: '2px solid var(--primary)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Analyzing live ledger records and synthesizing compliance state...
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
        style={{ display: 'flex', gap: 10, marginTop: 12 }}
      >
        <input
          className="input"
          placeholder="Ask anything (e.g. 'What is our unutilized IGST balance?', 'How does RCM work?', or 'What is my turnover?')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          style={{ flex: 1, padding: 12, borderRadius: 10 }}
        />
        <button
          type="submit"
          className="btn"
          disabled={loading || !query.trim()}
          style={{ padding: '0 24px', borderRadius: 10 }}
        >
          Ask Copilot
        </button>
      </form>

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="card"
            style={{
              width: 480,
              maxWidth: '90%',
              padding: 24,
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0' }}>⚙️ AI Copilot Engine Configuration</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Choose whether to use the built-in zero-config GST Tax Intelligence Engine, or connect a live LLM (Google Gemini / OpenAI) with your API key.
            </p>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  AI Provider:
                </label>
                <select
                  className="input"
                  value={tempProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="builtin">Built-in Tax Intelligence (Zero-Config / Free / Offline)</option>
                  <option value="gemini">Google Gemini 2.5 Flash (Cloud LLM)</option>
                  <option value="openai">OpenAI GPT-4o-mini (Cloud LLM)</option>
                </select>
              </div>

              {tempProvider !== 'builtin' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {tempProvider === 'gemini' ? 'Google Gemini API Key:' : 'OpenAI API Key:'}
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder={tempProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    {tempApiKey.trim()
                      ? 'Key is kept in your browser and sent with each query to answer via the cloud LLM.'
                      : 'No key entered — the copilot will fall back to the built-in engine (or the server key if one is configured).'}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
