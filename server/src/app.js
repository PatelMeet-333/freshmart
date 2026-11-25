import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFound, requireJsonForWrites } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes, { cashfreeWebhook } from './routes/payments.js';
import productRoutes from './routes/products.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy; needed for rate limiting by IP.
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Cashfree's checkout script, plus Google Fonts for the website.
          scriptSrc: ["'self'", 'https://sdk.cashfree.com'],
          connectSrc: ["'self'", 'https://sdk.cashfree.com', 'https://api.cashfree.com', 'https://sandbox.cashfree.com'],
          frameSrc: ["'self'", 'https://sdk.cashfree.com', 'https://api.cashfree.com', 'https://sandbox.cashfree.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:'],
        },
      },
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.clientUrls.includes(origin)),
      credentials: true,
    })
  );

  // Raw body for signature checks, so this must come before express.json().
  app.post('/api/payments/cashfree/webhook', express.raw({ type: '*/*', limit: '1mb' }), cashfreeWebhook);

  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use(requireJsonForWrites);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);

  // Optional: serve the built website from this server (SERVE_CLIENT=1),
  // e.g. on low-memory machines or a single-server deployment.
  if (process.env.SERVE_CLIENT === '1') {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) {
      app.use(express.static(dist, { maxAge: '1h', index: false }));
      app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
        return res.sendFile(path.join(dist, 'index.html'));
      });
    } else {
      console.warn('[api] SERVE_CLIENT=1 but client/dist is missing. Run "npm run build" in client first.');
    }
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
