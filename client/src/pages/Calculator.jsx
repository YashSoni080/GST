import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { EmptyState } from '../components/ui';

const RATES = [0, 0.25, 3, 5, 12, 18, 28];
const QUICK_AMOUNTS = [1000, 10000, 100000, 1000000];
const HISTORY_KEY = 'gst_calculator_history';
const MAX_HISTORY = 8;

const KEY_LABELS = {
  AC: 'All clear',
  '⌫': 'Backspace',
  '%': 'Percent',
  '÷': 'Divide',
  '×': 'Multiply',
  '-': 'Minus',
  '+': 'Plus',
  '±': 'Toggle sign',
  '.': 'Decimal point',
  '=': 'Equals',
};

const inr = (n) =>
  '₹ ' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const plain = (n) => (Number.isFinite(n) ? n : 0).toFixed(2);

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/* ---------------------------------- Standard calculator ---------------------------------- */

const calcCompute = (a, b, op) => {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
};

const fmtNum = (n) => {
  if (!Number.isFinite(n)) return 'Error';
  const fixed = Math.abs(n).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  const [int, dec] = fixed.split('.');
  const grouped = Number(int).toLocaleString('en-IN');
  return (n < 0 ? '-' : '') + grouped + (dec ? '.' + dec : '');
};

const initialState = { entry: '0', acc: null, op: null, overwrite: true, expr: '' };

function reduceCalc(state, key) {
  const cur = parseFloat(state.entry.replace(/,/g, '')) || 0;

  if (/^[0-9.]$/.test(key)) {
    if (state.overwrite) {
      return { ...state, entry: key === '.' ? '0.' : key, overwrite: false };
    }
    if (key === '.' && state.entry.includes('.')) return state;
    if (state.entry.replace(/[-.]/g, '').length >= 12) return state;
    if (state.entry === '0' && key !== '.') return { ...state, entry: key };
    if (state.entry === '-0' && key !== '.') return { ...state, entry: '-' + key };
    return { ...state, entry: state.entry + key };
  }

  if (['+', '-', '×', '÷'].includes(key)) {
    if (state.op && state.acc !== null && !state.overwrite) {
      const result = calcCompute(state.acc, cur, state.op);
      return { entry: fmtNum(result), acc: result, op: key, overwrite: true, expr: `${fmtNum(result)} ${key}` };
    }
    const base = state.acc !== null && state.overwrite ? state.acc : cur;
    return { ...state, acc: base, op: key, overwrite: true, expr: `${fmtNum(base)} ${key}` };
  }

  if (key === '=') {
    if (state.op === null || state.acc === null) return { ...state, expr: '' };
    const result = calcCompute(state.acc, cur, state.op);
    return {
      entry: fmtNum(result),
      acc: null,
      op: null,
      overwrite: true,
      expr: `${fmtNum(state.acc)} ${state.op} ${fmtNum(cur)} =`,
    };
  }

  if (key === '%') {
    const value = state.op === '+' || state.op === '-' ? (state.acc || 0) * (cur / 100) : cur / 100;
    return { ...state, entry: fmtNum(value), overwrite: false };
  }

  if (key === '±') {
    if (state.entry.startsWith('-')) return { ...state, entry: state.entry.slice(1) };
    if (state.entry !== '0') return { ...state, entry: '-' + state.entry };
    return state;
  }

  if (key === '⌫') {
    if (state.overwrite) return state;
    const next = state.entry.slice(0, -1);
    return { ...state, entry: next === '' || next === '-' ? '0' : next, overwrite: next === '' || next === '-' };
  }

  if (key === 'AC') return { ...initialState };

  return state;
}

/* ---------------------------------- Page ---------------------------------- */

