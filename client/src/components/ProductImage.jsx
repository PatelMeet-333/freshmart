import { useState } from 'react';
import { CATEGORY_LOOK } from '../lib/format.js';
import { Icon } from './Icon.jsx';

/** Product photo, or a tidy tinted tile with the product's initials when there is none. */
export function ProductImage({ product, className = '' }) {
  const [broken, setBroken] = useState(false);
  const look = CATEGORY_LOOK[product.category] || { tint: '#F1F3EE', ink: '#4A5650' };

  if (product.image && !broken) {
    return <img className={`product-img ${className}`} src={product.image} alt={product.name} loading="lazy" onError={() => setBroken(true)} />;
  }
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`product-img product-tile ${className}`} style={{ background: look.tint, color: look.ink }} role="img" aria-label={product.name}>
      <span className="tile-initials">{initials}</span>
      {product.category === 'Personal care' && <Icon name="drop" size={18} className="tile-icon" />}
      {product.category === 'Household' && <Icon name="sparkle" size={18} className="tile-icon" />}
    </div>
  );
}
