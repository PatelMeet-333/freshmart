import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

export function requireJsonForWrites(req, _res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return next(new HttpError(415, 'Requests must be sent as JSON.', 'UNSUPPORTED_MEDIA_TYPE'));
  }
  return next();
}

export function notFound(_req, res) {
  res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
}
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ message: issue.message, code: 'VALIDATION', field: issue.path.join('.') });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ message: 'That id is not valid.', code: 'BAD_ID' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request body is not valid JSON.', code: 'BAD_JSON' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Something went wrong on our side. Try again.', code: 'SERVER_ERROR' });
}
