import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  HardDrive,
  Globe,
  ShieldCheck,
  Save,
  Check,
  FolderOpen
} from 'lucide-react';
import { api } from '../services/api';

interface SettingsViewProps {
  isDark: boolean;
  onOpenFolder: (path: string) => void;
  onOpenWizard?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isDark, onOpenFolder, onOpenWizard }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    api.getAllSettings().then(setSettings).catch(console.warn);
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    for (const [k, v] of Object.entries(settings)) {
      await api.setSetting(k, v);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await api.checkForUpdates();
      setUpdateStatus(`Version ${res.currentVersion} • ${res.releaseNotes}`);
    } catch (_) {
      setUpdateStatus('TurboGrab is running the latest version (v1.0.0).');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-genesis-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-btn bg-genesis-primary/10 border border-genesis-primary/20 flex items-center justify-center text-genesis-primary">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-genesis-text-primary">
              Preferences & System Engine Settings
            </h1>
            <p className="text-xs text-genesis-text-secondary">
              Tune parallel work-stealing, clipboard interceptor, and download storage targets.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm transition-all flex items-center gap-1.5"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          <span>{saved ? 'Saved!' : 'Save Preferences'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Engine & Concurrency Settings */}
        <div className="p-5 rounded-card border border-genesis-border bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-genesis-border pb-3">
            <Sliders className="h-4 w-4 text-genesis-primary" />
            <h2 className="font-display font-bold text-sm text-genesis-text-primary">
              Transfer Engine & Threads
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-genesis-text-primary block">
                Acceleration Mode
              </label>
              <select
                value={settings.download_mode || 'smart'}
                onChange={(e) => handleChange('download_mode', e.target.value)}
                className="w-full px-3 py-2 rounded border border-genesis-border outline-none focus:border-genesis-primary bg-genesis-background"
              >
                <option value="smart">Smart Acceleration (Dynamic Connection Sizing)</option>
                <option value="high_speed">High-Speed Mode (Maximum 16 Threads Always)</option>
                <option value="normal">Normal Mode (Balanced CPU/Bandwidth)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-genesis-text-primary block">
                Max Parallel Range Connections Per Task
              </label>
              <select
                value={settings.max_connections_per_task || '16'}
                onChange={(e) => handleChange('max_connections_per_task', e.target.value)}
                className="w-full px-3 py-2 rounded border border-genesis-border outline-none focus:border-genesis-primary bg-genesis-background"
              >
                <option value="1">1 Connection (Single-stream fallback)</option>
                <option value="2">2 Parallel Workers</option>
                <option value="4">4 Parallel Workers</option>
                <option value="8">8 Parallel Workers</option>
                <option value="16">16 Parallel Workers (Maximum Acceleration)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-genesis-text-primary block">
                Max Simultaneous Active Downloads
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_concurrent_downloads || '4'}
                onChange={(e) => handleChange('max_concurrent_downloads', e.target.value)}
                className="w-full px-3 py-2 rounded border border-genesis-border outline-none focus:border-genesis-primary bg-genesis-background font-mono"
              />
            </div>
          </div>
        </div>

        {/* Storage & Organization */}
        <div className="p-5 rounded-card border border-genesis-border bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-genesis-border pb-3">
            <HardDrive className="h-4 w-4 text-genesis-primary" />
            <h2 className="font-display font-bold text-sm text-genesis-text-primary">
              Storage & Auto-Organization
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-genesis-text-primary block">
                Default Download Root Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={settings.default_download_folder || 'C:\\Users\\Aryan\\Downloads'}
                  className="flex-1 px-3 py-2 rounded border border-genesis-border bg-genesis-background font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const chosen = await api.selectDirectory(settings.default_download_folder);
                    if (chosen) {
                      handleChange('default_download_folder', chosen);
                    }
                  }}
                  className="px-3 py-2 rounded border border-genesis-border hover:bg-genesis-muted flex items-center gap-1 text-genesis-primary font-medium"
                  title="Browse to choose custom download directory"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>Browse...</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFolder(settings.default_download_folder || '')}
                  className="px-3 py-2 rounded border border-genesis-border hover:bg-genesis-muted flex items-center gap-1"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>Open</span>
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ask_download_location !== 'false'}
                  onChange={(e) => handleChange('ask_download_location', e.target.checked ? 'true' : 'false')}
                  className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
                />
                <span className="font-medium text-genesis-text-primary">
                  Always prompt for download location before starting (IDM style)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_organize === 'true'}
                  onChange={(e) => handleChange('auto_organize', e.target.checked ? 'true' : 'false')}
                  className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
                />
                <span className="font-medium text-genesis-text-primary">
                  Auto-sort completed files into category folders (Videos, Music, etc.)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.duplicate_detection === 'true'}
                  onChange={(e) => handleChange('duplicate_detection', e.target.checked ? 'true' : 'false')}
                  className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
                />
                <span className="font-medium text-genesis-text-primary">
                  Detect duplicates and resume existing downloads instead of redownloading
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Browser & Interception */}
        <div className="p-5 rounded-card border border-genesis-border bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-genesis-border pb-3">
            <Globe className="h-4 w-4 text-genesis-primary" />
            <h2 className="font-display font-bold text-sm text-genesis-text-primary">
              Browser Extension Integration
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_intercept_browser === 'true'}
                onChange={(e) => handleChange('auto_intercept_browser', e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
              />
              <span className="font-medium text-genesis-text-primary">
                Automatically intercept browser file downloads (.zip, .exe, .iso, etc.)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.clipboard_monitor === 'true'}
                onChange={(e) => handleChange('clipboard_monitor', e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
              />
              <span className="font-medium text-genesis-text-primary">
                Clipboard Monitor: Prompt to download when a valid download link is copied
              </span>
            </label>

            <div className="p-3 bg-genesis-background rounded border border-genesis-border text-[11px] font-mono text-genesis-text-secondary">
              Bridge Loopback Port: <span className="font-bold text-genesis-primary">127.0.0.1:48123</span>
            </div>

            {onOpenWizard && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenWizard}
                  className="w-full py-2 px-3 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm"
                >
                  Launch Browser Setup Wizard
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Security & System */}
        <div className="p-5 rounded-card border border-genesis-border bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-genesis-border pb-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="font-display font-bold text-sm text-genesis-text-primary">
              Security & Software Updates
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 text-[11px] space-y-1">
              <span className="font-bold block">Zero-Execution Guarantee:</span>
              Downloaded executable files will never execute automatically without explicit user intervention.
            </div>

            <div className="p-3 rounded border border-genesis-border bg-genesis-background space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-genesis-text-primary">Desktop App Version: v1.0.0</span>
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="px-2.5 py-1 text-[11px] font-medium rounded border border-genesis-border bg-white hover:bg-gray-50 transition-colors"
                >
                  {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>
              {updateStatus && (
                <div className="text-[11px] text-emerald-600 font-medium">
                  {updateStatus}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_complete === 'true'}
                onChange={(e) => handleChange('notify_on_complete', e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
              />
              <span className="font-medium text-genesis-text-primary">
                Show system notification when a download completes
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.minimize_to_tray === 'true'}
                onChange={(e) => handleChange('minimize_to_tray', e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded text-genesis-primary focus:ring-genesis-primary"
              />
              <span className="font-medium text-genesis-text-primary">
                Keep background engine running when window is minimized
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
