import mongoose from 'mongoose';

export const CATEGORIES = [
  'Fruits',
  'Vegetables',
  'Dairy and eggs',
  'Bakery',
  'Staples',
  'Snacks',
  'Beverages',
  'Personal care',
  'Household',
];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true, enum: CATEGORIES, index: true },
    price: { type: Number, required: true, min: 0 }, // whole rupees
    unit: { type: String, required: true },
    // min: 0 is a second line of defence; the conditional update in
    // services/inventory.js is what actually prevents overselling.
    stock: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },
  },
  { timestamps: true }
);

productSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Product = mongoose.model('Product', productSchema);
