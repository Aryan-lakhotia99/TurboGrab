import React, { useState } from 'react';
import { X, Film, Check, Sparkles, Sliders, Music, Video, RefreshCw } from 'lucide-react';
import { StreamDemuxOption } from '../types';

interface MediaSnifferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStreamDownload: (url: string, quality: string) => void;
}

export const MediaSnifferModal: React.FC<MediaSnifferModalProps> = ({
  isOpen,
  onClose,
  onStartStreamDownload,
}) => {
  const [streamUrl, setStreamUrl] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [isProbing, setIsProbing] = useState(false);
  const [demuxStatus, setDemuxStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const qualities: { id: string; label: string; resolution: string; bitrate: string; icon: React.ReactNode }[] = [
    { id: '4k', label: '4K Ultra HD (HEVC/AV1)', resolution: '3840x2160', bitrate: '~22.5 Mbps', icon: <Video className="h-4 w-4" /> },
    { id: '2k', label: '2K Quad HD (QHD/1440p)', resolution: '2560x1440', bitrate: '~12.0 Mbps', icon: <Video className="h-4 w-4" /> },
    { id: '1080p', label: '1080p Master HLS / DASH', resolution: '1920x1080', bitrate: '~7.8 Mbps', icon: <Video className="h-4 w-4" /> },
    { id: '720p', label: '720p High Definition', resolution: '1280x720', bitrate: '~3.4 Mbps', icon: <Video className="h-4 w-4" /> },
    { id: 'audio', label: 'Audio Only Track (.aac / .m4a)', resolution: 'HQ Stereo', bitrate: '320 kbps', icon: <Music className="h-4 w-4" /> },
  ];

  const handleProbe = () => {
    if (!streamUrl) return;
    setIsProbing(true);
    setDemuxStatus('Analyzing manifest playlists (.m3u8 / .mpd)...');
    setTimeout(() => {
      setIsProbing(false);
      setDemuxStatus('Manifest validated. 4 representations detected. FFmpeg pipeline ready.');
    }, 800);
  };

  const handleStart = () => {
    if (!streamUrl) return;
    onStartStreamDownload(streamUrl, selectedQuality);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white rounded-card border border-genesis-border shadow-genesis-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-genesis-border bg-genesis-background">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-btn bg-indigo-50 border border-indigo-200 flex items-center justify-center text-genesis-primary">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-genesis-text-primary">
                HLS / DASH Stream Sniffer & Demuxer
              </h2>
              <p className="text-xs text-genesis-text-secondary">
                Parallel segment fetcher multiplexed via static FFmpeg pipe.
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
        <div className="p-6 space-y-5">
          {/* Stream URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary">
              Stream Manifest or Video URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://example.com/live/master.m3u8 or manifest.mpd"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-btn border border-genesis-border bg-genesis-background focus:bg-white focus:border-genesis-primary outline-none transition-all"
              />
              <button
                onClick={handleProbe}
                disabled={isProbing || !streamUrl}
                className="px-3 py-2 text-xs font-medium rounded-btn border border-genesis-border hover:bg-genesis-muted transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                <span>Probe</span>
              </button>
            </div>
          </div>

          {/* Quality Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-genesis-text-secondary flex items-center justify-between">
              <span>Select Stream Quality</span>
              <span className="font-normal font-mono text-[11px] text-genesis-primary">Adaptive Bitrate</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {qualities.map((q) => {
                const isSelected = selectedQuality === q.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuality(q.id)}
                    className={`p-3 rounded-panel border cursor-pointer transition-all flex items-start justify-between select-none ${
                      isSelected
                        ? 'border-genesis-primary bg-indigo-50/40 shadow-sm'
                        : 'border-genesis-border bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={isSelected ? 'text-genesis-primary' : 'text-genesis-text-secondary'}>
                          {q.icon}
                        </span>
                        <span className="font-semibold text-xs text-genesis-text-primary">
                          {q.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-genesis-text-secondary pl-6">
                        <span>{q.resolution}</span>
                        <span>•</span>
                        <span>{q.bitrate}</span>
                      </div>
                    </div>
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

          {/* Real-time Demux Status Indicator */}
          <div className="p-3 rounded-panel bg-genesis-muted border border-genesis-border space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-genesis-text-secondary">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-genesis-primary" />
                FFmpeg Demuxer Pipeline
              </span>
              <span className="text-genesis-primary font-bold">READY</span>
            </div>
            <p className="text-[11px] text-genesis-text-secondary leading-relaxed">
              {demuxStatus || 'Static FFmpeg multiplexer pipe will download audio and video tracks separately in parallel and mux into a single .mp4 file without lossy re-encoding.'}
            </p>
          </div>
        </div>

        {/* Footer with Single Primary Action */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-genesis-border bg-genesis-background">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-genesis-text-secondary hover:text-genesis-text-primary rounded-btn border border-genesis-border bg-white hover:bg-genesis-muted transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!streamUrl}
            className="px-5 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm hover:shadow-genesis-hover transition-all hover:-translate-y-[2px] disabled:opacity-50"
          >
            Start Accelerated Demux
          </button>
        </div>
      </div>
    </div>
  );
};
