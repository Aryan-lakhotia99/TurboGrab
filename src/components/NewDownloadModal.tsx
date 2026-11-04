import React, { useState, useEffect } from 'react';
import { X, Download, ShieldCheck, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import { api } from '../services/api';

interface NewDownloadModalProps {
  isOpen: boolean;
  initialUrl?: string;
  initialFilename?: string;
  initialFolder?: string;
  onClose: () => void;
  onStartDownload: (params: {
    url: string;
    filename?: string;
    destination_folder?: string;
    cookies?: string;
    referrer?: string;
    is_stream?: boolean;
    connections?: number;
    mode?: 'normal' | 'high_speed' | 'smart';
  }) => void;
}

export const NewDownloadModal: React.FC<NewDownloadModalProps> = ({
  isOpen,
  initialUrl,
  initialFilename,
  initialFolder,
  onClose,
  onStartDownload,
}) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [filename, setFilename] = useState(initialFilename || '');
  const [destinationFolder, setDestinationFolder] = useState(initialFolder || '');
  const [isStream, setIsStream] = useState(false);
  const [connections, setConnections] = useState(16);
  const [mode, setMode] = useState<'normal' | 'high_speed' | 'smart'>('smart');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cookies, setCookies] = useState('');
  const [referrer, setReferrer] = useState('');

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      if (!filename && !initialFilename) {
        try {
          const parsed = new URL(initialUrl);
          const base = parsed.pathname.split('/').filter(Boolean).pop();
          if (base && base.includes('.')) {
            setFilename(decodeURIComponent(base));
          }
        } catch (_) {}
      }
    }
  }, [initialUrl]);

  useEffect(() => {
    if (initialFilename) {
      setFilename(initialFilename);
    }
  }, [initialFilename]);

  useEffect(() => {
    if (initialFolder) {
      setDestinationFolder(initialFolder);
    } else if (isOpen && !destinationFolder) {
      api.getAllSettings().then((s) => {
        if (s.default_download_folder) {
          setDestinationFolder(s.default_download_folder);
        }
      }).catch(() => {});
    }
  }, [isOpen, initialFolder]);

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    const chosen = await api.selectDirectory(destinationFolder || undefined);
    if (chosen) {
      setDestinationFolder(chosen);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onStartDownload({
      url: url.trim(),
      filename: filename.trim() || undefined,
      destination_folder: destinationFolder.trim() || undefined,
      cookies: cookies.trim() || undefined,
      referrer: referrer.trim() || undefined,
      is_stream: isStream || url.includes('.m3u8') || url.includes('.mpd'),
      connections,
      mode,
    });

    setUrl('');
    setFilename('');
    setDestinationFolder('');
    setCookies('');
    setReferrer('');
    setIsStream(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-card border border-genesis-border shadow-genesis-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-genesis-border bg-genesis-background">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-btn bg-genesis-primary flex items-center justify-center text-white">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-genesis-text-primary">
                Add Accelerated Download
              </h2>
              <p className="text-xs text-genesis-text-secondary">
                Pre-allocated zero-copy transfer with 8-32 parallel threads.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-btn text-genesis-text-secondary hover:text-genesis-text-primary hover:bg-genesis-muted transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
                Download URL / Link
              </label>
              <input
                type="url"
                required
                autoFocus
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (e.target.value.includes('.m3u8') || e.target.value.includes('.mpd')) {
                    setIsStream(true);
                  }
                }}
                placeholder="https://speed.hetzner.de/10GB.bin"
                className="w-full px-3 py-2 text-xs font-mono rounded-btn border border-genesis-border bg-genesis-background focus:bg-white focus:border-genesis-primary outline-none transition-all"
              />
            </div>

            {/* Filename override */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
                Filename Override (Optional)
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g. archlinux-2026.08.iso"
                className="w-full px-3 py-2 text-xs font-mono rounded-btn border border-genesis-border bg-genesis-background focus:bg-white focus:border-genesis-primary outline-none transition-all"
              />
            </div>

            {/* Save Location (IDM-style directory picker) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary flex items-center justify-between">
                <span>Save To Folder</span>
                <span className="text-[11px] text-genesis-primary font-normal">Custom Location</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={destinationFolder}
                  onChange={(e) => setDestinationFolder(e.target.value)}
                  placeholder="e.g. C:\Users\Aryan\Downloads"
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-btn border border-genesis-border bg-genesis-background focus:bg-white focus:border-genesis-primary outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="px-3 py-2 text-xs font-medium rounded-btn border border-genesis-border bg-genesis-background hover:bg-genesis-muted text-genesis-text-primary flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                  title="Browse local folder"
                >
                  <FolderOpen className="h-4 w-4 text-genesis-primary" />
                  <span>Browse...</span>
                </button>
              </div>
            </div>

            {/* Stream checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-genesis-text-primary">
              <input
                type="checkbox"
                checked={isStream}
                onChange={(e) => setIsStream(e.target.checked)}
                className="h-4 w-4 rounded text-genesis-primary border-genesis-border focus:ring-genesis-primary"
              />
              <span>Treat as HLS / DASH playlist stream (enable demuxer)</span>
            </label>

            {/* Advanced toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-genesis-primary hover:underline font-medium"
              >
                <span>{showAdvanced ? 'Hide HTTP Headers & Cookies' : 'Specify Custom HTTP Headers & Cookies'}</span>
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 p-3 rounded-panel bg-genesis-background border border-genesis-border">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-semibold text-genesis-text-secondary">
                      Cookie Header (auth / session)
                    </label>
                    <input
                      type="text"
                      value={cookies}
                      onChange={(e) => setCookies(e.target.value)}
                      placeholder="session_id=abc; token=xyz"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-btn border border-genesis-border bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-semibold text-genesis-text-secondary">
                      Referer Header
                    </label>
                    <input
                      type="text"
                      value={referrer}
                      onChange={(e) => setReferrer(e.target.value)}
                      placeholder="https://example.com/downloads"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-btn border border-genesis-border bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-genesis-border bg-genesis-background">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-genesis-text-secondary hover:text-genesis-text-primary rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="px-5 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm hover:shadow-genesis-hover transition-all hover:-translate-y-[2px] disabled:opacity-50"
            >
              Start Accelerated Download
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
