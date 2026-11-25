const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const rupees = (n) => `₹${inr.format(n)}`;

export const CATEGORY_LOOK = {
  Fruits: { image: '/products/strawberry.jpg', tint: '#FDECEA', ink: '#9B1C13' },
  Vegetables: { image: '/products/carrot.jpg', tint: '#E6F2EA', ink: '#155C34' },
  'Dairy and eggs': { image: '/products/eggs.jpg', tint: '#F3F0E6', ink: '#5E4B1C' },
  Bakery: { image: '/products/bread.jpg', tint: '#FBF0E4', ink: '#7A4300' },
  Staples: { image: '/products/rice.jpg', tint: '#F4F1E8', ink: '#5B4A22' },
  Snacks: { image: '/products/cookies.jpg', tint: '#FDEFD6', ink: '#7A4B00' },
  Beverages: { image: '/products/juice.jpg', tint: '#FFF1DE', ink: '#8A4500' },
  'Personal care': { image: null, tint: '#E9EEF8', ink: '#2F4E8C' },
  Household: { image: null, tint: '#F1ECF7', ink: '#5B3A8C' },
};

export const PAYMENT_LABELS = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  cod: 'Cash on delivery',
};
