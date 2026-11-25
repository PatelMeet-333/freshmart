import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Alert } from '../components/Misc.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Auth({ mode }) {
  const isLogin = mode === 'login';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const goTo = from ? `${from.pathname}${from.search || ''}` : '/';
  const cameFromCheckout = from?.pathname === '/checkout';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef(null);

  // Make sure the message is seen, even on short screens.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  if (user) return <Navigate to={goTo} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!isLogin && form.name.trim().length < 2) return setError('Enter your name');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address');
    if (!isLogin && form.password.length < 8) return setError('Use at least 8 characters for your password');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(goTo, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-media" aria-hidden="true">
        <img src="/images/market.jpg" alt="" />
      </div>
      <form className="auth-card" onSubmit={submit} noValidate>
        <span className="logo-mark logo-mark-lg">
          <Icon name="leaf" size={26} />
        </span>
        <div>
          <h1 className="auth-title">{isLogin ? (cameFromCheckout ? 'Log in to place your order' : 'Welcome back') : 'Create your account'}</h1>
          <p className="muted">
            {cameFromCheckout ? 'Your cart is saved. It’ll be waiting after you log in.' : isLogin ? 'Log in to check out faster.' : 'It takes less than a minute.'}
          </p>
        </div>
        {error && (
          <div ref={errorRef}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        {!isLogin && (
          <label className="field">
            Your name
            <input autoComplete="name" value={form.name} onChange={set('name')} />
          </label>
        )}
        <label className="field">
          Email
          <input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          Password
          <span className="input-with-action">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
            />
            <button type="button" className="input-action" onClick={() => setShowPw((s) => !s)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </span>
          {!isLogin && <span className="hint">At least 8 characters</span>}
        </label>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner spinner-sm spinner-light" /> : isLogin ? 'Log in' : 'Create account'}
        </button>
        <p className="center muted">
          {isLogin ? 'New to FreshMart? ' : 'Already have an account? '}
          <Link to={isLogin ? '/register' : '/login'} state={location.state} className="link-strong">
            {isLogin ? 'Create an account' : 'Log in'}
          </Link>
        </p>
      </form>
    </div>
  );
}
