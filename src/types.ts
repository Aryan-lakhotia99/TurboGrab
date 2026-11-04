export type TaskStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'demuxing' | 'error' | 'scheduled';

export type SidebarView =
  | 'dashboard'
  | 'all'
  | 'active'
  | 'queued'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'scheduled'
  | 'video'
  | 'categories'
  | 'history'
  | 'analytics'
  | 'settings'
  | 'browser-integration';

export interface DetectedBrowser {
  id: string;
  name: string;
  type: 'chromium' | 'gecko';
  isInstalled: boolean;
  executablePath: string | null;
  isHostRegistered: boolean;
  storeUrl: string;
}

export interface SegmentState {
  id: number;
  start_byte: number;
  end_byte: number;
  current_offset: number;
  speed_bps: number;
  active_worker_id: number | null;
  is_completed: boolean;
}

export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  destination_path: string;
  total_bytes: number;
  downloaded_bytes: number;
  speed_bps: number;
  eta_seconds: number;
  status: TaskStatus;
  category?: string;
  is_stream: boolean;
  connections?: number;
  mode?: 'normal' | 'high_speed' | 'smart';
  etag?: string | null;
  last_modified?: string | null;
  checksum_sha256?: string | null;
  verified_hash?: string | null;
  retry_count?: number;
  error_message?: string | null;
  segments: SegmentState[];
  cookies?: string;
  referrer?: string;
  user_agent?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number | null;
}

export interface EngineStats {
  global_speed_bps: number;
  active_downloads: number;
  total_downloads: number;
  speed_limit_bps: number;
}

export interface StreamDemuxOption {
  quality: string;
  resolution: string;
  bandwidth: number;
  video_url?: string;
  audio_url?: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  filename: string;
  destination_path: string;
  file_size: number;
  category: string;
  status: string;
  completed_at: number;
  checksum_sha256?: string | null;
}

export interface CategoryItem {
  id: string;
  name: string;
  extensions: string[];
  destination_folder: string;
  is_custom: boolean;
}

export interface ScheduledTask {
  id: string;
  download_id: string;
  filename?: string;
  url?: string;
  total_bytes?: number;
  destination_path?: string;
  scheduled_time: number;
  stop_time?: number | null;
  action_on_complete: 'notify' | 'shutdown' | 'sleep' | 'none';
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  created_at: number;
}

export interface SystemInfo {
  platform: 'win32' | 'darwin' | 'linux' | string;
  osName: string;
  osRelease: string;
  arch: string;
  hostname: string;
  homeDir: string;
  nodeVersion: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes: string;
  releaseDate: string;
}

export interface AnalyticsData {
  totalDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
  totalBytes: number;
  categoryBreakdown: { category: string; count: number; bytes: number }[];
  historyItems: { completed_at: number; file_size: number }[];
}
