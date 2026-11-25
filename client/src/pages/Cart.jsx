import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { PageBar } from '../components/Misc.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { QtyStepper } from '../components/QtyStepper.jsx';
import { useCart } from '../context/CartContext.jsx';
import { setCheckout } from '../lib/checkout.js';
import { rupees } from '../lib/format.js';
import { useStoreConfig } from '../lib/useStoreConfig.js';

export default function Cart() {
  const { items, count, subtotal, setQty, remove } = useCart();
  const navigate = useNavigate();
  const config = useStoreConfig();
  const fee = config ? config.deliveryFee : null;

  const checkout = () => {
    setCheckout({ mode: 'cart', items: items.map(({ id, name, price, unit, image, category, qty }) => ({ id, name, price, unit, image, category, qty })) });
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="narrow">
        <PageBar back="/" backLabel="Back to shop" title="Your cart" />
        <div className="empty">
          <span className="empty-icon">
            <Icon name="cart" size={30} />
          </span>
          <h2>Your cart is empty</h2>
          <p className="muted">Add fruits, vegetables and daily essentials to get started.</p>
          <Link to="/" className="btn btn-primary btn-lg">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      <PageBar back="/" backLabel="Back to shop" title="Your cart" subtitle={`${count} item${count === 1 ? '' : 's'}`} />
      <div className="checkout-layout">
        <div className="stack">
          <ul className="card line-list">
            {items.map((it) => (
              <li key={it.id} className="line">
                <ProductImage product={it} className="line-img" />
                <div className="line-main">
                  <div className="line-top">
                    <div>
                      <span className="strong">{it.name}</span>
                      <span className="muted small block">
                        {it.unit} · {rupees(it.price)} each
                      </span>
                    </div>
                    <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${it.name}`} onClick={() => remove(it.id)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                  <div className="line-bottom">
                    <QtyStepper size="sm" value={it.qty} max={it.stock} label={it.name} onChange={(v) => setQty(it.id, v)} />
                    <span className="price-sm">{rupees(it.price * it.qty)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/" className="btn btn-dashed">
            <Icon name="plus" size={16} strokeWidth={2.4} />
            Add more items
          </Link>
        </div>
        <aside className="card bill">
          <h2 className="card-title">Bill details</h2>
          <div className="bill-row">
            <span>Item total</span>
            <span>{rupees(subtotal)}</span>
          </div>
          <div className="bill-row">
            <span>Delivery fee</span>
            <span>{fee === null ? '…' : fee > 0 ? rupees(fee) : 'Free'}</span>
          </div>
          <div className="bill-row bill-total">
            <span>Total</span>
            <span>{rupees(subtotal + (fee || 0))}</span>
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={checkout}>
            Checkout · {rupees(subtotal + (fee || 0))}
            <Icon name="arrowRight" size={18} />
          </button>
          <p className="center muted small">You’ll log in before choosing how to pay.</p>
        </aside>
      </div>
    </div>
  );
}
