const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC functions to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Video extraction
  extractVideo: (url) => ipcRenderer.invoke('extract-video', url),

  // Download video
  downloadVideo: (url, quality, format, outputPath) =>
    ipcRenderer.invoke('download-video', { url, quality, format, outputPath }),

  // Download progress events
  onDownloadProgress: (callback) =>
    ipcRenderer.on('download-progress', callback),

  // Get app version
  getVersion: () => ipcRenderer.invoke('get-version'),

  // File system operations
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});