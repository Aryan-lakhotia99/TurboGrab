import React, { useState } from 'react';
import {
  DownloadItem,
  SegmentState,
  TaskStatus,
  SidebarView
} from '../types';
import {
  Play,
  Pause,
  Trash2,
  FolderOpen,
  FileCode,
  Film,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Eye,
  ArrowUpDown,
  FileText
} from 'lucide-react';

interface ActiveQueueDashboardProps {
  downloads: DownloadItem[];
  currentView: SidebarView;
  searchQuery: string;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string, deleteFile?: boolean) => void;
  onOpenFolder: (filepath: string) => void;
  onOpenFile: (filepath: string) => void;
  onSelectDownload: (item: DownloadItem) => void;
  onBulkPause: () => void;
  onBulkResume: () => void;
  onBulkDelete: (completedOnly: boolean) => void;
  isDark?: boolean;
}

export const ActiveQueueDashboard: React.FC<ActiveQueueDashboardProps> = ({
  downloads,
  currentView,
  searchQuery,
  onPause,
  onResume,
  onCancel,
  onOpenFolder,
  onOpenFile,
  onSelectDownload,
  onBulkPause,
  onBulkResume,
  onBulkDelete,
  isDark = false,
}) => {
  const [expandedHeatmapId, setExpandedHeatmapId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'speed'>('date');

  // Filter based on Sidebar View
  let filteredDownloads = downloads.filter((d) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!d.filename.toLowerCase().includes(q) && !d.url.toLowerCase().includes(q)) {
        return false;
      }
    }

    if (currentView === 'active') return d.status === 'downloading' || d.status === 'demuxing';
    if (currentView === 'queued') return d.status === 'queued';
    if (currentView === 'paused') return d.status === 'paused';
    if (currentView === 'completed') return d.status === 'completed';
    if (currentView === 'failed') return d.status === 'error';
    if (currentView === 'video') return d.is_stream;
    return true;
  });

  // Sort downloads
  filteredDownloads = [...filteredDownloads].sort((a, b) => {
    if (sortBy === 'name') return a.filename.localeCompare(b.filename);
    if (sortBy === 'size') return b.total_bytes - a.total_bytes;
    if (sortBy === 'speed') return b.speed_bps - a.speed_bps;
    return b.created_at - a.created_at;
  });

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

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag text-[10px] font-mono font-semibold bg-indigo-50 text-genesis-primary border border-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-genesis-primary animate-pulse" />
            STREAMING
          </span>
        );
      case 'demuxing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag text-[10px] font-mono font-semibold bg-amber-50 text-amber-600 border border-amber-200">
            <Sparkles className="h-3 w-3" />
            DEMUXING
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag text-[10px] font-mono font-semibold bg-gray-100 text-gray-600 border border-genesis-border">
            PAUSED
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            COMPLETED
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag text-[10px] font-mono font-semibold bg-red-50 text-red-600 border border-red-200">
            <AlertCircle className="h-3 w-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-tag text-[10px] font-mono bg-gray-100 text-gray-500 border border-genesis-border">
            QUEUED
          </span>
        );
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-4 ${
      isDark ? 'bg-gray-950 text-gray-100' : 'bg-genesis-background text-genesis-text-primary'
    }`}>
      {/* Top Controls: Title, Bulk Actions & Sorter */}
      <div className={`flex items-center justify-between pb-3 border-b ${
        isDark ? 'border-gray-800' : 'border-genesis-border'
      }`}>
        <div>
          <h1 className={`font-display font-bold text-lg capitalize ${
            isDark ? 'text-gray-100' : 'text-genesis-text-primary'
          }`}>
            {currentView === 'all' ? 'All Download Tasks' : `${currentView} Downloads`}
          </h1>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-genesis-text-secondary'}`}>
            Showing {filteredDownloads.length} of {downloads.length} items
          </span>
        </div>

        {/* Bulk Actions & Sort */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBulkResume}
            className={`px-2.5 py-1 text-xs font-medium rounded border flex items-center gap-1 transition-all ${
              isDark ? 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-genesis-border hover:bg-genesis-muted text-genesis-text-primary'
            }`}
            title="Resume All Paused"
          >
            <Play className="h-3 w-3 fill-current text-emerald-600" />
            <span>Resume All</span>
          </button>
          <button
            onClick={onBulkPause}
            className={`px-2.5 py-1 text-xs font-medium rounded border flex items-center gap-1 transition-all ${
              isDark ? 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-genesis-border hover:bg-genesis-muted text-genesis-text-primary'
            }`}
            title="Pause All Downloading"
          >
            <Pause className="h-3 w-3 fill-current text-amber-600" />
            <span>Pause All</span>
          </button>
          <button
            onClick={() => onBulkDelete(true)}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-all ${
              isDark ? 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-rose-400' : 'border-genesis-border hover:bg-genesis-muted text-genesis-text-secondary hover:text-rose-600'
            }`}
            title="Clear Completed Tasks"
          >
            Clear Completed
          </button>

          <div className={`h-4 w-[1px] mx-1 ${isDark ? 'bg-gray-800' : 'bg-genesis-border'}`} />

          {/* Sorter */}
          <div className="flex items-center gap-1 text-xs font-mono text-genesis-text-secondary">
            <ArrowUpDown className="h-3 w-3" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-2 py-1 text-xs rounded border outline-none ${
                isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-genesis-border text-gray-700'
              }`}
            >
              <option value="date">Sort: Date</option>
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
              <option value="speed">Sort: Speed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Downloads Queue Cards */}
      {filteredDownloads.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 rounded-card border text-center space-y-3 shadow-sm ${
          isDark ? 'bg-gray-900/40 border-gray-800 text-gray-400' : 'bg-white border-genesis-border text-genesis-text-secondary'
        }`}>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
            isDark ? 'bg-gray-800 text-gray-400' : 'bg-genesis-muted text-genesis-text-secondary'
          }`}>
            <HardDrive className="h-6 w-6 stroke-[1.5]" />
          </div>
          <div>
            <h3 className={`font-display font-semibold text-sm ${isDark ? 'text-gray-200' : 'text-genesis-text-primary'}`}>
              No tasks in this view
            </h3>
            <p className="text-xs text-genesis-text-secondary max-w-sm mt-0.5">
              Click <strong className="text-genesis-primary">+ New Download</strong> or drop a URL into the app to begin accelerating.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDownloads.map((item) => {
            const isExpanded = expandedHeatmapId === item.id;
            const pct = item.total_bytes > 0
              ? Math.min(100, (item.downloaded_bytes / item.total_bytes) * 100)
              : (item.status === 'completed' ? 100 : 0);

            return (
              <div
                key={item.id}
                className={`rounded-card border transition-all duration-200 overflow-hidden flex flex-col ${
                  isDark
                    ? 'bg-gray-900/80 border-gray-800 hover:border-gray-700 shadow-sm'
                    : 'bg-white border-genesis-border shadow-sm hover:shadow-genesis-hover'
                }`}
              >
                {/* Main Card Row */}
                <div className="p-4 flex items-center justify-between gap-4">
                  {/* Left: Icon & Title */}
                  <div
                    onClick={() => onSelectDownload(item)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className={`h-10 w-10 rounded-btn border flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-genesis-muted border-genesis-border text-genesis-text-secondary'
                    }`}>
                      {item.is_stream ? (
                        <Film className="h-5 w-5 text-indigo-500" />
                      ) : (
                        <FileCode className="h-5 w-5 text-genesis-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-xs truncate ${
                          isDark ? 'text-gray-100' : 'text-genesis-text-primary'
                        }`} title={item.filename}>
                          {item.filename}
                        </span>
                        {getStatusBadge(item.status)}
                        {item.category && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                            isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {item.category}
                          </span>
                        )}
                        {item.verified_hash && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            SHA-256
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-mono truncate max-w-lg ${
                        isDark ? 'text-gray-500' : 'text-genesis-text-secondary'
                      }`} title={item.url}>
                        {item.url}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Live Stats */}
                  <div className="flex items-center gap-6 font-mono text-xs shrink-0 select-none">
                    <div className="text-right">
                      <div className={`text-[10px] leading-none ${isDark ? 'text-gray-500' : 'text-genesis-text-secondary'}`}>Progress</div>
                      <div className={`font-bold mt-0.5 ${isDark ? 'text-gray-200' : 'text-genesis-text-primary'}`}>
                        {formatBytes(item.downloaded_bytes)} / {item.total_bytes > 0 ? formatBytes(item.total_bytes) : 'Dynamic'}
                      </div>
                    </div>

                    <div className="text-right min-w-[70px]">
                      <div className={`text-[10px] leading-none ${isDark ? 'text-gray-500' : 'text-genesis-text-secondary'}`}>Speed</div>
                      <div className="font-bold text-emerald-500 mt-0.5">
                        {formatSpeed(item.speed_bps)}
                      </div>
                    </div>

                    <div className="text-right min-w-[50px]">
                      <div className={`text-[10px] leading-none ${isDark ? 'text-gray-500' : 'text-genesis-text-secondary'}`}>ETA</div>
                      <div className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-genesis-text-secondary'}`}>
                        {formatEta(item.eta_seconds)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Pause / Resume */}
                    {item.status === 'downloading' || item.status === 'demuxing' ? (
                      <button
                        onClick={() => onPause(item.id)}
                        className={`p-1.5 rounded-btn transition-all ${
                          isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary'
                        }`}
                        title="Pause Download"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    ) : item.status === 'paused' || item.status === 'error' || item.status === 'queued' ? (
                      <button
                        onClick={() => onResume(item.id)}
                        className={`p-1.5 rounded-btn transition-all ${
                          isDark ? 'hover:bg-gray-800 text-indigo-400' : 'hover:bg-genesis-muted text-genesis-primary'
                        }`}
                        title="Resume Download"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                    ) : null}

                    {/* Open File / Folder */}
                    {item.status === 'completed' && (
                      <button
                        onClick={() => onOpenFile(item.destination_path)}
                        className="p-1.5 rounded-btn hover:bg-emerald-500/10 text-emerald-500 transition-all"
                        title="Open Downloaded File"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => onOpenFolder(item.destination_path)}
                      className={`p-1.5 rounded-btn transition-all ${
                        isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary'
                      }`}
                      title="Open Containing Folder"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>

                    {/* Toggle Heatmap */}
                    <button
                      onClick={() => setExpandedHeatmapId(isExpanded ? null : item.id)}
                      className={`p-1.5 rounded-btn transition-all ${
                        isExpanded
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : isDark
                          ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                          : 'hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary'
                      }`}
                      title="Toggle 16-Segment Worker Heatmap"
                    >
                      <Layers className="h-4 w-4" />
                    </button>

                    {/* Inspect Details */}
                    <button
                      onClick={() => onSelectDownload(item)}
                      className={`p-1.5 rounded-btn transition-all ${
                        isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary'
                      }`}
                      title="View Detailed Info & Checksums"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Delete Task */}
                    <button
                      onClick={() => {
                        const deleteFile = confirm(`Delete task "${item.filename}"?\n\nClick OK to also remove the file from your computer.`);
                        onCancel(item.id, deleteFile);
                      }}
                      className="p-1.5 rounded-btn hover:bg-rose-500/10 text-gray-400 hover:text-rose-500 transition-all"
                      title="Delete Download Task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar Line */}
                <div className={`w-full h-1 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.status === 'completed' ? 'bg-emerald-500' : 'bg-genesis-primary'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Expanded 16-Thread Range Heatmap Strip */}
                {isExpanded && (
                  <div className={`p-4 border-t space-y-2 ${
                    isDark ? 'bg-gray-950/80 border-gray-800' : 'bg-genesis-background border-genesis-border'
                  }`}>
                    <div className={`flex items-center justify-between text-[11px] font-mono ${
                      isDark ? 'text-gray-400' : 'text-genesis-text-secondary'
                    }`}>
                      <span>16-Worker Concurrency Pool • Range Offsets</span>
                      <span>{item.segments.filter(s => s.is_completed).length} / {item.segments.length} Chunks Finished</span>
                    </div>

                    <div className="grid grid-cols-16 gap-1">
                      {item.segments.map((s) => {
                        const sPct = s.end_byte > s.start_byte
                          ? Math.min(100, Math.max(0, ((s.current_offset - s.start_byte) / (s.end_byte - s.start_byte)) * 100))
                          : 0;

                        return (
                          <div
                            key={s.id}
                            title={`Worker #${s.id + 1}: ${s.start_byte}-${s.end_byte} (${sPct.toFixed(0)}%)`}
                            className={`h-6 rounded-sm relative overflow-hidden ${
                              isDark ? 'bg-gray-800' : 'bg-gray-200'
                            }`}
                          >
                            <div
                              className={`absolute bottom-0 w-full transition-all duration-150 ${
                                s.is_completed ? 'bg-emerald-500' : 'bg-genesis-primary'
                              }`}
                              style={{ height: `${s.is_completed ? 100 : sPct}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
