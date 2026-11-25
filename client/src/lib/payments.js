import { api } from './api.js';

let configPromise = null;
export function getGatewayConfig() {
  configPromise ||= api('/api/payments/config').catch((err) => {
    configPromise = null;
    throw err;
  });
  return configPromise;
}

/** Opens Cashfree checkout (or the local mock checkout) for an order awaiting payment. */
export async function openGateway(order, navigate) {
  const { mode } = await getGatewayConfig();
  if (mode === 'mock') {
    navigate(`/pay/${order.id}`);
    return;
  }
  const { load } = await import('@cashfreepayments/cashfree-js');
  const cashfree = await load({ mode: mode === 'production' ? 'production' : 'sandbox' });
  // Leaves our site; Cashfree sends the customer back to /order/:id?return=1.
  await cashfree.checkout({ paymentSessionId: order.payment.paymentSessionId, redirectTarget: '_self' });
}