export default function Calculator() {
  const toast = useToast();

  // GST calculator
  const [mode, setMode] = useState('add'); // 'add' | 'extract'
  const [supply, setSupply] = useState('intra'); // 'intra' | 'inter'
  const [amount, setAmount] = useState('25,000');
  const [rate, setRate] = useState(18);
  const [customRate, setCustomRate] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState(loadHistory);

  // Standard calculator
  const [calc, setCalc] = useState(initialState);
  const [activeKey, setActiveKey] = useState(null);

  const num = parseFloat(String(amount).replace(/,/g, '')) || 0;
  const activeRate = customRate !== '' && Number(customRate) >= 0 ? Number(customRate) : rate;

  const result = useMemo(() => {
    const isAdd = mode === 'add';
    const net = isAdd ? num : num / (1 + activeRate / 100);
    const gross = isAdd ? num * (1 + activeRate / 100) : num;
    const tax = gross - net;
    const inter = supply === 'inter';
    return {
      net,
      gross,
      tax,
      cgst: inter ? 0 : tax / 2,
      sgst: inter ? 0 : tax / 2,
      igst: inter ? tax : 0,
      roundOff: Math.round(gross) - gross,
      inter,
      netShare: gross > 0 ? (net / gross) * 100 : 100,
      taxShare: gross > 0 ? (tax / gross) * 100 : 0,
    };
  }, [num, activeRate, mode, supply]);

  const pressKey = useCallback(
    (key) => {
      setCalc((prev) => reduceCalc(prev, key));
      setActiveKey(key);
      setTimeout(() => setActiveKey((k) => (k === key ? null : k)), 120);
      if (key === 'AC') {
        toast.info('Calculator cleared', 'The standard calculator has been reset to zero.');
      }
    },
    [toast],
  );

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      let key = null;
      if (/^[0-9.]$/.test(e.key)) key = e.key;
      else if (e.key === '+') key = '+';
      else if (e.key === '-') key = '-';
      else if (e.key === '*') key = '×';
      else if (e.key === '/') key = '÷';
      else if (e.key === '%') key = '%';
      else if (e.key === 'Enter' || e.key === '=') key = '=';
      else if (e.key === 'Escape') key = 'AC';
      else if (e.key === 'Backspace') key = '⌫';
      if (!key) return;
      e.preventDefault();
      pressKey(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pressKey]);

  useEffect(() => {
    if (calc.entry === 'Error') {
      toast.warning('Undefined result', 'That operation is invalid (division by zero or overflow). Press AC or type a new value.');
    }
  }, [calc.entry, toast]);

  const handleAmountChange = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(cleaned);
  };

  const summaryText = () =>
    [
      `GST Calculation — ${mode === 'add' ? 'GST added to net' : 'GST extracted from inclusive amount'}`,
      `Supply: ${result.inter ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'} | Rate: ${activeRate}%`,
      `Amount entered: ₹ ${num.toLocaleString('en-IN')}`,
      `Taxable value: ${inr(result.net)}`,
      result.inter
        ? `IGST: ${inr(result.igst)}`
        : `CGST: ${inr(result.cgst)} | SGST: ${inr(result.sgst)}`,
      `Invoice total: ${inr(result.gross)} (round off ${inr(result.roundOff)})`,
    ].join('\n');

  const copyText = async (text, description) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied', description);
      return true;
    } catch {
      toast.error('Copy failed', 'Clipboard access was blocked by the browser.');
      return false;
    }
  };

  const copySummary = async () => {
    const ok = await copyText(summaryText(), 'GST summary copied to the clipboard.');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const copyResult = async () => {
    if (calc.entry === 'Error' || calc.entry === '') {
      toast.warning('Nothing to copy', 'Run a valid calculation first.');
      return;
    }
    await copyText(calc.entry, `Result ${calc.entry} copied to the clipboard.`);
  };

  const saveToHistory = () => {
    const entry = {
      id: Date.now(),
      amount: num,
      rate: activeRate,
      mode,
      supply,
      total: result.gross,
      at: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => !(h.amount === num && h.rate === activeRate && h.mode === mode && h.supply === supply))].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    toast.success('Calculation saved', `${mode === 'add' ? 'Add' : 'Extract'} ${activeRate}% · ${inr(result.gross)} added to recent calculations.`);
  };

  const restore = (h) => {
    setAmount(Number(h.amount).toLocaleString('en-IN'));
    setRate(h.rate);
    setCustomRate('');
    setMode(h.mode);
    setSupply(h.supply);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Calculation restored', `${h.rate}% ${h.mode === 'add' ? 'addition' : 'extraction'} reloaded into the calculator.`);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    toast.info('History cleared', 'Saved calculations were removed from this browser.');
  };

  const KEYS = [
    ['AC', 'fn'], ['⌫', 'fn'], ['%', 'fn'], ['÷', 'op'],
    ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
    ['4', ''], ['5', ''], ['6', ''], ['-', 'op'],
    ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
    ['±', ''], ['0', ''], ['.', ''], ['=', 'eq'],
  ];

  return (
    <div className="calc-layout">
      {/* ---------------- GST Calculator ---------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>🧮 GST Calculator</h3>
            </div>
            <div className="seg" role="group" aria-label="Calculation mode">
              <button
                type="button"
                className={mode === 'add' ? 'active' : ''}
                aria-pressed={mode === 'add'}
                onClick={() => setMode('add')}
              >
                Add GST
              </button>
              <button
                type="button"
                className={mode === 'extract' ? 'active' : ''}
                aria-pressed={mode === 'extract'}
                onClick={() => setMode('extract')}
              >
                Extract GST
              </button>
            </div>
          </div>

          {/* Live display */}
          <div className="calc-display">
            <div className="cd-label">{mode === 'add' ? 'Invoice total (net + GST)' : 'Taxable value (from inclusive amount)'}</div>
            <div className="cd-value" key={`${plain(result.gross)}-${mode}`}>
              {mode === 'add' ? inr(result.gross) : inr(result.net)}
            </div>
            <div className="cd-sub">
              <span>{mode === 'add' ? `Net ${inr(result.net)}` : `Gross ${inr(result.gross)}`}</span>
              <span>GST @ {activeRate}% = {inr(result.tax)}</span>
              <span>{result.inter ? 'Inter-state · IGST' : 'Intra-state · CGST + SGST'}</span>
            </div>
          </div>

          {/* Amount */}
          <div style={{ marginTop: 18 }}>
            <label className="input-label" htmlFor="gst-amount">
              {mode === 'add' ? 'Net amount (exclusive of GST)' : 'Total amount (inclusive of GST)'}
            </label>
            <div className="calc-amount">
              <span className="cur" aria-hidden="true">₹</span>
              <input
                id="gst-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label={mode === 'add' ? 'Net amount in rupees, exclusive of GST' : 'Total amount in rupees, inclusive of GST'}
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={() => {
                  if (amount === '') return;
                  const n = Number(amount.replace(/,/g, ''));
                  if (!Number.isFinite(n)) {
                    setAmount('');
                    toast.warning('Invalid amount', 'Enter a numeric value — the field was cleared.');
                    return;
                  }
                  setAmount(n.toLocaleString('en-IN'));
                }}
                placeholder="0.00"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa}
                  type="button"
                  className="btn outline small"
                  style={{ fontSize: 12, borderRadius: 999 }}
                  aria-label={`Set amount to ${qa.toLocaleString('en-IN')} rupees`}
                  onClick={() => setAmount(qa.toLocaleString('en-IN'))}
                >
                  ₹{qa.toLocaleString('en-IN')}
                </button>
              ))}

              <button
                type="button"
                className="btn outline small"
                style={{ fontSize: 12, borderRadius: 999 }}
                aria-label="Clear the amount field"
                onClick={() => {
                  setAmount('');
                  toast.info('Amount cleared', 'Enter a new amount to recalculate GST.');
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* GST rate */}
          <div style={{ marginTop: 18 }}>
            <div className="input-label" id="gst-rate-label">GST rate slab</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-labelledby="gst-rate-label">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`rate-chip${customRate === '' && rate === r ? ' active' : ''}`}
                  aria-pressed={customRate === '' && rate === r}
                  onClick={() => {
                    setRate(r);
                    setCustomRate('');
                  }}
                >
                  {r}%
                </button>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  className="input"
                  style={{ width: 88, textAlign: 'center' }}
                  type="text"
                  inputMode="decimal"
                  aria-label="Custom GST rate in percent"
                  placeholder="Custom"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  onBlur={() => {
                    if (customRate === '') return;
                    const n = Number(customRate);
                    if (!Number.isFinite(n) || n < 0 || n > 100) {
                      setCustomRate('');
                      toast.warning('Invalid GST rate', 'Enter a rate between 0% and 100% — the selected slab is being used instead.');
                    }
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }} aria-hidden="true">%</span>
              </div>
            </div>
          </div>

          {/* Supply type */}
          <div style={{ marginTop: 18 }}>
            <div className="input-label" id="pos-label">Place of supply</div>
            <div className="seg" role="group" aria-labelledby="pos-label">
              <button
                type="button"
                className={supply === 'intra' ? 'active' : ''}
                aria-pressed={supply === 'intra'}
                onClick={() => setSupply('intra')}
              >
                Intra-state (CGST + SGST)
              </button>
              <button
                type="button"
                className={supply === 'inter' ? 'active' : ''}
                aria-pressed={supply === 'inter'}
                onClick={() => setSupply('inter')}
              >
                Inter-state (IGST)
              </button>
            </div>
          </div>

          {/* Breakdown */}
          <div className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="stat-label">Breakdown</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Tax accounts for {result.taxShare.toFixed(1)}% of the total
              </span>
            </div>

            <div className="prop-bar" title="Taxable value vs GST">
              <div className="pb-net" style={{ width: `${result.netShare}%` }} />
              <div className="pb-tax" style={{ width: `${result.taxShare}%` }} />
            </div>

            <div className="result-row">
              <span>Taxable value</span>
              <span className="rr-value">{inr(result.net)}</span>
            </div>
            {result.inter ? (
              <div className="result-row">
                <span>IGST</span>
                <span className="rr-value" style={{ color: 'var(--amber-ink)' }}>{inr(result.igst)}</span>
              </div>
            ) : (
              <>
                <div className="result-row">
                  <span>CGST (Central)</span>
                  <span className="rr-value" style={{ color: 'var(--amber-ink)' }}>{inr(result.cgst)}</span>
                </div>
                <div className="result-row">
                  <span>SGST (State)</span>
                  <span className="rr-value" style={{ color: 'var(--amber-ink)' }}>{inr(result.sgst)}</span>
                </div>
              </>
            )}
            <div className="result-row">
              <span>Round off</span>
              <span className="rr-value" style={{ color: 'var(--muted)' }}>{inr(result.roundOff)}</span>
            </div>
            <div className="result-row total">
              <span style={{ fontWeight: 700 }}>Invoice total</span>
              <span className="rr-value" style={{ color: 'var(--primary)', fontSize: 18 }}>{inr(Math.round(result.gross))}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={saveToHistory}>
              ★ Save calculation
            </button>
            <button type="button" className="btn outline" onClick={copySummary}>
              {copied ? '✓ Copied' : '⧉ Copy summary'}
            </button>
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
            Intra-state supplies attract CGST + SGST under the CGST Act, 2017; inter-state supplies attract IGST under the
            IGST Act, 2017. Reverse Charge, cess and TDS/TCS are not applied here.
          </p>
        </div>
      </div>

      {/* ---------------- Keypad + history ---------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>Standard Calculator</h3>
            </div>
            <button type="button" className="btn outline small" onClick={copyResult}>
              {calc.entry === 'Error' ? '⧉ Copy result' : `⧉ Copy ${calc.entry}`}
            </button>
          </div>

          <div className="calc-expr">{calc.expr || '\u00A0'}</div>
          <div className="calc-out" key={calc.entry} aria-live="polite">
            {calc.entry}
          </div>

          <div
            className="row"
            role="group"
            style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: 12 }}
            aria-label="Keyboard shortcuts"
          >
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Keyboard:</span>
            <span className="kbd-hint">0-9</span>
            <span className="kbd-hint">+ − * /</span>
            <span className="kbd-hint">%</span>
            <span className="kbd-hint">Enter</span>
            <span className="kbd-hint">⌫</span>
            <span className="kbd-hint">Esc = AC</span>
          </div>

          <div className="calc-keys">
            {KEYS.map(([key, kind]) => (
              <button
                key={key}
                type="button"
                className={`calc-key ${kind}${activeKey === key ? ' pressed' : ''}`}
                onClick={() => pressKey(key)}
                aria-label={KEY_LABELS[key] || key}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>Recent calculations</h3>
            </div>
            {history.length > 0 && (
              <button type="button" className="link" style={{ background: 'none', border: 'none', fontSize: 12 }} onClick={clearHistory}>
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <EmptyState
              icon="🕘"
              title="No saved calculations yet"
              description="Run a GST calculation and press Save calculation — your last 8 results are kept in this browser so you can restore them in one click."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h) => (
                <button key={h.id} type="button" className="hist-item" onClick={() => restore(h)} title="Restore this calculation">
                  <div style={{ textAlign: 'left' }}>
                    <div className="hi-title">
                      {h.mode === 'add' ? 'Add' : 'Extract'} {h.rate}% · {h.supply === 'inter' ? 'IGST' : 'CGST+SGST'}
                    </div>
                    <div className="hi-sub">
                      ₹ {Number(h.amount).toLocaleString('en-IN')} ·{' '}
                      {new Date(h.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="hi-value">{inr(h.total)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
