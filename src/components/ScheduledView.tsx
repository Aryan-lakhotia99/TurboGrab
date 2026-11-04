import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Clock, Play, Bell } from 'lucide-react';
import { ScheduledTask } from '../types';
import { api } from '../services/api';

interface ScheduledViewProps {
  onOpenScheduleModal: () => void;
  isDark: boolean;
}

export const ScheduledView: React.FC<ScheduledViewProps> = ({ onOpenScheduleModal, isDark }) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);

  const fetchTasks = async () => {
    try {
      const list = await api.getScheduledTasks();
      setTasks(list);
    } catch (e) {
      console.warn('Error fetching scheduled tasks:', e);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: string) => {
    await api.deleteScheduledTask(id);
    fetchTasks();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-genesis-background p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-btn bg-genesis-primary/10 border border-genesis-primary/20 flex items-center justify-center text-genesis-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-genesis-text-primary">
              Scheduled Download Queue
            </h1>
            <p className="text-xs text-genesis-text-secondary">
              Automated transfers scheduled to execute at future timestamps.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenScheduleModal}
          className="px-4 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm transition-all"
        >
          + Add Schedule
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-card border border-genesis-border overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-genesis-background border-b border-genesis-border font-semibold text-genesis-text-secondary select-none">
              <tr>
                <th className="px-4 py-3">Filename / Target</th>
                <th className="px-4 py-3">Scheduled Time</th>
                <th className="px-4 py-3">Post-Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Cancel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-genesis-border">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-genesis-text-secondary">
                    No active scheduled download tasks. Click "+ Add Schedule" to set up a timed download.
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-genesis-background/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-genesis-text-primary max-w-xs truncate">
                      {t.filename || t.download_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-genesis-primary font-semibold">
                      {new Date(t.scheduled_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {t.action_on_complete === 'notify' ? 'Show Notification' : 'None'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded-tag bg-amber-50 text-amber-700 border border-amber-200">
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-all"
                        title="Cancel Schedule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
