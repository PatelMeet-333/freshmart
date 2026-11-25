import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Alert } from '../components/Misc.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../lib/api.js';
import { CATEGORY_LOOK, rupees } from '../lib/format.js';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { count, subtotal } = useCart();
  const category = params.get('category') || 'All';
  const q = params.get('q') || '';
  const filtered = category !== 'All' || q;

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/products/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const qs = new URLSearchParams();
    if (category !== 'All') qs.set('category', category);
    if (q) qs.set('q', q);
    api(`/api/products?${qs}`)
      .then((d) => {
        if (cancelled) return;
        // On the main list, lead with products that have photos.
        const list = category === 'All' && !q ? [...d.products].sort((a, b) => Number(!a.image) - Number(!b.image)) : d.products;
        setProducts(list);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [category, q]);

  // Jump to the product list when a link ends in #shop.
  useEffect(() => {
    if (location.hash === '#shop') document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, location.search]);

  const total = useMemo(() => categories.reduce((s, c) => s + c.count, 0), [categories]);

  const pickCategory = (name) => {
    const next = new URLSearchParams(params);
    if (name === 'All') next.delete('category');
    else next.set('category', name);
    setParams(next, { replace: true });
  };

  return (
    <>
      {!filtered && (
        <section className="container hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <Icon name="leaf" size={16} />
              Your local grocery shop, now online
            </span>
            <h1>
              Fresh groceries,
              <br />
              ordered from home.
            </h1>
            <p className="lead">
              {total || 80} everyday essentials across 9 categories. Fill your cart from your phone or laptop and pay by UPI, card, net banking or cash on
              delivery.
            </p>
            <div className="hero-ctas">
              <a href="#shop" className="btn btn-primary btn-lg">
                Start shopping
                <Icon name="arrowRight" size={18} />
              </a>
              <a href="#categories" className="btn btn-outline-neutral btn-lg">
                Browse categories
              </a>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>Products</dt>
                <dd>{total || 80}+</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>9</dd>
              </div>
              <div>
                <dt>Ways to pay</dt>
                <dd>UPI · Card · COD</dd>
              </div>
            </dl>
          </div>
          <div className="hero-media">
            <img src="/images/hero.jpg" alt="Shelves of fresh vegetables" fetchpriority="high" />
            <div className="hero-pick">
              <img src="/products/mango.jpg" alt="" />
              <div>
                <span className="muted small">In season</span>
                <strong>Alphonso mango</strong>
                <span className="brand-text small strong">₹350 / kg</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {!filtered && (
        <section id="categories" className="container section">
          <div className="section-head">
            <h2>Shop by category</h2>
            <a href="#shop" className="link-strong">
              See all products
            </a>
          </div>
          <div className="category-grid">
            {categories.map((c) => {
              const look = CATEGORY_LOOK[c.name];
              return (
                <button key={c.name} type="button" className="category-tile" onClick={() => navigate({ search: `?category=${encodeURIComponent(c.name)}`, hash: 'shop' })}>
                  {look?.image ? (
                    <img src={look.image} alt="" />
                  ) : (
                    <span className="category-icon" style={{ background: look?.tint, color: look?.ink }}>
                      <Icon name={c.name === 'Household' ? 'sparkle' : 'drop'} size={34} strokeWidth={1.8} />
                    </span>
                  )}
                  <span className="category-name">{c.name}</span>
                  <span className="muted small">{c.count} items</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section id="shop" className="container section">
        <div className="section-head wrap">
          <h2>{q ? `Results for “${q}”` : category !== 'All' ? category : 'Fresh picks for you'}</h2>
          <div className="pills" role="tablist" aria-label="Filter by category">
            {['All', ...categories.map((c) => c.name)].map((name) => (
              <button key={name} type="button" role="tab" aria-selected={category === name} className={`pill ${category === name ? 'is-on' : ''}`} onClick={() => pickCategory(name)}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {!products && !error && (
          <div className="product-grid" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="product-card skeleton" />
            ))}
          </div>
        )}
        {products && products.length === 0 && (
          <div className="empty">
            <h3>No products match “{q}”</h3>
            <p className="muted">Try a shorter word, or browse a category.</p>
            <Link to="/" className="btn btn-outline">
              Show all products
            </Link>
          </div>
        )}
        {products && products.length > 0 && (
          <div className="product-grid">
            <AnimatePresence mode="popLayout">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {!filtered && (
        <section className="container section">
          <div className="feature-grid">
            <div className="feature">
              <span className="feature-icon">
                <Icon name="card" size={24} />
              </span>
              <div>
                <h3>Pay your way</h3>
                <p>UPI, card, net banking or cash on delivery. Pick at checkout.</p>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="phone" size={24} />
              </span>
              <div>
                <h3>Shop on any device</h3>
                <p>Works the same on your phone, tablet or laptop.</p>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="shield" size={24} />
              </span>
              <div>
                <h3>What you see is in stock</h3>
                <p>Stock updates the moment an order is placed, so nothing is oversold.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {count > 0 && (
        <Link to="/cart" className="cart-bar">
          <span className="cart-bar-total">
            <span className="small">
              {count} item{count === 1 ? '' : 's'}
            </span>
            <strong>{rupees(subtotal)}</strong>
          </span>
          <span className="cart-bar-cta">
            View cart
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>
      )}
    </>
  );
}
