import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, PageSpinner } from '../components/Misc.jsx';
import { api } from '../lib/api.js';
import { rupees } from '../lib/format.js';

/**
 * Local development only (CASHFREE_MODE=mock). Stands in for the Cashfree
 * checkout page so the whole flow can be tested without Cashfree keys.
 */
export default function MockPay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/orders/${id}`)
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e.message));
  }, [id]);

  const finish = async (outcome) => {
    setBusy(true);
    try {
      await api(`/api/payments/mock/${id}/complete`, { method: 'POST', body: { outcome } });
      navigate(`/order/${id}?return=1`, { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!order && !error) return <PageSpinner />;
  return (
    <div className="mock-pay">
      <div className="mock-sheet card">
        <span className="badge badge-warn static">Test checkout · mock mode</span>
        <h1 className="page-title">Pay {order ? rupees(order.total) : ''}</h1>
        <p className="muted">
          This page stands in for Cashfree while no Cashfree keys are set. No money moves. Order #{order?.orderNumber}
        </p>
        {error && <Alert kind="error">{error}</Alert>}
        {order?.status === 'awaiting_payment' ? (
          <div className="stack">
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => finish('success')}>
              Simulate successful payment
            </button>
            <button type="button" className="btn btn-outline-neutral btn-lg btn-block" disabled={busy} onClick={() => finish('failure')}>
              Simulate declined payment
            </button>
            <button type="button" className="btn btn-link" disabled={busy} onClick={() => finish('dropped')}>
              Close without paying
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-outline btn-block" onClick={() => navigate(`/order/${id}`)}>
            View order
          </button>
        )}
      </div>
    </div>
  );
}
