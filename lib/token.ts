import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface TokenPayload {
  url: string;
  quality: string;
  format: string;
  exp: number;
}

export function generateDownloadToken(url: string, quality: string, format: string): string {
  const payload: TokenPayload = {
    url,
    quality,
    format,
    exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes
  };

  return jwt.sign(payload, SECRET);
}

export function verifyDownloadToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as TokenPayload;

    // Check if token has expired
    if (decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}