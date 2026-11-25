import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';

const phone = import.meta.env.VITE_SHOP_PHONE;
const address = import.meta.env.VITE_SHOP_ADDRESS;

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div className="footer-brand">
          <span className="footer-logo">
            <Icon name="leaf" size={22} />
            FreshMart
          </span>
          <p>Everyday groceries from your neighbourhood shop, ordered online.</p>
        </div>
        <div className="footer-col">
          <span className="footer-head">Shop</span>
          <Link to="/?category=Fruits#shop">Fruits</Link>
          <Link to="/?category=Vegetables#shop">Vegetables</Link>
          <Link to="/?category=Staples#shop">Staples</Link>
        </div>
        {(phone || address) && (
          <div className="footer-col">
            <span className="footer-head">Contact</span>
            {phone && <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>}
            {address && <span>{address}</span>}
          </div>
        )}
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} FreshMart</span>
        <span>Payments are processed securely by Cashfree Payments. FreshMart never stores card or UPI details.</span>
      </div>
    </footer>
  );
}
