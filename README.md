# FreshMart

An online grocery store: 80 products in 9 categories, accounts, cart, Buy now, checkout, and payments through Cashfree (UPI, card, net banking) or cash on delivery. MERN stack: MongoDB, Express, React (Vite), Node.js.

```
freshmart/
  server/   Express API, MongoDB models, Cashfree integration, tests
  client/   React website (Vite)
```

## Run it locally

Needs Node.js 20 or later.

```powershell
cd server
npm install
copy .env.example .env
npm run dev
```

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173.

With `MONGO_URI` empty, the API starts an in-memory MongoDB replica set and fills it with the 80 products, so nothing else needs installing. Data resets when the API restarts. With `CASHFREE_MODE=mock`, "Pay" opens a local test checkout where you can simulate a successful or declined payment.

### One server instead of two

On a low-memory machine, or to host everything on one server, build the website once and let the API serve it:

```powershell
cd client
npm install
npm run build
cd ..\server
$env:SERVE_CLIENT='1'; npm start
```

Then open http://localhost:5000.

### Tests

Run the tests (14 tests covering stock, transactions and payments):

```powershell
cd server
npm test
```

## How orders stay correct (ACID)

Every change to stock and orders runs inside a MongoDB transaction, so it happens completely or not at all.

1. **Reserve**: one transaction reduces stock for every item (only if enough is left) and saves the order. If any item is short, nothing changes. Cash on delivery orders are confirmed here.
2. **Create Cashfree order**: our order number is Cashfree's order id, for the total the server calculated from database prices.
3. **Customer pays** on Cashfree's checkout. Card and UPI details never reach our server.
4. **Confirm**: the signed webhook (or a status check when the customer returns) marks the order paid, in one transaction. Repeats change nothing.
5. **Release**: if the payment fails, is cancelled, or the 15-minute hold runs out, one transaction marks the order failed and returns the stock.

If a payment arrives after the hold ended, the server takes the stock again, or refunds the payment automatically if it has sold out.

## Going live

| Piece | Where | Settings |
|---|---|---|
| Database | MongoDB Atlas (free M0) | Create a cluster and a database user. Copy the connection string into `MONGO_URI`. |
| API | Render (Web Service, root `server`) | Build `npm install`, start `npm start`. Set `NODE_ENV=production` and every variable in `server/.env.example`. |
| Website | Vercel (root `client`) | Set `VITE_API_URL` to the Render address. |
| Payments | Cashfree dashboard | Use the sandbox keys first (`CASHFREE_MODE=sandbox`). Add the webhook URL `https://<your-api>/api/payments/cashfree/webhook`. Live keys need Cashfree KYC. |

In production the login cookie is `SameSite=None; Secure`, because the website and API are on different domains. Both must use https.

## Not built yet

- Delivery fee and minimum order: waiting for the SRS (`DELIVERY_FEE` is ready for it).
- Photos for 61 of the 80 products: they show a tidy coloured tile until a photo is added to `client/public/products/` and its `image` set in `server/src/seed/products.js`.
- Admin panel, order history, notifications: out of scope in the PID. Until then, shop staff can see orders in MongoDB Atlas.
