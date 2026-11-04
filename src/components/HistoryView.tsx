import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Download,
  Trash2,
  FileCode,
  FolderOpen,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { HistoryItem } from '../types';
import { api } from '../services/api';

interface HistoryViewProps {
  onReDownload: (url: string) => void;
  onOpenFolder: (path: string) => void;
  isDark: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onReDownload,
  onOpenFolder,
  isDark,
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const items = await api.getHistory(search, category);
      setHistory(items);
    } catch (e) {
      console.warn('Error fetching history:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [search, category]);

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear your download history log? Downloaded files on disk will NOT be deleted.')) {
      await api.clearHistory();
      fetchHistory();
    }
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `turbograb_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-genesis-background p-6 space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-btn bg-genesis-primary/10 border border-genesis-primary/20 flex items-center justify-center text-genesis-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-genesis-text-primary">
              Download History
            </h1>
            <p className="text-xs text-genesis-text-secondary">
              Locally persisted records of all completed transfers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs font-medium rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted transition-all shadow-sm"
          >
            Export JSON
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs font-medium text-rose-600 rounded-btn border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all shadow-sm flex items-center gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-genesis-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history by filename or URL..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-btn border border-genesis-border bg-white focus:border-genesis-primary outline-none transition-all shadow-sm"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-btn border border-genesis-border bg-white focus:border-genesis-primary outline-none transition-all shadow-sm font-medium"
        >
          <option value="all">All Categories</option>
          <option value="Videos">Videos</option>
          <option value="Music">Music</option>
          <option value="Documents">Documents</option>
          <option value="Compressed Files">Compressed</option>
          <option value="Programs">Programs</option>
          <option value="Images">Images</option>
          <option value="Other Files">Other</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-card border border-genesis-border overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-genesis-background border-b border-genesis-border font-semibold text-genesis-text-secondary select-none">
              <tr>
                <th className="px-4 py-3">Filename</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Date Completed</th>
                <th className="px-4 py-3">SHA-256 Checksum</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-genesis-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-genesis-text-secondary">
                    {loading ? 'Loading history...' : 'No download history records found.'}
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-genesis-background/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-genesis-text-primary max-w-xs truncate" title={item.filename}>
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-genesis-primary shrink-0" />
                        <span className="truncate">{item.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-genesis-text-secondary">
                      {item.category || 'Other'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {formatBytes(item.file_size)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-genesis-text-secondary">
                      {new Date(item.completed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-genesis-text-secondary max-w-[140px] truncate" title={item.checksum_sha256 || 'N/A'}>
                      {item.checksum_sha256 || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenFolder(item.destination_path)}
                          title="Open Containing Folder"
                          className="p-1.5 rounded hover:bg-genesis-muted text-genesis-text-secondary hover:text-genesis-text-primary"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onReDownload(item.url)}
                          title="Download Again"
                          className="p-1.5 rounded hover:bg-genesis-muted text-genesis-primary"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
