# Quick Code Audit Summary

## TL;DR Version for ChatGPT

**Project**: Next.js TypeScript YouTube video downloader facing production bot detection

**Core Issue**: Videos work locally, fail in production due to YouTube's content-based bot detection targeting datacenter IPs

**Key Implementation**: Multi-strategy extraction with Android client → minimal → cookie auth fallbacks

## Critical Code Areas to Review

### 1. Main Extraction Logic (`lib/ytdlp.ts`)
```typescript
// Strategy 1: Try Android client first (often bypasses bot detection)
const result = await execAsync(
  `"${ytdlpPath}" -j --no-warnings --extractor-args "youtube:player_client=android" "${videoUrl}"`
);

// Strategy 2: Fallback chain with cookie authentication
const cookieFile = await ensureCookieFile();
if (cookieFile) {
  const result = await execAsync(
    `"${ytdlpPath}" -j --no-warnings --cookies "${cookieFile}" "${videoUrl}"`
  );
}
```

### 2. Security Concerns
- JWT token generation for downloads
- IP-based rate limiting implementation
- Cookie file management in production
- Error message information leakage

### 3. Production Issues
- Content-based blocking (sports/news blocked, music works)
- Environment-specific behavior differences
- Resource management with spawned processes

## Audit Focus
1. **Security**: Token safety, input validation, rate limit bypass
2. **Architecture**: Nested try-catch complexity, type safety
3. **Performance**: Caching strategy, concurrent request handling
4. **Sustainability**: Bot detection arms race viability

## Files to Review
- `lib/ytdlp.ts` (extraction logic)
- `pages/api/extract.ts` (main endpoint)
- `lib/token.ts` (security)
- `lib/rateLimit.ts` (abuse prevention)

## Key Questions
1. Is the multi-strategy approach maintainable?
2. Are there security vulnerabilities?
3. How to improve bot detection resilience?
4. Performance/scalability bottlenecks?