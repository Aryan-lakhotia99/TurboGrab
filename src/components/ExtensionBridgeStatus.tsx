import React, { useState } from 'react';
import { Radio, ExternalLink, ChevronUp, ChevronDown, CheckCircle2, Copy } from 'lucide-react';

export const ExtensionBridgeStatus: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPath = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-3 right-6 z-30 select-none">
      <div className="bg-white rounded-panel border border-genesis-border shadow-genesis-flat hover:shadow-genesis-hover transition-all text-xs overflow-hidden">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-genesis-muted/50"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-genesis-text-primary text-[11px]">
            Extension Bridge: 127.0.0.1:48123
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-tag bg-emerald-50 text-emerald-600 border border-emerald-200">
            ONLINE
          </span>
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-genesis-text-secondary" /> : <ChevronUp className="h-3.5 w-3.5 text-genesis-text-secondary" />}
        </div>

        {isOpen && (
          <div className="p-3 border-t border-genesis-border bg-genesis-background space-y-2 max-w-sm">
            <p className="text-[11px] text-genesis-text-secondary leading-normal">
              TurboGrab core engine is broadcasting on loopback WebSocket port <code className="font-mono text-genesis-primary">48123</code> and Native Messaging host.
            </p>
            <div className="space-y-1 text-[11px] font-mono text-genesis-text-primary bg-white p-2 rounded-btn border border-genesis-border">
              <div className="flex items-center justify-between">
                <span>To load in Chrome/Brave/Edge:</span>
                <button onClick={copyPath} className="text-genesis-primary hover:underline text-[10px] flex items-center gap-1">
                  <Copy className="h-2.5 w-2.5" />
                  <span>{copied ? 'Copied' : 'chrome://extensions'}</span>
                </button>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-genesis-text-secondary text-[10px]">
                <li>Enable "Developer mode"</li>
                <li>Click "Load unpacked"</li>
                <li>Select the <code className="text-genesis-primary">extension</code> folder</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
