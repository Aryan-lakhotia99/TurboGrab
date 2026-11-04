import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { api } from '../services/api';

interface ClipboardPromptProps {
  onStartDownload: (url: string) => void;
}

export const ClipboardPrompt: React.FC<ClipboardPromptProps> = ({ onStartDownload }) => {
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [lastCopied, setLastCopied] = useState<string>('');

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await api.readClipboardText();
        if (text && text !== lastCopied && (text.startsWith('http://') || text.startsWith('https://'))) {
          // Check if looks like a downloadable link
          const clean = text.toLowerCase().split('?')[0];
          const isDownloadable =
            clean.endsWith('.zip') || clean.endsWith('.rar') || clean.endsWith('.7z') ||
            clean.endsWith('.mp4') || clean.endsWith('.mkv') || clean.endsWith('.iso') ||
            clean.endsWith('.exe') || clean.endsWith('.msi') || clean.endsWith('.pdf') ||
            clean.endsWith('.m3u8') || clean.endsWith('.mpd') ||
            text.includes('youtube.com/watch') || text.includes('youtu.be/');

          if (isDownloadable) {
            setLastCopied(text);
            setDetectedUrl(text);
          }
        }
      } catch (_) {}
    };

    const interval = setInterval(checkClipboard, 2500);
    return () => clearInterval(interval);
  }, [lastCopied]);

  if (!detectedUrl) return null;

  return (
    <div className="fixed bottom-14 right-6 z-40 max-w-sm w-full bg-white rounded-card border border-genesis-primary shadow-genesis-modal p-4 animate-in slide-in-from-bottom duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-btn bg-genesis-primary text-white flex items-center justify-center shrink-0">
            <Download className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-semibold text-xs text-genesis-text-primary">
              Download Link Detected
            </h4>
            <p className="font-mono text-[10px] text-genesis-text-secondary truncate max-w-[220px]" title={detectedUrl}>
              {detectedUrl}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDetectedUrl(null)}
          className="p-1 text-genesis-text-secondary hover:text-genesis-text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-genesis-border">
        <button
          onClick={() => setDetectedUrl(null)}
          className="px-2.5 py-1 text-[11px] rounded border border-genesis-border hover:bg-genesis-muted text-genesis-text-secondary"
        >
          Dismiss
        </button>
        <button
          onClick={() => {
            onStartDownload(detectedUrl);
            setDetectedUrl(null);
          }}
          className="px-3 py-1 text-[11px] rounded font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover shadow-sm"
        >
          Download Now
        </button>
      </div>
    </div>
  );
};
