import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Middleware to protect debug endpoints in production
 * Debug endpoints should either be disabled or protected with authentication
 */
export function protectDebugEndpoint(
  req: NextApiRequest,
  res: NextApiResponse
): boolean {
  // In production, require admin token authentication
  if (process.env.NODE_ENV === 'production') {
    const adminToken = process.env.ADMIN_TOKEN;

    // If no admin token is configured, disable debug endpoints entirely
    if (!adminToken) {
      res.status(404).end();
      return false;
    }

    // Check for admin token in headers
    const providedToken = req.headers['x-admin-token'] as string;

    if (!providedToken || providedToken !== adminToken) {
      res.status(404).end(); // Return 404 to hide endpoint existence
      return false;
    }
  }

  return true;
}

/**
 * Sanitize debug output to remove sensitive information
 */
export function sanitizeDebugOutput(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitive = [
    'JWT_SECRET',
    'ADMIN_TOKEN',
    'DATABASE_URL',
    'API_KEY',
    'SECRET',
    'PASSWORD',
    'TOKEN',
    'PRIVATE_KEY',
    'AWS_SECRET',
    'RENDER_API_KEY'
  ];

  const sanitized = { ...data };

  for (const key in sanitized) {
    // Check if key contains sensitive patterns
    const upperKey = key.toUpperCase();
    if (sensitive.some(pattern => upperKey.includes(pattern))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeDebugOutput(sanitized[key]);
    }
  }

  return sanitized;
}