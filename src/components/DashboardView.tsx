import React, { useState } from 'react';
import {
  DownloadItem,
  EngineStats,
  SegmentState
} from '../types';
import {
  Play,
  Pause,
  Trash2,
  FolderOpen,
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
  ArrowRight,
  Download,
  Zap,
  Gauge,
  Sliders,
  Calendar,
  ListPlus,
  Radio,
  FileText
} from 'lucide-react';

interface DashboardViewProps {
  downloads: DownloadItem[];
  stats: EngineStats;
  onOpenNewDownload: (initialUrl?: string) => void;
  onOpenBatchDownload: () => void;
  onOpenMediaSniffer: () => void;
  onOpenSpeedLimiter: () => void;
  onOpenScheduleModal: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string, deleteFile?: boolean) => void;
  onOpenFolder: (filepath: string) => void;
  onOpenFile: (filepath: string) => void;
  onSelectDownload: (item: DownloadItem) => void;
  onBulkPause: () => void;
  onBulkResume: () => void;
  onBulkDelete: (completedOnly: boolean) => void;
  onQuickDownload: (url: string) => void;
  onNavigateView: (view: any) => void;
  isDark?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  downloads,
  stats,
  onOpenNewDownload,
  onOpenBatchDownload,
  onOpenMediaSniffer,
  onOpenSpeedLimiter,
  onOpenScheduleModal,
  onPause,
  onResume,
  onCancel,
  onOpenFolder,
  onOpenFile,
  onSelectDownload,
  onBulkPause,
  onBulkResume,
  onBulkDelete,
  onQuickDownload,
  onNavigateView,
  isDark = false,
}) => {
  const [quickUrl, setQuickUrl] = useState('');
  const [expandedHeatmapId, setExpandedHeatmapId] = useState<string | null>(null);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = quickUrl.trim();
    if (!url) return;
    onQuickDownload(url);
    setQuickUrl('');
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bps: number) => {
    if (!bps || bps === 0) return '0 KB/s';
    const mbps = bps / (1024 * 1024);
    if (mbps < 1) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${mbps.toFixed(2)} MB/s`;
  };

  const formatETA = (sec: number) => {
    if (!sec || sec <= 0 || !isFinite(sec)) return '--';
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  const activeTasks = downloads.filter(d => d.status === 'downloading' || d.status === 'demuxing');
  const queuedTasks = downloads.filter(d => d.status === 'queued');
  const completedTasks = downloads.filter(d => d.status === 'completed');
  const totalDownloadedBytes = downloads.reduce((acc, d) => acc + (d.downloaded_bytes || 0), 0);

  // Top 10 recent tasks for dashboard list
  const recentTasks = [...downloads].sort((a, b) => b.created_at - a.created_at).slice(0, 10);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-y-auto px-8 py-6 ${
      isDark ? 'bg-gray-950 text-gray-100' : 'bg-[#FAFAFB] text-gray-900'
    }`}>
      {/* Header & Quick Action Launcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenNewDownload()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all shadow-indigo-500/20 active:scale-95"
          >
            <Download size={14} />
            New Download
          </button>
          <button
            onClick={onOpenBatchDownload}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDark ? 'border-gray-800 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <ListPlus size={14} />
            Batch URLs
          </button>
          <button
            onClick={onOpenMediaSniffer}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDark ? 'border-gray-800 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Radio size={14} className="text-purple-500" />
            Media Sniffer
          </button>
          <button
            onClick={onOpenSpeedLimiter}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDark ? 'border-gray-800 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Gauge size={14} className="text-amber-500" />
            Speed Limiter
          </button>
          <button
            onClick={onOpenScheduleModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDark ? 'border-gray-800 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Calendar size={14} className="text-blue-500" />
            Schedule
          </button>
        </div>
      </div>

      {/* Quick Download Bar */}
      <form onSubmit={handleQuickSubmit} className="mb-6">
        <div className={`flex items-center gap-2 p-1.5 rounded-xl border shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 ${
          isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="pl-3 text-indigo-500">
            <Zap size={18} />
          </div>
          <input
            type="url"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Paste direct download URL, YouTube video link, or HLS stream (.m3u8 / .mpd)..."
            className={`flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-gray-400 ${
              isDark ? 'text-gray-100' : 'text-gray-900'
            }`}
          />
          <button
            type="submit"
            disabled={!quickUrl.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-all"
          >
            <Download size={14} />
            Grab Now
          </button>
        </div>
      </form>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Speed Card */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
          isDark ? 'bg-gray-900/60 border-gray-800/80' : 'bg-white border-gray-200/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Aggregate Speed
            </span>
            <div className={`p-2 rounded-lg ${stats.global_speed_bps > 0 ? 'bg-indigo-500/10 text-indigo-500' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
              <Zap size={18} className={stats.global_speed_bps > 0 ? 'animate-pulse' : ''} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
              {formatSpeed(stats.global_speed_bps)}
            </div>
            <div className={`text-xs mt-1 flex items-center justify-between ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span>Limiter: {stats.speed_limit_bps > 0 ? formatSpeed(stats.speed_limit_bps) : 'Unlimited'}</span>
              {stats.global_speed_bps > 0 && (
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Active & Queued Card */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
          isDark ? 'bg-gray-900/60 border-gray-800/80' : 'bg-white border-gray-200/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Active Transfers
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Cpu size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono tracking-tight">
              {activeTasks.length}{' '}
              <span className={`text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                / {queuedTasks.length} queued
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={onBulkResume}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-colors"
              >
                Resume All
              </button>
              <button
                onClick={onBulkPause}
                className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded transition-colors"
              >
                Pause All
              </button>
            </div>
          </div>
        </div>

        {/* Total Data Card */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
          isDark ? 'bg-gray-900/60 border-gray-800/80' : 'bg-white border-gray-200/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Data Transferred
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <HardDrive size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatBytes(totalDownloadedBytes)}
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {completedTasks.length} completed files
            </div>
          </div>
        </div>

        {/* Multi-thread Engine Health */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
          isDark ? 'bg-gray-900/60 border-gray-800/80' : 'bg-white border-gray-200/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Acceleration
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400">
              16 Threads
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Adaptive Range & Dynamic Stealing
            </div>
          </div>
        </div>
      </div>

      {/* Live & Recent Transfers Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">Recent & Active Transfers</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600">
              {downloads.length}
            </span>
          </div>
          <button
            onClick={() => onNavigateView('all')}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            View All Downloads
            <ArrowRight size={13} />
          </button>
        </div>

        {recentTasks.length === 0 ? (
          <div className={`flex-1 flex flex-col items-center justify-center p-12 rounded-xl border border-dashed text-center ${
            isDark ? 'border-gray-800 bg-gray-900/20' : 'border-gray-200 bg-white/50'
          }`}>
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-4">
              <Download size={26} />
            </div>
            <h3 className="text-base font-bold mb-1">No Active Downloads</h3>
            <p className={`text-xs max-w-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Paste a URL above, drop a link anywhere into TurboGrab, or use the Genesis browser extension to accelerate any web download.
            </p>
            <button
              onClick={() => onOpenNewDownload()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm"
            >
              Start First Download
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {recentTasks.map((item) => {
              const progressPct = item.total_bytes > 0
                ? Math.min(100, Math.round((item.downloaded_bytes / item.total_bytes) * 100))
                : (item.status === 'completed' ? 100 : 0);

              const isDownloading = item.status === 'downloading' || item.status === 'demuxing';
              const isPaused = item.status === 'paused';
              const isCompleted = item.status === 'completed';
              const isError = item.status === 'error';
              const isQueued = item.status === 'queued';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDark
                      ? 'bg-gray-900/70 border-gray-800/80 hover:border-gray-700'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Icon & Title */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.is_stream ? 'bg-purple-500/10 text-purple-600' :
                        isCompleted ? 'bg-emerald-500/10 text-emerald-600' :
                        isError ? 'bg-red-500/10 text-red-600' :
                        'bg-indigo-500/10 text-indigo-600'
                      }`}>
                        {item.is_stream ? <Film size={18} /> :
                         isCompleted ? <CheckCircle2 size={18} /> :
                         isError ? <AlertCircle size={18} /> :
                         <Download size={18} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs truncate max-w-md" title={item.filename}>
                            {item.filename}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            isDownloading ? 'bg-indigo-500/10 text-indigo-600' :
                            isCompleted ? 'bg-emerald-500/10 text-emerald-600' :
                            isPaused ? 'bg-amber-500/10 text-amber-600' :
                            isQueued ? 'bg-blue-500/10 text-blue-600' :
                            'bg-red-500/10 text-red-600'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                          {item.verified_hash && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-500/10 text-emerald-600 flex items-center gap-0.5">
                              <ShieldCheck size={10} />
                              SHA-256
                            </span>
                          )}
                        </div>

                        {/* Progress Bar & Sub-stats */}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-500' :
                                isError ? 'bg-red-500' :
                                isPaused ? 'bg-amber-500' :
                                'bg-indigo-600'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold w-10 text-right">
                            {progressPct}%
                          </span>
                        </div>

                        <div className={`flex items-center gap-3 mt-1 text-[11px] font-mono ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <span>{formatBytes(item.downloaded_bytes)} / {formatBytes(item.total_bytes)}</span>
                          {isDownloading && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{formatSpeed(item.speed_bps)}</span>
                              <span>•</span>
                              <span>ETA: {formatETA(item.eta_seconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isDownloading && (
                        <button
                          onClick={() => onPause(item.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-amber-600 transition-colors"
                          title="Pause"
                        >
                          <Pause size={16} />
                        </button>
                      )}
                      {(isPaused || isError || isQueued) && (
                        <button
                          onClick={() => onResume(item.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-emerald-600 transition-colors"
                          title="Resume"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      {isCompleted && (
                        <button
                          onClick={() => onOpenFile(item.destination_path)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-indigo-600 transition-colors"
                          title="Open File"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onOpenFolder(item.destination_path)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Show in Folder"
                      >
                        <FolderOpen size={16} />
                      </button>
                      <button
                        onClick={() => onSelectDownload(item)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Thread Heatmap & Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => onCancel(item.id, false)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Download"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 16-Segment Thread Heatmap Drawer Preview */}
                  {item.segments && item.segments.length > 0 && isDownloading && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-1.5 text-[10px]">
                        <span className={`font-semibold flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          <Layers size={11} className="text-indigo-500" />
                          16-Segment Range Heatmap
                        </span>
                        <span className="font-mono text-gray-400">
                          {item.segments.filter(s => s.is_completed).length} / {item.segments.length} segments done
                        </span>
                      </div>
                      <div className="grid grid-cols-16 gap-1">
                        {item.segments.map((seg, idx) => (
                          <div
                            key={idx}
                            title={`Segment ${idx + 1}: ${seg.is_completed ? '100% Completed' : 'Downloading'}`}
                            className={`h-2.5 rounded-sm transition-all ${
                              seg.is_completed
                                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20'
                                : seg.active_worker_id !== null
                                ? 'bg-indigo-500 animate-pulse'
                                : 'bg-gray-200 dark:bg-gray-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
