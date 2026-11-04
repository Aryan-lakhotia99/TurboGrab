import React from 'react';
import {
  LayoutDashboard,
  List,
  Activity,
  Clock,
  PauseCircle,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Film,
  FolderTree,
  History,
  BarChart3,
  Settings,
  Moon,
  Sun,
  Zap,
  Compass,
  Sparkles
} from 'lucide-react';
import { SidebarView, DownloadItem } from '../types';

interface SidebarProps {
  currentView: SidebarView;
  onSelectView: (view: SidebarView) => void;
  downloads: DownloadItem[];
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  downloads,
  isDark,
  onToggleTheme,
}) => {
  const counts = {
    all: downloads.length,
    active: downloads.filter(d => d.status === 'downloading' || d.status === 'demuxing').length,
    queued: downloads.filter(d => d.status === 'queued').length,
    paused: downloads.filter(d => d.status === 'paused').length,
    completed: downloads.filter(d => d.status === 'completed').length,
    failed: downloads.filter(d => d.status === 'error').length,
    video: downloads.filter(d => d.is_stream).length,
  };

  const navItems: { id: SidebarView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'all', label: 'All Downloads', icon: <List className="h-4 w-4" />, badge: counts.all },
    { id: 'active', label: 'Active', icon: <Activity className="h-4 w-4" />, badge: counts.active, badgeColor: 'bg-indigo-100 text-indigo-700' },
    { id: 'queued', label: 'Queued', icon: <Clock className="h-4 w-4" />, badge: counts.queued },
    { id: 'paused', label: 'Paused', icon: <PauseCircle className="h-4 w-4" />, badge: counts.paused },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" />, badge: counts.completed, badgeColor: 'bg-emerald-100 text-emerald-700' },
    { id: 'failed', label: 'Failed', icon: <AlertTriangle className="h-4 w-4" />, badge: counts.failed, badgeColor: 'bg-rose-100 text-rose-700' },
    { id: 'scheduled', label: 'Scheduled', icon: <Calendar className="h-4 w-4" /> },
    { id: 'video', label: 'Video Downloader', icon: <Film className="h-4 w-4" />, badge: counts.video },
    { id: 'categories', label: 'Categories', icon: <FolderTree className="h-4 w-4" /> },
    { id: 'history', label: 'Download History', icon: <History className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'browser-integration', label: 'Browser Integration', icon: <Compass className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <aside className={`w-60 h-full border-r flex flex-col justify-between transition-colors select-none ${
      isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-genesis-border text-genesis-text-primary'
    }`}>
      {/* Brand Header */}
      <div>
        <div className="h-14 px-5 border-b flex items-center gap-3 border-inherit">
          <div className="h-8 w-8 rounded-btn bg-genesis-primary flex items-center justify-center text-white shadow-sm">
            <Zap className="h-4 w-4 fill-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-display">TurboGrab</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-120px)] text-xs">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-btn font-medium transition-all ${
                  isActive
                    ? 'bg-genesis-primary text-white shadow-sm'
                    : isDark
                    ? 'hover:bg-gray-800 text-gray-300'
                    : 'hover:bg-genesis-muted text-genesis-text-primary'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-white' : isDark ? 'text-gray-400' : 'text-genesis-text-secondary'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor || (isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-inherit flex items-center justify-between text-xs">
        <button
          onClick={onToggleTheme}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-btn transition-all ${
            isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-genesis-muted text-genesis-text-secondary'
          }`}
          title="Toggle Dark / Light Theme"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <span className="text-[10px] font-mono text-genesis-text-secondary">v1.1 Core</span>
      </div>
    </aside>
  );
};
