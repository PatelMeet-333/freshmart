import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PageBar, Steps } from '../components/Misc.jsx';
import { ProductImage } from '../components/ProductImage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAddress, getCheckout, setAddress } from '../lib/checkout.js';
import { rupees } from '../lib/format.js';

const digits = (v) => v.replace(/[\s-]/g, '');
const RULES = {
  fullName: (v) => (v.trim().length >= 2 ? null : 'Enter the full name'),
  phone: (v) => (/^[6-9]\d{9}$/.test(digits(v)) ? null : 'Enter a 10-digit mobile number'),
  line1: (v) => (v.trim().length >= 3 ? null : 'Enter the house, flat and street'),
  line2: () => null,
  city: (v) => (v.trim().length >= 2 ? null : 'Enter the city'),
  pincode: (v) => (/^\d{6}$/.test(digits(v)) ? null : 'Enter a 6-digit pincode'),
};

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const checkout = getCheckout();
  const [form, setForm] = useState(() => getAddress(user?.id) || { fullName: user?.name || '', phone: '', line1: '', line2: '', city: '', pincode: '' });
  const [errors, setErrors] = useState({});

  if (!checkout?.items?.length) return <Navigate to="/cart" replace />;
  const total = checkout.items.reduce((s, i) => s + i.price * i.qty, 0);
  const backTo = checkout.mode === 'cart' ? '/cart' : '/';

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = Object.fromEntries(Object.entries(RULES).map(([k, rule]) => [k, rule(form[k] || '')]));
    setErrors(next);
    const firstBad = Object.keys(next).find((k) => next[k]);
    if (firstBad) {
      document.getElementById(`f-${firstBad}`)?.focus();
      return;
    }
    setAddress({ ...form, phone: digits(form.phone), pincode: digits(form.pincode) }, user?.id);
    navigate('/payment');
  };

  const field = (k, label, props = {}) => (
    <label className="field">
      <span>
        {label}
        {k === 'line2' && <span className="muted small"> (optional)</span>}
      </span>
      <input id={`f-${k}`} value={form[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} aria-describedby={errors[k] ? `e-${k}` : undefined} {...props} />
      {errors[k] && (
        <span id={`e-${k}`} className="field-error">
          {errors[k]}
        </span>
      )}
    </label>
  );

  return (
    <div className="narrow">
      <PageBar back={backTo} backLabel="Back" title="Delivery address" />
      <Steps current={1} />
      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="card stack form-card">
          {field('fullName', 'Full name', { autoComplete: 'name' })}
          <label className="field">
            Mobile number
            <span className={`input-prefix ${errors.phone ? 'is-invalid' : ''}`}>
              <span>+91</span>
              <input
                id="f-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={form.phone}
                onChange={set('phone')}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'e-phone' : undefined}
              />
            </span>
            {errors.phone && (
              <span id="e-phone" className="field-error">
                {errors.phone}
              </span>
            )}
          </label>
          {field('line1', 'House, flat and street', { autoComplete: 'address-line1' })}
          {field('line2', 'Area or landmark', { autoComplete: 'address-line2', placeholder: 'Near City Mall' })}
          <div className="two-col">
            {field('city', 'City', { autoComplete: 'address-level2' })}
            {field('pincode', 'Pincode', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 7 })}
          </div>
        </div>
        <aside className="card bill">
          <h2 className="card-title">Order summary</h2>
          <div className="thumbs">
            {checkout.items.slice(0, 4).map((i) => (
              <ProductImage key={i.id} product={i} className="thumb" />
            ))}
            <span className="muted">
              {checkout.items.reduce((s, i) => s + i.qty, 0)} item{checkout.items.length === 1 && checkout.items[0].qty === 1 ? '' : 's'}
            </span>
          </div>
          <div className="bill-row bill-total">
            <span>Item total</span>
            <span>{rupees(total)}</span>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block">
            Continue to payment
          </button>
        </aside>
      </form>
    </div>
  );
}
