import { useState } from 'react';
import Head from 'next/head';

interface VideoFormat {
  quality: string;
  format: string;
  downloadUrl: string;
  filesize?: number;
  hasAudio: boolean;
  canMergeAudio?: boolean;
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
      // Check if running in Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        console.log('🖥️ Running in Electron, using IPC');
        const result = await (window as any).electronAPI.extractVideo(url);

        if (!result.success) {
          throw new Error(result.error || 'Failed to extract video');
        }

        // Transform the data to match the expected format
        const transformedData = {
          ...result.data,
          formats: result.data.formats.map((format: any) => ({
            ...format,
            downloadUrl: format.url // Placeholder - we'll handle downloads differently
          }))
        };

        setVideoInfo(transformedData);
      } else {
        console.log('🌐 Running in browser, using API');
        // Fallback to web API for browser/dev mode
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
      }
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

  const handleDownload = async (format: VideoFormat) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        // Show save dialog for desktop app
        const saveDialog = await (window as any).electronAPI.showSaveDialog({
          defaultPath: `${videoInfo?.title || 'video'}.${format.format}`,
          filters: [
            { name: 'Video Files', extensions: [format.format] }
          ]
        });

        if (!saveDialog.canceled && saveDialog.filePath) {
          console.log('📥 Starting download to:', saveDialog.filePath);

          const result = await (window as any).electronAPI.downloadVideo(
            url,
            format.quality,
            format.format,
            saveDialog.filePath
          );

          if (result.success) {
            alert('Download completed successfully!');
          } else {
            alert(`Download failed: ${result.error}`);
          }
        }
      } catch (error) {
        console.error('Download error:', error);
        alert('Download failed: ' + (error as Error).message);
      }
    } else {
      // For web version, create proper download instead of opening in browser
      try {
        const response = await fetch(format.downloadUrl);
        const blob = await response.blob();

        // Create download link
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${videoInfo?.title || 'video'}.${format.format}`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL
        URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback to direct link if fetch fails
        const link = document.createElement('a');
        link.href = format.downloadUrl;
        link.download = `${videoInfo?.title || 'video'}.${format.format}`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const videoFormats = videoInfo?.formats.filter(f => f.format === 'mp4') || [];
  const audioFormats = videoInfo?.formats.filter(f => f.format === 'mp3') || [];

  return (
    <div className="min-h-screen bg-gray-900">
      <Head>
        <title>Video Downloader - Free & Private</title>
        <meta name="description" content="Download videos from YouTube and Vimeo instantly. No ads, no tracking, completely free." />
      </Head>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Video Downloader
          </h1>
          <p className="text-white/90 text-lg">
            Paste video link below, then click CONVERT
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
              className="px-8 py-3 bg-gray-800 text-white font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
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
            <div className="p-6 bg-gray-800">
              <div className="flex flex-col md:flex-row gap-4">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full md:w-48 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white mb-2">
                    {videoInfo.title}
                  </h2>
                  <p className="text-gray-200">
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
                      ? 'text-gray-200 border-b-2 border-gray-300'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  🎥 Video (MP4)
                </button>
                <button
                  onClick={() => setActiveTab('audio')}
                  className={`flex-1 py-3 font-semibold transition-colors ${
                    activeTab === 'audio'
                      ? 'text-gray-200 border-b-2 border-gray-300'
                      : 'text-gray-400 hover:text-gray-200'
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
                          {format.hasAudio
                            ? '✓ With Audio'
                            : (typeof window !== 'undefined' && (window as any).electronAPI && format.canMergeAudio)
                              ? '🎵 Audio Added on Download'
                              : '⚠️ No Audio'
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          {formatFileSize(format.filesize)}
                        </span>
                        <button
                          onClick={() => handleDownload(format)}
                          className="px-6 py-2 bg-gray-800 text-white font-medium rounded-md hover:opacity-90 transition-opacity"
                        >
                          Download
                        </button>
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
                        <button
                          onClick={() => handleDownload(format)}
                          className="px-6 py-2 bg-gray-800 text-white font-medium rounded-md hover:opacity-90 transition-opacity"
                        >
                          Download
                        </button>
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

      </div>
    </div>
  );
}