const DATA = {
  Fruits: [
    ['Shimla apple', 180, '1 kg', 'apple'],
    ['Banana', 60, '1 dozen', 'banana'],
    ['Alphonso mango', 350, '1 kg', 'mango', 3],
    ['Strawberries', 120, '200 g', 'strawberry'],
    ['Nagpur orange', 120, '1 kg', 'orange'],
    ['Black grapes', 110, '500 g', 'grapes'],
    ['Watermelon', 80, '1 piece', null],
    ['Pineapple', 70, '1 piece', null],
    ['Kiwi', 90, '3 pieces', null],
  ],
  Vegetables: [
    ['Tomato', 40, '1 kg', 'tomato'],
    ['Potato', 35, '1 kg', 'potato'],
    ['Red onion', 45, '1 kg', 'onion'],
    ['Carrot', 30, '500 g', 'carrot'],
    ['Broccoli', 60, '1 piece', 'broccoli'],
    ['Cucumber', 25, '500 g', null],
    ['Brinjal', 30, '500 g', null],
    ['Green chilli', 10, '100 g', null],
    ['Garlic', 60, '250 g', null],
  ],
  'Dairy and eggs': [
    ['Farm eggs', 84, '12 pieces', 'eggs'],
    ['Cheese block', 140, '200 g', 'cheese'],
    ['Full cream milk', 68, '1 L', null],
    ['Toned milk', 28, '500 ml', null],
    ['Curd', 45, '400 g', null],
    ['Paneer', 90, '200 g', null],
    ['Butter', 58, '100 g', null],
    ['Ghee', 320, '500 ml', null],
    ['Sweet lassi', 25, '200 ml', null],
  ],
  Bakery: [
    ['Multigrain bread', 65, '400 g', 'bread'],
    ['Butter croissant', 80, '2 pieces', 'croissant'],
    ['Choco chip cookies', 60, '200 g', 'cookies'],
    ['White bread', 40, '400 g', null],
    ['Brown bread', 50, '400 g', null],
    ['Pav', 30, '6 pieces', null],
    ['Rusk', 55, '300 g', null],
    ['Muffins', 120, '4 pieces', null],
    ['Fruit cake', 110, '250 g', null],
  ],
  Staples: [
    ['Basmati rice', 140, '1 kg', 'rice'],
    ['Sona masoori rice', 350, '5 kg', null],
    ['Whole wheat atta', 270, '5 kg', null],
    ['Toor dal', 160, '1 kg', null],
    ['Moong dal', 140, '1 kg', null],
    ['Kabuli chana', 100, '1 kg', null],
    ['Sugar', 48, '1 kg', null],
    ['Iodised salt', 25, '1 kg', null],
    ['Sunflower oil', 150, '1 L', null],
  ],
  Snacks: [
    ['Salted potato chips', 30, '100 g', null],
    ['Namkeen mix', 50, '200 g', null],
    ['Roasted peanuts', 45, '200 g', null],
    ['Butter popcorn', 40, '100 g', null],
    ['Dark chocolate', 120, '100 g', null],
    ['Marie biscuits', 35, '250 g', null],
    ['Instant noodles', 56, '4 pack', null],
    ['Pretzels', 90, '150 g', null],
    ['Cashews', 220, '200 g', null],
  ],
  Beverages: [
    ['Orange juice', 110, '1 L', 'juice', 0],
    ['Coffee beans', 180, '200 g', 'coffee'],
    ['Assam tea', 140, '250 g', null],
    ['Mango drink', 40, '600 ml', null],
    ['Tender coconut water', 45, '200 ml', null],
    ['Lemon soda', 40, '750 ml', null],
    ['Mineral water', 20, '1 L', null],
    ['Green tea', 160, '25 bags', null],
    ['Cold coffee', 50, '200 ml', null],
  ],
  'Personal care': [
    ['Bath soap', 160, '4 × 100 g', null],
    ['Shampoo', 220, '340 ml', null],
    ['Toothpaste', 95, '150 g', null],
    ['Toothbrush', 60, '2 pieces', null],
    ['Hand wash', 99, '250 ml', null],
    ['Face wash', 150, '100 ml', null],
    ['Body lotion', 180, '200 ml', null],
    ['Coconut hair oil', 130, '200 ml', null],
    ['Shaving cream', 90, '70 g', null],
  ],
  Household: [
    ['Dishwash liquid', 110, '500 ml', null],
    ['Detergent powder', 130, '1 kg', null],
    ['Floor cleaner', 160, '1 L', null],
    ['Toilet cleaner', 95, '500 ml', null],
    ['Garbage bags', 99, '30 pieces', null],
    ['Paper towels', 120, '2 rolls', null],
    ['Scrub pads', 45, '3 pieces', null],
    ['Safety matches', 20, '10 boxes', null],
  ],
};

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

let i = 0;
export const PRODUCTS = Object.entries(DATA).flatMap(([category, rows]) =>
  rows.map(([name, price, unit, img, stock]) => {
    i += 1;
    return {
      name,
      slug: slugify(name),
      category,
      price,
      unit,
      stock: stock ?? 20 + ((i * 7) % 35),
      image: img ? `/products/${img}.jpg` : null,
    };
  })
);
