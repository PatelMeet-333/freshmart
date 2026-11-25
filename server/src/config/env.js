import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const port = Number(process.env.PORT || 5000);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const cashfreeMode = (process.env.CASHFREE_MODE || 'mock').toLowerCase();
if (!['mock', 'sandbox', 'production'].includes(cashfreeMode)) {
  throw new Error('CASHFREE_MODE must be one of: mock, sandbox, production');
}

export const env = {
  nodeEnv: NODE_ENV,
  isProd,
  isTest: NODE_ENV === 'test',
  port,
  // Empty in development = start an in-memory MongoDB replica set automatically.
  mongoUri: isProd ? required('MONGO_URI') : process.env.MONGO_URI || '',
  jwtSecret: isProd ? required('JWT_SECRET') : process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  apiUrl: (process.env.API_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  // Not defined in the PID; set it once the SRS confirms the rule.
  deliveryFee: Number(process.env.DELIVERY_FEE || 0),
  holdMinutes: Number(process.env.PAYMENT_HOLD_MINUTES || 15),
  cashfree: {
    mode: cashfreeMode,
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    apiVersion: '2023-08-01',
  },
};

if (isProd && env.cashfree.mode === 'mock') {
  throw new Error('CASHFREE_MODE=mock is not allowed in production. Use sandbox or production.');
}
if (env.cashfree.mode !== 'mock' && (!env.cashfree.appId || !env.cashfree.secretKey)) {
  throw new Error('CASHFREE_APP_ID and CASHFREE_SECRET_KEY are required when CASHFREE_MODE is sandbox or production.');
}
if (isProd && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
