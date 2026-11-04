import React from 'react';
import {
  Zap,
  Activity,
  DownloadCloud,
  Gauge,
  Plus,
  Layers,
  Calendar,
  Search,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { EngineStats } from '../types';

interface NavbarProps {
  stats: EngineStats;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewDownload: () => void;
  onOpenBatchDownload: () => void;
  onOpenScheduleModal: () => void;
  onOpenSpeedLimiter: () => void;
  onOpenMediaSniffer: () => void;
  isMiniMode: boolean;
  onToggleMiniMode: () => void;
  isDark?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  searchQuery,
  onSearchChange,
  onOpenNewDownload,
  onOpenBatchDownload,
  onOpenScheduleModal,
  onOpenSpeedLimiter,
  onOpenMediaSniffer,
  isMiniMode,
  onToggleMiniMode,
  isDark = false,
}) => {
  const formatSpeed = (bps: number) => {
    if (bps === 0) return '0.0 MB/s';
    const mbps = bps / (1024 * 1024);
    if (mbps < 1) {
      return `${(bps / 1024).toFixed(1)} KB/s`;
    }
    return `${mbps.toFixed(1)} MB/s`;
  };

  return (
    <header className={`sticky top-0 z-40 h-[56px] w-full min-w-0 backdrop-blur-md border-b flex items-center justify-between gap-3 px-4 sm:px-5 select-none transition-all ${
      isDark ? 'bg-gray-900/90 border-gray-800 text-gray-100' : 'bg-white/90 border-genesis-border text-genesis-text-primary'
    }`}>
      {/* Search Input across active/all downloads */}
      <div className="flex items-center min-w-[140px] max-w-[220px] flex-1">
        <div className="relative w-full">
          <Search className={`h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-genesis-text-secondary'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search downloads..."
            className={`w-full pl-7 pr-2.5 py-1.5 text-xs rounded-btn border outline-none transition-all ${
              isDark
                ? 'bg-gray-800/80 border-gray-700 text-gray-100 focus:border-indigo-500 placeholder:text-gray-500'
                : 'bg-genesis-background border-genesis-border text-genesis-text-primary focus:bg-white focus:border-genesis-primary'
            }`}
          />
        </div>
      </div>

      {/* Global Speed & Metric telemetry */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Instant Speed Counter */}
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-btn border flex-shrink-0 ${
          isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-genesis-background border-genesis-border'
        }`}>
          <span className="relative flex h-2 w-2 flex-shrink-0">
            {stats.global_speed_bps > 0 ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-genesis-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-genesis-primary"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
            )}
          </span>
          <div className="flex flex-col">
            <span className={`text-[8.5px] uppercase font-bold tracking-wider leading-none ${isDark ? 'text-gray-400' : 'text-genesis-text-secondary'}`}>
              Aggregated Speed
            </span>
            <span className={`font-mono font-bold text-xs leading-tight ${isDark ? 'text-gray-100' : 'text-genesis-text-primary'}`}>
              {formatSpeed(stats.global_speed_bps)}
            </span>
          </div>
        </div>

        {/* Speed limiter badge button */}
        <button
          onClick={onOpenSpeedLimiter}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-btn text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
            isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-genesis-border hover:bg-genesis-muted text-genesis-text-secondary'
          }`}
          title="Configure Bandwidth Throttle"
        >
          <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-mono text-[11px]">
            {stats.speed_limit_bps > 0
              ? `${(stats.speed_limit_bps / (1024 * 1024)).toFixed(0)} MB/s Cap`
              : 'Unlimited'}
          </span>
        </button>

        {/* Media Sniffer Quick Launcher */}
        <button
          onClick={onOpenMediaSniffer}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-btn text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
            isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-genesis-border hover:bg-genesis-muted text-genesis-text-secondary'
          }`}
          title="Sniff Stream or Media URL"
        >
          <DownloadCloud className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Stream Sniffer</span>
        </button>

        {/* Batch URLs Button */}
        <button
          onClick={onOpenBatchDownload}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
            isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-genesis-border hover:bg-genesis-muted'
          }`}
          title="Add Multiple URLs at Once"
        >
          <Layers className="h-3.5 w-3.5 text-genesis-primary flex-shrink-0" />
          <span>Batch URLs</span>
        </button>

        {/* Schedule Button */}
        <button
          onClick={onOpenScheduleModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
            isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-genesis-border hover:bg-genesis-muted'
          }`}
          title="Schedule Download"
        >
          <Calendar className="h-3.5 w-3.5 text-genesis-primary flex-shrink-0" />
          <span>Schedule</span>
        </button>

        {/* New Download Button */}
        <button
          onClick={onOpenNewDownload}
          className="flex items-center gap-1.5 bg-genesis-primary hover:bg-genesis-primary-hover text-white px-3 py-1.5 rounded-btn font-medium text-xs shadow-sm transition-all whitespace-nowrap flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>New Download</span>
        </button>

        {/* Mini Mode Toggle */}
        <button
          onClick={onToggleMiniMode}
          className={`p-1.5 rounded-btn border transition-all flex-shrink-0 ${
            isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-400' : 'border-genesis-border hover:bg-genesis-muted text-genesis-text-secondary'
          }`}
          title={isMiniMode ? "Restore Full Window" : "Compact Mini Floating Window"}
        >
          {isMiniMode ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </header>
  );
};
