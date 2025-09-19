// URL validation and domain allowlisting

// Trusted domains for video content
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'googlevideo.com',
  'ytimg.com',
  'vimeo.com',
  'vimeocdn.com'
]);

// Extract base domain (simplified eTLD+1)
function getBaseDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');
  if (parts.length >= 2) {
    // Handle common patterns like subdomain.youtube.com
    return parts.slice(-2).join('.');
  }
  return hostname;
}

// Validate and normalize URL with strict security checks
export function assertAllowedUrl(raw: string): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch (error) {
    throw new Error('Invalid URL format');
  }

  // Enforce HTTPS only (except for localhost in dev)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  // Reject URLs with authentication info
  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed');
  }

  // Reject non-standard ports (except for localhost in dev)
  if (url.port && url.hostname !== 'localhost') {
    throw new Error('Non-standard ports are not allowed');
  }

  // Check against allowlist
  const baseDomain = getBaseDomain(url.hostname);
  if (!ALLOWED_HOSTS.has(baseDomain)) {
    throw new Error(`Unsupported domain: ${baseDomain}`);
  }

  return url;
}

// Check if a URL is from a trusted CDN (for download endpoints)
export function isTrustedCDN(url: string): boolean {
  try {
    const u = new URL(url);
    const baseDomain = getBaseDomain(u.hostname);

    const CDN_DOMAINS = new Set([
      'googlevideo.com',
      'ytimg.com',
      'vimeocdn.com'
    ]);

    return CDN_DOMAINS.has(baseDomain);
  } catch {
    return false;
  }
}

// Sanitize URL for logging (remove sensitive query params)
export function sanitizeUrlForLogging(url: string): string {
  try {
    const u = new URL(url);
    // Keep only the origin and pathname for logs
    return `${u.origin}${u.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}