import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, HardDrive, PieChart, Activity } from 'lucide-react';
import { AnalyticsData } from '../types';
import { api } from '../services/api';

interface AnalyticsViewProps {
  isDark: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ isDark }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    api.getAnalytics().then(setData).catch(console.warn);
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (!data) {
    return <div className="p-8 text-center text-xs text-genesis-text-secondary">Loading telemetry metrics...</div>;
  }

  const successRate = data.totalDownloads > 0
    ? ((data.completedDownloads / data.totalDownloads) * 100).toFixed(1)
    : '100.0';

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-genesis-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-btn bg-genesis-primary/10 border border-genesis-primary/20 flex items-center justify-center text-genesis-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg text-genesis-text-primary">
            Download Analytics & Telemetry
          </h1>
          <p className="text-xs text-genesis-text-secondary">
            Aggregate transfer volume, success ratios, and storage distribution.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-card border border-genesis-border bg-white shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-genesis-text-secondary text-xs">
            <span>Total Transfers</span>
            <Activity className="h-4 w-4 text-genesis-primary" />
          </div>
          <span className="font-mono font-bold text-2xl text-genesis-text-primary block">
            {data.totalDownloads}
          </span>
          <span className="text-[11px] text-genesis-text-secondary">All-time tracked sessions</span>
        </div>

        <div className="p-4 rounded-card border border-genesis-border bg-white shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-genesis-text-secondary text-xs">
            <span>Data Transferred</span>
            <HardDrive className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="font-mono font-bold text-2xl text-genesis-text-primary block">
            {formatBytes(data.totalBytes)}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Pre-allocated zero-copy</span>
        </div>

        <div className="p-4 rounded-card border border-genesis-border bg-white shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-genesis-text-secondary text-xs">
            <span>Success Rate</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="font-mono font-bold text-2xl text-emerald-600 block">
            {successRate}%
          </span>
          <span className="text-[11px] text-genesis-text-secondary">{data.completedDownloads} completed</span>
        </div>

        <div className="p-4 rounded-card border border-genesis-border bg-white shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-genesis-text-secondary text-xs">
            <span>Failed Tasks</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <span className="font-mono font-bold text-2xl text-rose-600 block">
            {data.failedDownloads}
          </span>
          <span className="text-[11px] text-genesis-text-secondary">Network / DNS dropouts</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="p-6 rounded-card border border-genesis-border bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-genesis-primary" />
            <h2 className="font-display font-bold text-sm text-genesis-text-primary">
              Distribution by Media Category
            </h2>
          </div>
          <span className="text-xs text-genesis-text-secondary font-mono">
            {data.categoryBreakdown.length} Active Classes
          </span>
        </div>

        <div className="space-y-3">
          {data.categoryBreakdown.length === 0 ? (
            <div className="text-center py-6 text-xs text-genesis-text-secondary italic">
              No categorized downloads recorded yet.
            </div>
          ) : (
            data.categoryBreakdown.map((cat) => {
              const catPct = data.totalDownloads > 0
                ? ((cat.count / data.totalDownloads) * 100).toFixed(0)
                : 0;

              return (
                <div key={cat.category} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-genesis-text-primary">{cat.category}</span>
                    <span className="font-mono text-genesis-text-secondary">
                      {cat.count} files • {formatBytes(cat.bytes)} ({catPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-genesis-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${catPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
