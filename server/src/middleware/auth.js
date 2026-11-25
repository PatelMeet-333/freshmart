import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const AUTH_COOKIE = 'fm_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// The website (Vercel) and API (Render) are on different domains in
// production, so the cookie must be SameSite=None and Secure there.
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  };
}

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

export function requireAuth(req, _res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next(new HttpError(401, 'Log in to continue.', 'UNAUTHENTICATED'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub };
    return next();
  } catch {
    return next(new HttpError(401, 'Your session has ended. Log in again.', 'UNAUTHENTICATED'));
  }
}
