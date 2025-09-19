import { useState } from 'react';
import Head from 'next/head';

interface VideoFormat {
  quality: string;
  format: string;
  downloadUrl: string;
  filesize?: number;
  hasAudio: boolean;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setVideoInfo(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract video');
      }

      setVideoInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                 : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Auto';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const videoFormats = videoInfo?.formats.filter(f => f.format === 'mp4') || [];
  const audioFormats = videoInfo?.formats.filter(f => f.format === 'mp3') || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600">
      <Head>
        <title>Lightning Fast Video Downloader - Free & Private</title>
        <meta name="description" content="Download videos from YouTube and Vimeo instantly. No ads, no tracking, completely free." />
      </Head>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ⚡ Lightning Fast Downloader
          </h1>
          <p className="text-white/90 text-lg">
            Download videos instantly - No storage, No tracking, 100% Free
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-white rounded-lg shadow-xl p-2 flex flex-col md:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube or Vimeo URL here..."
              className="flex-1 px-4 py-3 text-gray-700 focus:outline-none"
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : 'Convert'}
            </button>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Video Info & Download Options */}
        {videoInfo && (
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            {/* Video Header */}
            <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex flex-col md:flex-row gap-4">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full md:w-48 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {videoInfo.title}
                  </h2>
                  <p className="text-gray-600">
                    Duration: {formatDuration(videoInfo.duration)}
                  </p>
                </div>
              </div>
            </div>

            {/* Format Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex-1 py-3 font-semibold transition-colors ${
                    activeTab === 'video'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🎥 Video (MP4)
                </button>
                <button
                  onClick={() => setActiveTab('audio')}
                  className={`flex-1 py-3 font-semibold transition-colors ${
                    activeTab === 'audio'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🎵 Audio (MP3)
                </button>
              </div>
            </div>

            {/* Download Options */}
            <div className="p-6">
              {activeTab === 'video' && videoFormats.length > 0 ? (
                <div className="space-y-3">
                  {videoFormats.map((format, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-gray-700">
                          {format.quality}
                        </span>
                        <span className="text-sm text-gray-500">
                          {format.hasAudio ? '✓ With Audio' : '⚠️ No Audio'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          {formatFileSize(format.filesize)}
                        </span>
                        <a
                          href={format.downloadUrl}
                          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-md hover:opacity-90 transition-opacity"
                          download
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeTab === 'audio' && audioFormats.length > 0 ? (
                <div className="space-y-3">
                  {audioFormats.map((format, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-gray-700">
                          {format.quality}
                        </span>
                        <span className="text-sm text-gray-500">
                          High Quality Audio
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          {formatFileSize(format.filesize)}
                        </span>
                        <a
                          href={format.downloadUrl}
                          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-md hover:opacity-90 transition-opacity"
                          download
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">
                  No {activeTab} formats available for this video
                </p>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="text-center text-white">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-lg mb-2">Lightning Fast</h3>
            <p className="text-white/80 text-sm">Instant processing with no queues or waiting</p>
          </div>
          <div className="text-center text-white">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-semibold text-lg mb-2">100% Private</h3>
            <p className="text-white/80 text-sm">No storage, no tracking, no ads ever</p>
          </div>
          <div className="text-center text-white">
            <div className="text-4xl mb-3">♾️</div>
            <h3 className="font-semibold text-lg mb-2">Unlimited & Free</h3>
            <p className="text-white/80 text-sm">Download as many videos as you want</p>
          </div>
        </div>
      </div>
    </div>
  );
}