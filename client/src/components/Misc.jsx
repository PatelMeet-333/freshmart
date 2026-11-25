import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { onSlowChange } from '../lib/api.js';
import { Icon } from './Icon.jsx';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function PageSpinner({ label = 'Loading' }) {
  return (
    <div className="page-spinner" role="status">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Shown when the free Render server is waking up (PID risk: slow first load). */
export function WakeBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowChange(setSlow), []);
  if (!slow) return null;
  return (
    <div className="wake-banner" role="status">
      <span className="spinner spinner-sm" />
      Waking up the server. The first visit after a quiet spell can take up to a minute.
    </div>
  );
}

/** Back link + title bar used by the checkout screens. */
export function PageBar({ back, backLabel, title, subtitle }) {
  return (
    <div className="page-bar">
      <Link to={back} className="icon-btn" aria-label={backLabel}>
        <Icon name="arrowLeft" size={22} />
      </Link>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <span className="muted small">{subtitle}</span>}
      </div>
    </div>
  );
}

export function Steps({ current }) {
  const steps = ['Cart', 'Address', 'Payment'];
  return (
    <ol className="steps" aria-label="Checkout steps">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot">{state === 'done' ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
            {s}
            {i < steps.length - 1 && <span className="step-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Alert({ kind = 'info', children }) {
  const icon = kind === 'error' ? 'info' : kind === 'success' ? 'shield' : 'info';
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'note'}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}
