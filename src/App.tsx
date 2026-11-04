import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ActiveQueueDashboard } from './components/ActiveQueueDashboard';
import { DetailDrawer } from './components/DetailDrawer';
import { NewDownloadModal } from './components/NewDownloadModal';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { ScheduleDownloadModal } from './components/ScheduleDownloadModal';
import { ScheduledView } from './components/ScheduledView';
import { HistoryView } from './components/HistoryView';
import { CategoriesView } from './components/CategoriesView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { BrowserIntegrationView } from './components/BrowserIntegrationView';
import { SpeedLimiterModal } from './components/SpeedLimiterModal';
import { MediaSnifferModal } from './components/MediaSnifferModal';
import { ClipboardPrompt } from './components/ClipboardPrompt';
import { MiniFloatingBar } from './components/MiniFloatingBar';
import { api } from './services/api';
import { DownloadItem, EngineStats, SidebarView } from './types';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<SidebarView>('dashboard');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [stats, setStats] = useState<EngineStats>({
    global_speed_bps: 0,
    active_downloads: 0,
    total_downloads: 0,
    speed_limit_bps: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [selectedDownload, setSelectedDownload] = useState<DownloadItem | null>(null);

  // Modals
  const [isNewDownloadOpen, setIsNewDownloadOpen] = useState(false);
  const [newDownloadInitialUrl, setNewDownloadInitialUrl] = useState('');
  const [newDownloadInitialFilename, setNewDownloadInitialFilename] = useState('');
  const [newDownloadInitialFolder, setNewDownloadInitialFolder] = useState('');
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSpeedLimiterOpen, setIsSpeedLimiterOpen] = useState(false);
  const [isMediaSnifferOpen, setIsMediaSnifferOpen] = useState(false);

  const fetchState = async () => {
    try {
      const [items, currentStats] = await Promise.all([
        api.getAllDownloads(),
        api.getQueueStats(),
      ]);
      setDownloads(items);
      setStats(currentStats);

      // Keep selected download synced
      if (selectedDownload) {
        const updated = items.find(d => d.id === selectedDownload.id);
        if (updated) setSelectedDownload(updated);
      }
    } catch (err) {
      console.error('Error fetching state:', err);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 750);
    return () => clearInterval(interval);
  }, [selectedDownload?.id]);

  // IDM-Style Interception Prompt from Browser Extension or Native Host
  useEffect(() => {
    const unsubscribe = api.onPromptDownloadLocation((payload: any) => {
      if (payload && payload.url) {
        setNewDownloadInitialUrl(payload.url);
        setNewDownloadInitialFilename(payload.filename || payload.title || '');
        setNewDownloadInitialFolder(payload.destination_folder || '');
        setIsNewDownloadOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Drag and drop URL support
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const text = e.dataTransfer?.getData('text/plain');
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setNewDownloadInitialUrl(text.trim());
        setIsNewDownloadOpen(true);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewDownloadInitialUrl('');
        setIsNewDownloadOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsBatchOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleToggleMiniMode();
      } else if (e.key === 'Escape') {
        setSelectedDownload(null);
        setIsNewDownloadOpen(false);
        setIsBatchOpen(false);
        setIsScheduleOpen(false);
        setIsSpeedLimiterOpen(false);
        setIsMediaSnifferOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMiniMode]);

  const handleStartDownload = async (params: {
    url: string;
    filename?: string;
    destination_folder?: string;
    cookies?: string;
    referrer?: string;
    is_stream?: boolean;
    connections?: number;
    mode?: 'normal' | 'high_speed' | 'smart';
  }) => {
    await api.startDownload(params);
    fetchState();
  };

  const handleStartBatch = async (items: { url: string; filename?: string; category?: string }[]) => {
    await api.startBatchDownloads(items);
    fetchState();
  };

  const handlePause = async (id: string) => {
    await api.pauseDownload(id);
    fetchState();
  };

  const handleResume = async (id: string) => {
    await api.resumeDownload(id);
    fetchState();
  };

  const handleCancel = async (id: string, deleteFile = false) => {
    await api.cancelDownload(id, deleteFile);
    if (selectedDownload && selectedDownload.id === id) {
      setSelectedDownload(null);
    }
    fetchState();
  };

  const handleBulkPause = async () => {
    await api.bulkPause();
    fetchState();
  };

  const handleBulkResume = async () => {
    await api.bulkResume();
    fetchState();
  };

  const handleBulkDelete = async (completedOnly = false) => {
    await api.bulkDelete(completedOnly);
    fetchState();
  };

  const handleOpenFolder = async (filepath: string) => {
    await api.openFolder(filepath);
  };

  const handleOpenFile = async (filepath: string) => {
    await api.openFile(filepath);
  };

  const handleSaveSpeedLimit = async (limitBps: number) => {
    await api.setSpeedLimit(limitBps);
    fetchState();
  };

  const handleToggleMiniMode = async () => {
    const nextMode = !isMiniMode;
    setIsMiniMode(nextMode);
    await api.toggleMiniMode(nextMode);
  };

  if (isMiniMode) {
    return (
      <MiniFloatingBar
        stats={stats}
        onRestore={handleToggleMiniMode}
        onBulkPause={handleBulkPause}
        onBulkResume={handleBulkResume}
      />
    );
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-body select-none ${
      isDark ? 'bg-gray-950 text-gray-100' : 'bg-genesis-background text-genesis-text-primary'
    }`}>
      {/* Required 13-item Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        downloads={downloads}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Sticky Top Navigation */}
        <Navbar
          stats={stats}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNewDownload={() => {
            setNewDownloadInitialUrl('');
            setIsNewDownloadOpen(true);
          }}
          onOpenBatchDownload={() => setIsBatchOpen(true)}
          onOpenScheduleModal={() => setIsScheduleOpen(true)}
          onOpenSpeedLimiter={() => setIsSpeedLimiterOpen(true)}
          onOpenMediaSniffer={() => setIsMediaSnifferOpen(true)}
          isMiniMode={isMiniMode}
          onToggleMiniMode={handleToggleMiniMode}
          isDark={isDark}
        />

        {/* View Switcher */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {currentView === 'dashboard' ? (
            <DashboardView
              downloads={downloads}
              stats={stats}
              onOpenNewDownload={(initUrl) => {
                setNewDownloadInitialUrl(initUrl || '');
                setIsNewDownloadOpen(true);
              }}
              onOpenBatchDownload={() => setIsBatchOpen(true)}
              onOpenMediaSniffer={() => setIsMediaSnifferOpen(true)}
              onOpenSpeedLimiter={() => setIsSpeedLimiterOpen(true)}
              onOpenScheduleModal={() => setIsScheduleOpen(true)}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onOpenFolder={handleOpenFolder}
              onOpenFile={handleOpenFile}
              onSelectDownload={(item) => setSelectedDownload(item)}
              onBulkPause={handleBulkPause}
              onBulkResume={handleBulkResume}
              onBulkDelete={handleBulkDelete}
              onQuickDownload={(url) => {
                handleStartDownload({ url });
              }}
              onNavigateView={(view) => setCurrentView(view)}
              isDark={isDark}
            />
          ) : currentView === 'scheduled' ? (
            <ScheduledView
              onOpenScheduleModal={() => setIsScheduleOpen(true)}
              isDark={isDark}
            />
          ) : currentView === 'history' ? (
            <HistoryView
              onReDownload={(url) => {
                setNewDownloadInitialUrl(url);
                setIsNewDownloadOpen(true);
              }}
              onOpenFolder={handleOpenFolder}
              isDark={isDark}
            />
          ) : currentView === 'categories' ? (
            <CategoriesView
              onOpenFolder={handleOpenFolder}
              isDark={isDark}
            />
          ) : currentView === 'analytics' ? (
            <AnalyticsView isDark={isDark} />
          ) : currentView === 'settings' ? (
            <SettingsView
              isDark={isDark}
              onOpenFolder={handleOpenFolder}
            />
          ) : currentView === 'browser-integration' ? (
            <BrowserIntegrationView
              isDark={isDark}
            />
          ) : (
            <ActiveQueueDashboard
              downloads={downloads}
              currentView={currentView}
              searchQuery={searchQuery}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onOpenFolder={handleOpenFolder}
              onOpenFile={handleOpenFile}
              onSelectDownload={(item) => setSelectedDownload(item)}
              onBulkPause={handleBulkPause}
              onBulkResume={handleBulkResume}
              onBulkDelete={handleBulkDelete}
              isDark={isDark}
            />
          )}
        </main>
      </div>

      {/* Inspection Drawer */}
      <DetailDrawer
        item={selectedDownload}
        onClose={() => setSelectedDownload(null)}
        onOpenFolder={handleOpenFolder}
        isDark={isDark}
      />

      {/* Clipboard URL Prompt */}
      <ClipboardPrompt
        onStartDownload={(url) => {
          setNewDownloadInitialUrl(url);
          setIsNewDownloadOpen(true);
        }}
      />

      {/* Genesis Modals */}
      <NewDownloadModal
        isOpen={isNewDownloadOpen}
        initialUrl={newDownloadInitialUrl}
        initialFilename={newDownloadInitialFilename}
        initialFolder={newDownloadInitialFolder}
        onClose={() => {
          setIsNewDownloadOpen(false);
          setNewDownloadInitialFilename('');
          setNewDownloadInitialFolder('');
        }}
        onStartDownload={handleStartDownload}
      />

      <BatchDownloadModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        onStartBatch={handleStartBatch}
      />

      <ScheduleDownloadModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        downloads={downloads}
        onScheduled={fetchState}
      />

      <SpeedLimiterModal
        isOpen={isSpeedLimiterOpen}
        currentLimitBps={stats.speed_limit_bps}
        onClose={() => setIsSpeedLimiterOpen(false)}
        onSaveLimit={handleSaveSpeedLimit}
      />

      <MediaSnifferModal
        isOpen={isMediaSnifferOpen}
        onClose={() => setIsMediaSnifferOpen(false)}
        onStartStreamDownload={(url, quality) => {
          handleStartDownload({
            url,
            filename: `Stream_${quality}_${Date.now()}.mp4`,
            is_stream: true,
          });
        }}
      />
    </div>
  );
};

export default App;
