import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Alert, PageSpinner } from '../components/Misc.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../lib/api.js';
import { setCheckout, takeOrderSource } from '../lib/checkout.js';
import { PAYMENT_LABELS, rupees } from '../lib/format.js';
import { openGateway } from '../lib/payments.js';

function useCountdown(order) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!order?.holdExpiresAt) return setLeft(null);
    // Use the server's clock, not the phone's, which may be wrong.
    const offset = new Date(order.serverNow).getTime() - Date.now();
    const end = new Date(order.holdExpiresAt).getTime();
    const tick = () => setLeft(Math.max(0, end - (Date.now() + offset)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order?.holdExpiresAt, order?.serverNow]);
  return left;
}

const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function OrderStatus() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clear } = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const polls = useRef(0);
  const returned = params.get('return') === '1';
  const left = useCountdown(order?.status === 'awaiting_payment' ? order : null);

  const load = useCallback(
    async (verify) => {
      try {
        const { order: o } = verify ? await api(`/api/orders/${id}/verify-payment`, { method: 'POST' }) : await api(`/api/orders/${id}`);
        setOrder(o);
        setError(null);
        return o;
      } catch (err) {
        setError(err.message);
        return null;
      }
    },
    [id]
  );

  useEffect(() => {
    load(returned);
  }, [load, returned]);

  // Back from Cashfree but not confirmed yet: keep checking for ~30 seconds.
  useEffect(() => {
    if (!order || order.status !== 'awaiting_payment' || order.payment.lastAttempt || !returned || polls.current >= 10) return undefined;
    const t = setTimeout(() => {
      polls.current += 1;
      load(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [order, returned, load]);

  // Done: empty the cart if this order came from it.
  useEffect(() => {
    if (order && ['paid', 'confirmed'].includes(order.status)) {
      if (takeOrderSource(order.id) === 'cart') clear();
      setCheckout(null);
    }
  }, [order, clear]);

  const act = async (kind) => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'retry') {
        await openGateway(order, navigate);
        return;
      }
      const path = kind === 'cod' ? 'switch-to-cod' : 'cancel';
      const { order: o } = await api(`/api/orders/${id}/${path}`, { method: 'POST' });
      setOrder(o);
      if (kind === 'cancel') navigate('/cart');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (!order && !error) return <PageSpinner label="Checking your order" />;
  if (!order) {
    return (
      <div className="narrow status-page">
        <Alert kind="error">{error}</Alert>
        <Link to="/" className="btn btn-outline">
          Back to shop
        </Link>
      </div>
    );
  }

  const done = order.status === 'paid' || order.status === 'confirmed';
  const awaiting = order.status === 'awaiting_payment';
  const attemptFailed = awaiting && (order.payment.lastAttempt || (returned && polls.current >= 10));
  const checking = awaiting && !attemptFailed;

  return (
    <div className="narrow status-page">
      {done && (
        <StatusHead kind="ok" title="Order placed">
          {order.status === 'paid' ? 'Payment received. ' : ''}The shop has your order and will contact you about delivery.
        </StatusHead>
      )}
      {checking && (
        <StatusHead kind="wait" title={returned ? 'Confirming your payment' : 'Waiting for payment'}>
          {returned ? 'This usually takes a few seconds. Don’t close this page.' : 'Finish paying to place your order.'}
        </StatusHead>
      )}
      {attemptFailed && (
        <StatusHead kind="bad" title="Payment didn’t go through">
          This order wasn’t charged. Your items are still held for you.
        </StatusHead>
      )}
      {order.status === 'failed' && (
        <StatusHead kind="bad" title="Order cancelled">
          {order.payment.lastAttempt ? 'The payment didn’t complete' : 'The payment time ran out'}, so your items went back on the shelf. Nothing was charged.
        </StatusHead>
      )}
      {(order.status === 'refunded' || order.status === 'refund_pending') && (
        <StatusHead kind="bad" title="Payment refunded">
          Your payment arrived after the items sold out, so we’ve refunded {rupees(order.total)} to your original payment method.
        </StatusHead>
      )}

      <span className="order-number">Order #{order.orderNumber}</span>
      {error && <Alert kind="error">{error}</Alert>}

      {awaiting && left !== null && (
        <div className="card hold">
          <span className="hold-icon">
            <Icon name="clock" size={20} />
          </span>
          <div>
            <span className="strong block">{left > 0 ? `Items held for ${mmss(left)} more` : 'Hold ending now'}</span>
            <span className="muted small">After that they go back on the shelf.</span>
          </div>
        </div>
      )}

      <ul className="card line-list">
        {order.items.map((l) => (
          <li key={l.productId} className="line line-compact">
            <ProductImage product={{ name: l.name, image: l.image }} className="line-img-sm" />
            <span className="grow">
              {l.name} × {l.qty}
            </span>
            <span className="strong">{rupees(l.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <div className="card bill">
        {order.deliveryFee > 0 && (
          <div className="bill-row">
            <span>Delivery fee</span>
            <span>{rupees(order.deliveryFee)}</span>
          </div>
        )}
        <div className="bill-row bill-total">
          <span>{order.status === 'paid' ? 'Paid' : 'Total'}</span>
          <span>{rupees(order.total)}</span>
        </div>
        <div className="bill-row">
          <span>Payment</span>
          <span className="right">
            {done && <span className="dot-ok" aria-hidden="true" />}
            {PAYMENT_LABELS[order.paymentMethod]}
            {order.status === 'paid' ? ' · confirmed' : ''}
          </span>
        </div>
        <div className="bill-row">
          <span>Deliver to</span>
          <span className="right">
            {order.address.line1}, {order.address.city} {order.address.pincode}
          </span>
        </div>
      </div>

      <div className="status-actions">
        {attemptFailed && left > 0 && (
          <>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => act('retry')} disabled={Boolean(busy)}>
              {busy === 'retry' ? <span className="spinner spinner-sm spinner-light" /> : 'Try again'}
            </button>
            <button type="button" className="btn btn-outline-neutral btn-lg btn-block" onClick={() => act('cod')} disabled={Boolean(busy)}>
              {busy === 'cod' ? <span className="spinner spinner-sm" /> : 'Pay cash on delivery instead'}
            </button>
            <button type="button" className="btn btn-link" onClick={() => act('cancel')} disabled={Boolean(busy)}>
              Cancel and go back to cart
            </button>
          </>
        )}
        {checking && !returned && (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => act('retry')} disabled={Boolean(busy)}>
            Pay {rupees(order.total)}
          </button>
        )}
        {(done || order.status === 'failed' || order.status.startsWith('refund')) && (
          <Link to="/" className="btn btn-primary btn-lg btn-block">
            Continue shopping
          </Link>
        )}
      </div>
    </div>
  );
}

function StatusHead({ kind, title, children }) {
  return (
    <div className="status-head">
      <span className={`status-badge status-${kind}`}>
        <span>{kind === 'wait' ? <span className="spinner spinner-light" /> : <Icon name={kind === 'ok' ? 'check' : 'x'} size={32} strokeWidth={2.6} />}</span>
      </span>
      <h1 className="status-title">{title}</h1>
      <p className="muted center">{children}</p>
    </div>
  );
}
