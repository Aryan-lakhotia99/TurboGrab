import React, { useState } from 'react';
import { X, Gauge, Check } from 'lucide-react';

interface SpeedLimiterModalProps {
  isOpen: boolean;
  currentLimitBps: number;
  onClose: () => void;
  onSaveLimit: (limitBps: number) => void;
}

export const SpeedLimiterModal: React.FC<SpeedLimiterModalProps> = ({
  isOpen,
  currentLimitBps,
  onClose,
  onSaveLimit,
}) => {
  const [selectedMb, setSelectedMb] = useState<number>(
    currentLimitBps > 0 ? Math.round(currentLimitBps / (1024 * 1024)) : 0
  );

  if (!isOpen) return null;

  const presets = [
    { label: 'Unlimited (Max Speed)', value: 0 },
    { label: '5 MB/s (Low impact)', value: 5 },
    { label: '10 MB/s (Standard)', value: 10 },
    { label: '25 MB/s (High)', value: 25 },
    { label: '50 MB/s (Ultra)', value: 50 },
  ];

  const handleSave = () => {
    onSaveLimit(selectedMb * 1024 * 1024);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-card border border-genesis-border shadow-genesis-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-genesis-border bg-genesis-background">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-btn bg-genesis-primary flex items-center justify-center text-white">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-genesis-text-primary">
                Bandwidth Throttle Limiter
              </h2>
              <p className="text-xs text-genesis-text-secondary">
                Cap network throughput across all active segment threads.
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

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {presets.map((p) => {
              const isSelected = selectedMb === p.value;
              return (
                <div
                  key={p.value}
                  onClick={() => setSelectedMb(p.value)}
                  className={`p-3 rounded-panel border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-genesis-primary bg-indigo-50/50 shadow-sm'
                      : 'border-genesis-border bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-xs text-genesis-text-primary">
                    {p.label}
                  </span>
                  {isSelected && (
                    <span className="h-4 w-4 rounded-full bg-genesis-primary text-white flex items-center justify-center text-[10px]">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-genesis-border bg-genesis-background">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-genesis-text-secondary hover:text-genesis-text-primary rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm hover:shadow-genesis-hover transition-all hover:-translate-y-[2px]"
          >
            Apply Speed Limit
          </button>
        </div>
      </div>
    </div>
  );
};
