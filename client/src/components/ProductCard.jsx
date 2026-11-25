import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { setCheckout } from '../lib/checkout.js';
import { rupees } from '../lib/format.js';
import { Icon } from './Icon.jsx';
import { ProductImage } from './ProductImage.jsx';
import { QtyStepper } from './QtyStepper.jsx';

export function ProductCard({ product }) {
  const { qtyOf, add, setQty } = useCart();
  const navigate = useNavigate();
  const inCart = qtyOf(product.id);
  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;

  const buyNow = () => {
    setCheckout({ mode: 'buynow', items: [{ id: product.id, name: product.name, price: product.price, unit: product.unit, image: product.image, category: product.category, qty: 1 }] });
    navigate('/checkout');
  };

  return (
    <motion.article
      className="product-card"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="product-media">
        <ProductImage product={product} />
        {low && <span className="badge badge-warn">Only {product.stock} left</span>}
        {out && (
          <div className="sold-out">
            <span>Out of stock</span>
          </div>
        )}
      </div>
      <div className="product-body">
        <span className="product-cat">{product.category}</span>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price-row">
          <span className="price">{rupees(product.price)}</span>
          <span className="muted small">{product.unit}</span>
        </div>
        <div className="product-actions">
          {out ? (
            <p className="unavailable">Currently unavailable</p>
          ) : (
            <>
              {inCart > 0 ? (
                <QtyStepper value={inCart} max={product.stock} label={product.name} onChange={(v) => setQty(product.id, v)} />
              ) : (
                <button type="button" className="btn btn-outline" onClick={() => add(product)}>
                  <Icon name="plus" size={16} strokeWidth={2.4} />
                  Add
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={buyNow}>
                Buy now
              </button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
