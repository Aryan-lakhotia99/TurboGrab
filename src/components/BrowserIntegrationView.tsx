import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DetectedBrowser } from '../types';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Zap,
  Terminal,
  Layers,
  Sparkles,
  Compass
} from 'lucide-react';

interface BrowserIntegrationViewProps {
  isDark?: boolean;
  onOpenWizard?: () => void;
}

export const BrowserIntegrationView: React.FC<BrowserIntegrationViewProps> = ({ isDark = false, onOpenWizard }) => {
  const [browsers, setBrowsers] = useState<DetectedBrowser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [registerStatus, setRegisterStatus] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  const fetchBrowsers = async () => {
    setIsLoading(true);
    try {
      const detected = await api.detectBrowsers();
      setBrowsers(detected);
    } catch (err: any) {
      console.error('Error detecting browsers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrowsers();
  }, []);

  const handleRegisterNativeHost = async () => {
    setRegisterStatus('Registering Windows Registry Native Host keys...');
    try {
      const results = await api.registerNativeHost();
      const allOk = results.every((r: any) => r.success);
      if (allOk) {
        setRegisterStatus('Native Messaging Host successfully registered for all supported browsers!');
      } else {
        setRegisterStatus('Registration partially completed. Check admin permissions.');
      }
      fetchBrowsers();
    } catch (err: any) {
      setRegisterStatus(`Registration failed: ${err.message}`);
    }
    setTimeout(() => setRegisterStatus(null), 5000);
  };

  const handleLaunchBrowser = async (b: DetectedBrowser) => {
    setActiveMessage(`Launching ${b.name} with TurboGrab extension...`);
    try {
      await api.launchBrowserExtension(b.id);
    } catch (_) {}
    setTimeout(() => setActiveMessage(null), 3000);
  };

  const handleOpenStore = async (b: DetectedBrowser) => {
    await api.openExternalUrl(b.storeUrl);
  };

  return (
    <div className={`flex-1 overflow-y-auto px-8 py-6 space-y-6 ${
      isDark ? 'bg-gray-950 text-gray-100' : 'bg-[#FAFAFB] text-gray-900'
    }`}>
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Browser Integration Hub</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
              <Compass size={13} />
              Multi-Browser Native Onboarding
            </span>
          </div>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Manage browser extensions, Native Messaging Host registration, and direct browser acceleration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenWizard && (
            <button
              onClick={onOpenWizard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
            >
              <Sparkles size={13} />
              Setup Wizard
            </button>
          )}
          <button
            onClick={fetchBrowsers}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isDark ? 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Scan Browsers
          </button>
          <button
            onClick={handleRegisterNativeHost}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isDark ? 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <ShieldCheck size={14} className="text-emerald-500" />
            Register Native Host
          </button>
        </div>
      </div>

      {/* Notifications / Toast Banner */}
      {registerStatus && (
        <div className="p-3.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{registerStatus}</span>
        </div>
      )}

      {activeMessage && (
        <div className="p-3.5 rounded-xl text-xs font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-2">
          <Zap size={16} className="animate-pulse" />
          <span>{activeMessage}</span>
        </div>
      )}

      {/* Quick Setup Explanation Card */}
      <div className={`p-5 rounded-xl border ${
        isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <h2 className="text-sm font-bold flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-indigo-500" />
          Seamless Integrated Browser Experience
        </h2>
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">1. Install Desktop App</span>
            Install TurboGrab once on Windows, macOS, or Linux. The engine runs locally with multi-range acceleration and FFmpeg support.
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">2. Register Native Host</span>
            Registers the Native Messaging Host manifest so browsers recognize the local download manager seamlessly.
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">3. Integrate Extension</span>
            Click "Launch with Extension" below or load the extension in your browser to start intercepting streams.
          </div>
        </div>
      </div>

      {/* Detected Browsers Table */}
      <div className={`rounded-xl border overflow-hidden ${
        isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-sm">Detected System Browsers</h3>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {browsers.filter(b => b.isInstalled).length} of {browsers.length} Installed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`text-[11px] uppercase font-bold tracking-wider ${
              isDark ? 'bg-gray-800/60 text-gray-400' : 'bg-gray-50 text-gray-500'
            }`}>
              <tr>
                <th className="py-3 px-4">Browser</th>
                <th className="py-3 px-4">Installation Status</th>
                <th className="py-3 px-4">Native Host Registration</th>
                <th className="py-3 px-4">Bridge Port</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {browsers.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                        <Globe size={15} />
                      </div>
                      <div>
                        <span className="font-bold block">{b.name}</span>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {b.type === 'chromium' ? 'Chromium Manifest V3' : 'Gecko WebExtensions'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {b.isInstalled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <CheckCircle2 size={12} />
                        Installed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500">
                        <AlertCircle size={12} />
                        Not Detected
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {b.isHostRegistered ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                        <ShieldCheck size={12} />
                        Registered (com.turbograb.host)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <AlertCircle size={12} />
                        Pending Registration
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      127.0.0.1:48123
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {b.isInstalled ? (
                        <>
                          <button
                            onClick={() => handleLaunchBrowser(b)}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm"
                            title="Directly launch browser with extension loaded"
                          >
                            Launch With Extension
                          </button>
                          <button
                            onClick={() => handleOpenStore(b)}
                            className={`p-1.5 rounded border transition-colors ${
                              isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                            }`}
                            title="Open Web Store Add-ons page"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenStore(b)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-400' : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          Get Browser
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Loading / Developer Mode Instructions Card */}
      <div className={`p-5 rounded-xl border ${
        isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
          <Terminal size={15} className="text-indigo-500" />
          Extension Folder & Direct Integration
        </h3>
        <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          The browser extension is ready in the project directory. You can load it unpacked directly in any Chromium or Firefox browser:
        </p>

        <div className={`p-3 rounded-lg font-mono text-xs mb-3 select-all ${
          isDark ? 'bg-gray-950 border border-gray-800 text-indigo-400' : 'bg-gray-50 border border-gray-200 text-indigo-600'
        }`}>
          {typeof window !== 'undefined' ? `${window.location.origin}/extension` : 'C:\\Users\\Aryan\\Desktop\\projectttt\\extension'}
        </div>

        <ol className={`list-decimal list-inside text-xs space-y-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <li>Open your browser and navigate to <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">chrome://extensions</code> or <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">edge://extensions</code></li>
          <li>Enable <strong>Developer mode</strong> (toggle switch in the top right corner)</li>
          <li>Click <strong>Load unpacked</strong> and select the <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">extension</code> folder</li>
          <li>The <strong>TurboGrab Grab-Chip</strong> and toolbar icon will immediately activate and connect to port 48123</li>
        </ol>
      </div>
    </div>
  );
};
