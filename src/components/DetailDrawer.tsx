import React from 'react';
import {
  X,
  FileCode,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  FolderOpen,
  Copy,
  ExternalLink,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DownloadItem } from '../types';

interface DetailDrawerProps {
  item: DownloadItem | null;
  onClose: () => void;
  onOpenFolder: (path: string) => void;
  isDark: boolean;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  item,
  onClose,
  onOpenFolder,
  isDark,
}) => {
  if (!item) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bps: number) => {
    if (bps === 0) return '-- MB/s';
    const mbps = bps / (1024 * 1024);
    if (mbps < 1) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${mbps.toFixed(1)} MB/s`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const pct = item.total_bytes > 0 ? ((item.downloaded_bytes / item.total_bytes) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] shadow-2xl flex flex-col border-l transition-all animate-in slide-in-from-right duration-200 bg-white border-genesis-border text-genesis-text-primary">
      {/* Drawer Header */}
      <div className="h-14 px-6 border-b flex items-center justify-between bg-genesis-background">
        <div className="flex items-center gap-2.5">
          <FileCode className="h-4 w-4 text-genesis-primary" />
          <h3 className="font-display font-bold text-sm truncate max-w-[340px]">
            {item.filename}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-btn hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
        {/* Progress & Speed Hero */}
        <div className="p-4 rounded-card border border-genesis-border bg-genesis-background space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-genesis-text-secondary uppercase tracking-wider text-[10px]">
              Transfer Progress
            </span>
            <span className="font-mono font-bold text-sm text-genesis-primary">
              {pct}%
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-genesis-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div>
              <span className="text-genesis-text-secondary text-[10px] block">Downloaded</span>
              <span className="font-bold">{formatBytes(item.downloaded_bytes)}</span>
            </div>
            <div>
              <span className="text-genesis-text-secondary text-[10px] block">Total Size</span>
              <span className="font-bold">{item.total_bytes > 0 ? formatBytes(item.total_bytes) : 'Dynamic'}</span>
            </div>
            <div>
              <span className="text-genesis-text-secondary text-[10px] block">Speed</span>
              <span className="font-bold text-emerald-600">{formatSpeed(item.speed_bps)}</span>
            </div>
          </div>
        </div>

        {/* 16-Segment Real-time Heatmap */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-genesis-text-secondary uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-genesis-primary" />
              <span>16-Segment Range Worker Pool</span>
            </span>
            <span className="text-[10px] font-mono text-genesis-text-secondary">
              Work-Stealing: Active
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1.5 p-3 rounded-card border border-genesis-border bg-white shadow-sm">
            {item.segments.map((seg) => {
              const segPct = seg.end_byte > seg.start_byte
                ? Math.min(100, Math.max(0, ((seg.current_offset - seg.start_byte) / (seg.end_byte - seg.start_byte)) * 100))
                : 0;

              return (
                <div
                  key={seg.id}
                  title={`Thread #${seg.id + 1} • Range: ${seg.start_byte} - ${seg.end_byte} • ${segPct.toFixed(0)}%`}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-full h-12 bg-gray-100 rounded-sm relative overflow-hidden border border-gray-200">
                    <div
                      className={`absolute bottom-0 w-full transition-all duration-200 ${
                        seg.is_completed ? 'bg-emerald-500' : 'bg-genesis-primary'
                      }`}
                      style={{ height: `${seg.is_completed ? 100 : segPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-genesis-text-secondary">
                    T{seg.id + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* File & Metadata Attributes */}
        <div className="space-y-3">
          <span className="font-semibold text-genesis-text-secondary uppercase tracking-wider text-[10px]">
            File & Stream Attributes
          </span>

          <div className="space-y-2 font-mono text-[11px] bg-genesis-background p-3 rounded-card border border-genesis-border">
            <div className="flex justify-between items-center py-1 border-b border-genesis-border">
              <span className="text-genesis-text-secondary">Category:</span>
              <span className="font-semibold">{item.category || 'Other'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-genesis-border">
              <span className="text-genesis-text-secondary">Connections:</span>
              <span className="font-semibold">{item.connections || 16} parallel</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-genesis-border">
              <span className="text-genesis-text-secondary">Acceleration Mode:</span>
              <span className="font-semibold uppercase">{item.mode || 'smart'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-genesis-border">
              <span className="text-genesis-text-secondary">ETag:</span>
              <span className="truncate max-w-[220px]" title={item.etag || 'None'}>{item.etag || 'None'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-genesis-border">
              <span className="text-genesis-text-secondary">Last Modified:</span>
              <span className="truncate max-w-[220px]">{item.last_modified || 'None'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-genesis-text-secondary">Retry Count:</span>
              <span className="font-semibold">{item.retry_count || 0}</span>
            </div>
          </div>
        </div>

        {/* SHA-256 Integrity Verification */}
        <div className="space-y-2">
          <span className="font-semibold text-genesis-text-secondary uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>SHA-256 Cryptographic Integrity</span>
          </span>

          <div className="p-3 rounded-card border border-genesis-border bg-white font-mono text-[10px] break-all space-y-1.5">
            {item.verified_hash ? (
              <div className="text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                <span className="font-bold block">Verified Checksum:</span>
                {item.verified_hash}
              </div>
            ) : (
              <div className="text-genesis-text-secondary italic">
                Hash verification will compute automatically upon completion.
              </div>
            )}
          </div>
        </div>

        {/* Source URL & Destination Folder */}
        <div className="space-y-2">
          <span className="font-semibold text-genesis-text-secondary uppercase tracking-wider text-[10px]">
            Target Location
          </span>

          <div className="p-3 rounded-card border border-genesis-border bg-genesis-background space-y-2">
            <div>
              <span className="text-[10px] text-genesis-text-secondary block">Destination:</span>
              <span className="font-mono text-[11px] truncate block text-genesis-text-primary" title={item.destination_path}>
                {item.destination_path}
              </span>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onOpenFolder(item.destination_path)}
                className="px-3 py-1.5 text-[11px] rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted flex items-center gap-1.5 transition-all shadow-sm"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>Show in Folder</span>
              </button>
              <button
                onClick={() => copyToClipboard(item.url)}
                className="px-3 py-1.5 text-[11px] rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy URL</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
