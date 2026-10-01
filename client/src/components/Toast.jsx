import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: '✓', error: '!', warning: '⚠', info: 'i' };
const DEFAULT_DURATION = { success: 3800, info: 4200, warning: 5200, error: 6500 };

let toastSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220);
  }, []);

  const push = useCallback(
    (type, title, description = '') => {
      const id = ++toastSeq;
      const duration = DEFAULT_DURATION[type] || 4200;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, description) => push('success', title, description),
      error: (titleOrError, description) => {
        if (titleOrError instanceof Error) {
          return push('error', 'Something went wrong', titleOrError.message);
        }
        return push('error', String(titleOrError || 'Something went wrong'), description || '');
      },
      warning: (title, description) => push('warning', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}${t.leaving ? ' leaving' : ''}`}>
            <div className="t-icon" aria-hidden="true">{ICONS[t.type] || 'i'}</div>
            <div className="t-body">
              <div className="t-title">{t.title}</div>
              {t.description ? <div className="t-desc">{t.description}</div> : null}
            </div>
            <button className="t-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ×
            </button>
            <span className="t-progress" style={{ animationDuration: `${DEFAULT_DURATION[t.type] || 4200}ms` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
