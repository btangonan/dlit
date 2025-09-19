# ⚡ Lightning Fast Video Downloader

A free, self-hosted video downloader that replicates the speed and simplicity of yt1s.biz. Built to run on Render's free tier with zero storage requirements.

## 🚀 Features

- **Lightning Fast**: Instant UI with 2-3 second processing
- **No Storage**: Streams/redirects videos directly, no server storage needed
- **Free Forever**: Runs on Render free tier (or any Node.js host)
- **Privacy First**: No tracking, no ads, no data collection
- **Smart Bandwidth**: Redirects when possible, proxies when necessary
- **Rate Limited**: Built-in protection against abuse
- **Beautiful UI**: Modern, responsive design that works on all devices

## 🏗️ Architecture

Inspired by yt1s.biz's architecture:
- Static UI shows all options instantly (no backend wait)
- Extracts video URLs on-demand when user clicks download
- Generates time-limited JWT tokens for secure downloads
- Streams or redirects based on source (saves bandwidth)

## 📦 Tech Stack

- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Video Extraction**: youtube-dl-exec (yt-dlp)
- **Caching**: In-memory LRU cache
- **Security**: JWT tokens, rate limiting, domain whitelist

## 🛠️ Local Development

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open http://localhost:5173

## 🚀 Deploy to Render (Free)

### Option 1: One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Option 2: Manual Deploy

1. Fork this repository

2. Create a new Web Service on Render:
   - Connect your GitHub account
   - Select this repository
   - Use these settings:
     - **Environment**: Node
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. Add environment variables:
   - `JWT_SECRET`: Click "Generate" for a random value
   - `NODE_ENV`: Set to `production`

4. Deploy! Your app will be live at `https://your-app.onrender.com`

## ⚙️ Configuration

### Environment Variables

- `JWT_SECRET`: Secret key for signing download tokens (required in production)
- `NODE_ENV`: Set to `production` for production builds

### Rate Limiting

Default: 10 requests per minute per IP. Adjust in `/lib/rateLimit.ts`:

```typescript
isRateLimited(ip, 10, 60000) // 10 requests per 60 seconds
```

### Cache Duration

URLs are cached for 5 minutes. Adjust in `/lib/ytdlp.ts`:

```typescript
ttl: 1000 * 60 * 5 // 5 minutes
```

## 🔒 Security Features

- **Domain Whitelist**: Only allows downloads from YouTube/Vimeo CDNs
- **JWT Tokens**: Time-limited tokens (10 minutes) for download URLs
- **Rate Limiting**: Prevents abuse with per-IP rate limits
- **No Storage**: Videos never touch your server's disk
- **Input Validation**: Strict URL validation for supported sites

## 📊 Free Tier Limits

### Render Free Tier
- **RAM**: 512MB (handles ~5-10 concurrent streams)
- **CPU**: 0.1 vCPU
- **Sleep**: After 15 minutes of inactivity
- **Bandwidth**: Unspecified (we minimize by redirecting when possible)

### Optimizations for Free Tier
- Redirects to source when possible (uses zero bandwidth)
- Only proxies when necessary (some video sources)
- Aggressive caching to reduce processing
- Lightweight UI with minimal assets

## 🤝 Keep Alive Tip

Render free tier sleeps after 15 minutes. To keep it awake:

Add this to your frontend:
```javascript
// Ping health endpoint every 14 minutes
setInterval(() => {
  fetch('/api/health');
}, 14 * 60 * 1000);
```

## 🔧 Troubleshooting

### "Application error" on first visit
- Normal on Render free tier (cold start)
- Takes 30-60 seconds to wake up
- Add a "waking up" message to set expectations

### Downloads fail
- Check if yt-dlp needs updating
- Some videos may be region-locked or private
- Rate limit may be hit (wait 1 minute)

### High memory usage
- Normal when streaming large videos
- Render will auto-restart if OOM
- Consider upgrading if you have many concurrent users

## 📈 Scaling Beyond Free Tier

When you outgrow the free tier (>1000 daily users):

1. **Upgrade Render**: $7/month for 1GB RAM + no sleep
2. **Add Redis**: For persistent caching across restarts
3. **Use CDN**: CloudFlare free tier for static assets
4. **Multiple Instances**: Load balance across multiple free instances

## 🙏 Credits

- Inspired by [yt1s.biz](https://v1.yt1s.biz) architecture
- Built with [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- Deployed on [Render](https://render.com)

## ⚖️ Legal

This tool is for personal use only. Respect copyright laws and terms of service of video platforms. The developers are not responsible for misuse.

## 📄 License

MIT - Use freely, but at your own risk!

---

**Remember**: This gives you full control over your video downloader. No more worrying about sites disappearing!