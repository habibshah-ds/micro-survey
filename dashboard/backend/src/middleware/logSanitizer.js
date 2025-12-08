// ============================================
// Log Sanitizer Middleware
// Prevents sensitive data from appearing in logs
// ============================================

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
];

export function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

export function logSanitizerMiddleware(req, res, next) {
  const originalSend = res.send;
  res.send = function(data) {
    // Don't log response bodies in production
    return originalSend.call(this, data);
  };
  next();
}
