import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Icon } from './Icon.jsx';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="FreshMart home">
      <span className="logo-mark">
        <Icon name="leaf" size={22} />
      </span>
      <span className="logo-word">FreshMart</span>
    </Link>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');

  // Keep the box in sync when the URL changes (e.g. clicking the logo).
  useEffect(() => {
    setQ(params.get('q') || '');
  }, [params]);

  // Search as you type, after a short pause.
  useEffect(() => {
    const current = params.get('q') || '';
    if (q.trim() === current) return undefined;
    const t = setTimeout(() => {
      const next = new URLSearchParams(location.pathname === '/' ? params : undefined);
      if (q.trim()) next.set('q', q.trim());
      else next.delete('q');
      navigate({ pathname: '/', search: next.toString(), hash: q.trim() ? 'shop' : '' }, { replace: location.pathname === '/' });
    }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="site-header">
      <div className="container header-row">
        <Logo />
        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="search" size={20} />
          <input type="search" aria-label="Search products" placeholder="Search for tomatoes, milk, atta…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <nav className="header-nav" aria-label="Account and cart">
          {user ? (
            <button type="button" className="btn btn-ghost" onClick={logout} title={`Logged in as ${user.email}`} aria-label="Log out">
              <Icon name="logout" size={20} />
              <span className="hide-sm">Log out</span>
            </button>
          ) : (
            <Link to="/login" state={{ from: location }} className="btn btn-ghost">
              <Icon name="user" size={20} />
              Log in
            </Link>
          )}
          <Link to="/cart" className="btn btn-primary cart-btn" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
            <Icon name="cart" size={20} />
            <span className="hide-sm">Cart</span>
            <span className="cart-count">{count}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
