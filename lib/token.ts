import * as jose from 'jose';
import crypto from 'crypto';

// Fail fast if JWT_SECRET is not set
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

// Create a key from the secret
const key = new TextEncoder().encode(SECRET);

export interface TokenPayload {
  url: string;
  quality: string;
  format: string;
  fp?: string; // Optional client fingerprint
}

export interface TokenContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Generate a secure download token with proper JWT claims
 */
export async function generateDownloadToken(
  url: string,
  quality: string,
  format: string,
  context?: TokenContext
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  // Generate client fingerprint if context is provided
  let fingerprint: string | undefined;
  if (context?.ip || context?.userAgent) {
    const fingerprintData = `${context.ip || ''}|${context.userAgent || ''}`;
    const hash = crypto.createHash('sha256').update(fingerprintData).digest('base64url');
    fingerprint = hash;
  }

  const jwt = await new jose.SignJWT({
    url,
    quality,
    format,
    fp: fingerprint
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('dlit')
    .setAudience('dlit-download')
    .setIssuedAt(now)
    .setExpirationTime(now + 600) // 10 minutes
    .setJti(jti)
    .sign(key);

  return jwt;
}

/**
 * Verify a download token with strict validation
 */
export async function verifyDownloadToken(
  token: string,
  context?: TokenContext
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, key, {
      issuer: 'dlit',
      audience: 'dlit-download'
    });

    // Verify client fingerprint if context is provided
    if (context?.ip || context?.userAgent) {
      const fingerprintData = `${context.ip || ''}|${context.userAgent || ''}`;
      const expectedFingerprint = crypto
        .createHash('sha256')
        .update(fingerprintData)
        .digest('base64url');

      if (payload.fp && payload.fp !== expectedFingerprint) {
        console.warn('Token fingerprint mismatch - possible token sharing');
        // You can decide whether to reject or just log this
        // For now, we'll allow it but log the warning
      }
    }

    return {
      url: payload.url as string,
      quality: payload.quality as string,
      format: payload.format as string,
      fp: payload.fp as string | undefined
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      console.log('Token expired');
    } else if (error instanceof jose.errors.JWTInvalid) {
      console.log('Invalid token');
    } else {
      console.log('Token verification failed:', error.message);
    }
    return null;
  }
}