import React, { useState } from 'react';
import { X, Calendar, Clock, Bell, Power, Moon } from 'lucide-react';
import { DownloadItem, ScheduledTask } from '../types';
import { api } from '../services/api';

interface ScheduleDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloads: DownloadItem[];
  onScheduled: () => void;
}

export const ScheduleDownloadModal: React.FC<ScheduleDownloadModalProps> = ({
  isOpen,
  onClose,
  downloads,
  onScheduled,
}) => {
  const [selectedDownloadId, setSelectedDownloadId] = useState(downloads[0]?.id || '');
  const [scheduleTime, setScheduleTime] = useState('');
  const [actionOnComplete, setActionOnComplete] = useState<'notify' | 'shutdown' | 'sleep' | 'none'>('notify');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDownloadId || !scheduleTime) return;

    const timestamp = new Date(scheduleTime).getTime();
    if (isNaN(timestamp) || timestamp <= Date.now()) {
      alert('Please select a future time for the download schedule.');
      return;
    }

    const task: ScheduledTask = {
      id: 'sched_' + Date.now(),
      download_id: selectedDownloadId,
      scheduled_time: timestamp,
      action_on_complete: actionOnComplete,
      status: 'pending',
      created_at: Date.now()
    };

    await api.addScheduledTask(task);
    onScheduled();
    onClose();
  };

  const pausedOrQueued = downloads.filter(d => d.status === 'paused' || d.status === 'queued');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-card border border-genesis-border shadow-genesis-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-genesis-border bg-genesis-background">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-btn bg-genesis-primary flex items-center justify-center text-white">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-genesis-text-primary">
                Schedule Download Task
              </h2>
              <p className="text-xs text-genesis-text-secondary">
                Set exact start times and post-transfer automation rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-btn text-genesis-text-secondary hover:text-genesis-text-primary hover:bg-genesis-muted transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
              Select Paused or Queued Download
            </label>
            {pausedOrQueued.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs">
                No paused or queued downloads found. Please add or pause a download first.
              </div>
            ) : (
              <select
                required
                value={selectedDownloadId}
                onChange={(e) => setSelectedDownloadId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border border-genesis-border bg-genesis-background outline-none focus:border-genesis-primary"
              >
                {pausedOrQueued.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
              Scheduled Start Date & Time
            </label>
            <input
              required
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded border border-genesis-border bg-genesis-background outline-none focus:border-genesis-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
              Action After Download Finishes
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={() => setActionOnComplete('notify')}
                className={`p-2.5 rounded border text-xs cursor-pointer flex items-center gap-2 ${
                  actionOnComplete === 'notify' ? 'border-genesis-primary bg-indigo-50/50 font-semibold' : 'border-genesis-border'
                }`}
              >
                <Bell className="h-4 w-4 text-genesis-primary" />
                <span>Show Notification</span>
              </label>

              <label
                onClick={() => setActionOnComplete('none')}
                className={`p-2.5 rounded border text-xs cursor-pointer flex items-center gap-2 ${
                  actionOnComplete === 'none' ? 'border-genesis-primary bg-indigo-50/50 font-semibold' : 'border-genesis-border'
                }`}
              >
                <Clock className="h-4 w-4 text-gray-500" />
                <span>Do Nothing</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-genesis-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-genesis-text-secondary hover:text-genesis-text-primary rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pausedOrQueued.length === 0}
              className="px-5 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm transition-all disabled:opacity-50"
            >
              Confirm Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
