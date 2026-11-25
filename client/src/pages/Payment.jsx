import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Alert, PageBar, Steps } from '../components/Misc.jsx';
import { clearIdempotencyKey, getAddress, getCheckout, getIdempotencyKey, rememberOrderSource } from '../lib/checkout.js';
import { rupees } from '../lib/format.js';
import { api } from '../lib/api.js';
import { openGateway } from '../lib/payments.js';
import { useStoreConfig } from '../lib/useStoreConfig.js';
import { useAuth } from '../context/AuthContext.jsx';

const METHODS = [
  { id: 'upi', label: 'UPI', hint: 'Pay from any UPI app', icon: 'phone' },
  { id: 'card', label: 'Debit or credit card', hint: 'Visa, Mastercard, RuPay', icon: 'card' },
  { id: 'netbanking', label: 'Net banking', hint: 'All major Indian banks', icon: 'bank' },
  { id: 'cod', label: 'Cash on delivery', hint: 'Pay when your order arrives', icon: 'cash' },
];

export default function Payment() {
  const navigate = useNavigate();
  const checkout = getCheckout();
  const { user } = useAuth();
  const address = getAddress(user?.id);
  const [method, setMethod] = useState('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const config = useStoreConfig();

  if (!checkout?.items?.length) return <Navigate to="/cart" replace />;
  if (!address) return <Navigate to="/checkout" replace />;

  const count = checkout.items.reduce((s, i) => s + i.qty, 0);
  const subtotal = checkout.items.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = config?.deliveryFee || 0;
  const total = subtotal + fee;
  const holdMinutes = config?.holdMinutes || 15;

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: {
          items: checkout.items.map((i) => ({ productId: i.id, qty: i.qty })),
          address,
          paymentMethod: method,
          idempotencyKey: getIdempotencyKey(),
        },
      });
      clearIdempotencyKey();
      rememberOrderSource(order.id, checkout.mode);
      if (order.status === 'awaiting_payment') await openGateway(order, navigate);
      else navigate(`/order/${order.id}`, { replace: true });
    } catch (err) {
      // A clear "no" from the server means the next try is a new attempt.
      // Network errors keep the key, so a retry can't create a second order.
      if (err.status >= 400 && err.status < 500) clearIdempotencyKey();
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <PageBar back="/checkout" backLabel="Back to address" title="Payment" />
      <Steps current={2} />
      <div className="checkout-layout">
        <div className="stack">
          <Alert kind="success">
            {method === 'cod'
              ? 'You pay in cash when your order arrives. Your items are set aside as soon as you place the order.'
              : `Your items are held for ${holdMinutes} minutes while you pay. Card and UPI details go straight to Cashfree, never to FreshMart.`}
          </Alert>
          {error && (
            <Alert kind="error">
              {error.message}{' '}
              {error.code === 'OUT_OF_STOCK' && (
                <Link to={checkout.mode === 'cart' ? '/cart' : '/'} className="link-strong">
                  {checkout.mode === 'cart' ? 'Update your cart' : 'Back to shop'}
                </Link>
              )}
            </Alert>
          )}
          <fieldset className="methods">
            <legend className="card-title">Choose how to pay</legend>
            {METHODS.map((m) => (
              <label key={m.id} className={`method ${method === m.id ? 'is-on' : ''}`}>
                <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />
                <span className="method-icon">
                  <Icon name={m.icon} size={22} />
                </span>
                <span className="method-text">
                  <span className="strong">{m.label}</span>
                  <span className="muted small">{m.hint}</span>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </label>
            ))}
          </fieldset>
        </div>
        <aside className="card bill">
          <h2 className="card-title">Summary</h2>
          <div className="bill-row">
            <span>Item total ({count})</span>
            <span>{rupees(subtotal)}</span>
          </div>
          <div className="bill-row">
            <span>Delivery fee</span>
            <span>{fee > 0 ? rupees(fee) : 'Free'}</span>
          </div>
          <div className="bill-row">
            <span>Delivering to</span>
            <span className="right">
              {address.fullName}, {address.pincode}
            </span>
          </div>
          <div className="bill-row bill-total">
            <span>To pay</span>
            <span>{rupees(total)}</span>
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={pay} disabled={busy}>
            {busy ? (
              <span className="spinner spinner-sm spinner-light" />
            ) : (
              <>
                <Icon name="lock" size={18} />
                {method === 'cod' ? `Place order · ${rupees(total)}` : `Pay ${rupees(total)} securely`}
              </>
            )}
          </button>
        </aside>
      </div>
    </div>
  );
}
