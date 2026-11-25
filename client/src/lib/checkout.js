// Checkout progress lives in sessionStorage: it survives the redirect to
// Cashfree and back, and the Back button, but not closing the tab.

function read(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: checkout still works within this page view */
  }
}

/** { mode: 'cart' | 'buynow', items: [{ id, name, price, unit, image, category, qty }] } */
export const getCheckout = () => read('fm_checkout', null);
export const setCheckout = (value) => write('fm_checkout', value);

/** The saved address, only if it belongs to this user. */
export function getAddress(userId) {
  const saved = read('fm_address', null);
  if (!saved || saved.userId !== userId) return null;
  const { userId: _ignored, ...address } = saved;
  return address;
}
export const setAddress = (value, userId) => write('fm_address', value ? { ...value, userId } : null);

/** Forget everything about the checkout in progress (on logout or account switch). */
export function clearCheckoutSession() {
  ['fm_checkout', 'fm_address', 'fm_idem', 'fm_order_source'].forEach((k) => write(k, null));
}

/** One key per checkout attempt, so a double click or a retry can't create two orders. */
export function getIdempotencyKey() {
  let key = read('fm_idem', null);
  if (!key) {
    key = crypto.randomUUID();
    write('fm_idem', key);
  }
  return key;
}
export const clearIdempotencyKey = () => write('fm_idem', null);

/** Remembers whether an order came from the cart, so we only empty the cart for those. */
export function rememberOrderSource(orderId, mode) {
  const map = read('fm_order_source', {});
  map[orderId] = mode;
  write('fm_order_source', map);
}
export function takeOrderSource(orderId) {
  const map = read('fm_order_source', {});
  const mode = map[orderId];
  delete map[orderId];
  write('fm_order_source', map);
  return mode;
}
