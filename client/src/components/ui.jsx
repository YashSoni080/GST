import { Link } from 'react-router-dom';

/* ---------------------------------------------------------------- skeletons */

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-line"
          style={{ width: `${[100, 92, 76, 84, 68][i % 5]}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 96 }) {
  return <div className="skeleton skeleton-card" style={{ height }} aria-hidden="true" />;
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="row" style={{ gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="skeleton skeleton-line"
              style={{ flex: c === 0 ? '0 0 22%' : '1 1 0%', marginBottom: 0, height: 14 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = '', label }) {
  return (
    <span className="row" style={{ gap: 9, color: 'var(--muted)', fontSize: 13 }}>
      <span className={`spinner ${size}`} />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------ empty/error */

export function EmptyState({ icon = '🗂️', title, description, action, secondaryAction, children }) {
  return (
    <div className="empty-state">
      <div className="es-icon" aria-hidden="true">{icon}</div>
      {title ? <div className="es-title">{title}</div> : null}
      {description ? <div className="es-desc">{description}</div> : null}
      {children}
      {action || secondaryAction ? (
        <div className="es-actions">
          {action ? (
            action.to ? (
              <Link to={action.to} className="btn">{action.label}</Link>
            ) : (
              <button type="button" className="btn" onClick={action.onClick}>{action.label}</button>
            )
          ) : null}
          {secondaryAction ? (
            secondaryAction.to ? (
              <Link to={secondaryAction.to} className="btn outline">{secondaryAction.label}</Link>
            ) : (
              <button type="button" className="btn outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load this data' }) {
  const message =
    typeof error === 'string' ? error : error?.message || 'The request failed. Check your connection and try again.';
  return (
    <div className="error-state">
      <div className="es-icon" aria-hidden="true">⚠</div>
      <div className="es-title">{title}</div>
      <div className="es-desc">{message}</div>
      {onRetry ? (
        <button type="button" className="btn outline small" onClick={onRetry} style={{ marginTop: 10 }}>
          ↻ Retry
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ stats */

export function StatCard({ label, icon, value, delta, deltaClass = '', accent, spark, children }) {
  const valueClass = accent ? `accent-${accent}` : '';
  return (
    <div className="card">
      <div className="stat-label">
        {icon ? <span className="stat-icon" aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className={`stat-value ${valueClass}`}>{value}</div>
      {delta ? <div className={`stat-delta ${deltaClass}`}>{delta}</div> : null}
      {typeof spark === 'number' ? (
        <div className="stat-spark"><span style={{ width: `${Math.max(4, Math.min(100, spark))}%` }} /></div>
      ) : null}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- callout */

export function Callout({ tone = '', icon, title, description, actions, children, style }) {
  return (
    <div className={`callout ${tone}`} style={style}>
      <div className="co-main">
        {icon ? <div className="co-icon" aria-hidden="true">{icon}</div> : null}
        <div style={{ minWidth: 0 }}>
          {title ? <div className="co-title">{title}</div> : null}
          {description ? <div className="co-desc">{description}</div> : null}
          {children}
        </div>
      </div>
      {actions ? <div className="co-actions">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({ open, onClose, title, subtitle, footer, children, maxWidth = 600 }) {
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
        }}
      >
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <div className="mh-sub">{subtitle}</div> : null}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
