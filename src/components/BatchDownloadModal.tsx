import React, { useState } from 'react';
import { X, Layers, Upload, Download, Check } from 'lucide-react';

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBatch: (items: { url: string; filename?: string; category?: string }[]) => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  onStartBatch,
}) => {
  const [urlsText, setUrlsText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setUrlsText(prev => prev ? `${prev}\n${content.trim()}` : content.trim());
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = urlsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http://') || l.startsWith('https://'));

    if (lines.length === 0) return;

    const items = lines.map(url => ({
      url,
      category: selectedCategory !== 'All' ? selectedCategory : undefined
    }));

    onStartBatch(items);
    setUrlsText('');
    onClose();
  };

  const parsedCount = urlsText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('http://') || l.startsWith('https://')).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white rounded-card border border-genesis-border shadow-genesis-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-genesis-border bg-genesis-background">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-btn bg-genesis-primary flex items-center justify-center text-white">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-genesis-text-primary">
                Batch URL Downloader
              </h2>
              <p className="text-xs text-genesis-text-secondary">
                Queue multiple file transfers or import URLs from a text file.
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
                Download URLs (One per line)
              </label>
              <label className="cursor-pointer text-xs text-genesis-primary hover:underline flex items-center gap-1 font-medium">
                <Upload className="h-3 w-3" />
                <span>Import .TXT File</span>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <textarea
              required
              rows={6}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder="https://example.com/file1.zip&#10;https://example.com/file2.mp4&#10;https://example.com/file3.iso"
              className="w-full p-3 text-xs font-mono rounded-btn border border-genesis-border bg-genesis-background focus:bg-white focus:border-genesis-primary outline-none transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-mono text-genesis-text-secondary">
              Detected valid URLs: <strong className="text-genesis-primary">{parsedCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-genesis-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-genesis-text-secondary hover:text-genesis-text-primary rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={parsedCount === 0}
              className="px-5 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm hover:shadow-genesis-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Queue {parsedCount} Downloads</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
