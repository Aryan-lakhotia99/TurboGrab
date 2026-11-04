import React from 'react';
import { Zap, Play, Pause, Maximize2, Activity } from 'lucide-react';
import { EngineStats } from '../types';

interface MiniFloatingBarProps {
  stats: EngineStats;
  onRestore: () => void;
  onBulkPause: () => void;
  onBulkResume: () => void;
}

export const MiniFloatingBar: React.FC<MiniFloatingBarProps> = ({
  stats,
  onRestore,
  onBulkPause,
  onBulkResume,
}) => {
  const formatSpeed = (bps: number) => {
    if (bps === 0) return '0.0 MB/s';
    const mbps = bps / (1024 * 1024);
    if (mbps < 1) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${mbps.toFixed(1)} MB/s`;
  };

  return (
    <div className="h-screen w-screen bg-white flex flex-col justify-between p-4 border border-genesis-border select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-genesis-primary flex items-center justify-center text-white">
            <Zap className="h-4 w-4 fill-white" />
          </div>
          <div>
            <span className="font-display font-bold text-xs block text-genesis-text-primary leading-tight">TurboGrab Mini</span>
            <span className="font-mono text-[10px] text-genesis-text-secondary">
              {stats.active_downloads} Active Tasks
            </span>
          </div>
        </div>

        <button
          onClick={onRestore}
          className="p-1.5 rounded hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary"
          title="Restore Full Dashboard"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 bg-genesis-background rounded border border-genesis-border text-center">
        <span className="text-[10px] uppercase font-bold text-genesis-text-secondary block">Aggregate Throughput</span>
        <span className="font-mono font-bold text-lg text-genesis-primary">
          {formatSpeed(stats.global_speed_bps)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBulkResume}
          className="flex-1 py-1.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center gap-1"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>Resume</span>
        </button>
        <button
          onClick={onBulkPause}
          className="flex-1 py-1.5 text-xs font-medium rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 flex items-center justify-center gap-1"
        >
          <Pause className="h-3 w-3 fill-current" />
          <span>Pause</span>
        </button>
      </div>
    </div>
  );
};
