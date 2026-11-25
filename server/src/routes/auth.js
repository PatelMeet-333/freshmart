import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { clearAuthCookie, requireAuth, setAuthCookie } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// Slows down password guessing (PID risk: "Login guessing attacks").
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Wait 15 minutes and try again.', code: 'RATE_LIMITED' },
});

const email = z.email('Enter a valid email address').trim().toLowerCase();
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(60, 'Name is too long'),
  email,
  // bcrypt only uses the first 72 bytes.
  password: z.string().min(8, 'Use at least 8 characters for your password').max(72, 'Password is too long'),
});
const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(72) });

router.post('/register', authLimiter, async (req, res) => {
  const { name, email: addr, password } = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await User.create({ name, email: addr, passwordHash });
  } catch (err) {
    if (err?.code === 11000) throw new HttpError(409, 'An account with that email already exists. Log in instead.', 'EMAIL_TAKEN');
    throw err;
  }
  setAuthCookie(res, user.id);
  res.status(201).json({ user });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email: addr, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: addr });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'That email and password don’t match.', 'BAD_CREDENTIALS');
  setAuthCookie(res, user.id);
  res.json({ user });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Log in to continue.', 'UNAUTHENTICATED');
  res.json({ user });
});

export default router;
