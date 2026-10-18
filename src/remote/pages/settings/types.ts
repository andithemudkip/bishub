import type {
  MonitorInfo,
  AppSettings,
  IdleState,
  ClockPosition,
  AudioWidgetPosition,
  UpdateStatus,
  MP3CacheStats,
  MP3DownloadProgress,
  DeviceInfo,
  ChromeSizeKey,
} from "../../../shared/types";
import type { Language, Translations } from "../../../shared/i18n";
import type { HymnalInfo } from "../../../shared/hymnals";
import type { SettingsSectionId } from "./settingsIndex";

export interface BibleDownloadStatus {
  translationId: string;
  status: "downloading" | "ready" | "error";
  progress?: number;
  error?: string;
}

export interface SettingsPageProps {
  /** The merged book list, which grows when the user creates a book. */
  hymnals: HymnalInfo[];
  monitors: MonitorInfo[];
  settings: AppSettings;
  idleState: IdleState;
  onSetLanguage: (language: Language) => void;
  onSetBibleTranslation: (translationId: string) => void;
  onSetHymnal: (slug: string) => void;
  bibleDownloadStatus: BibleDownloadStatus | null;
  downloadedTranslations: string[];
  onSetWallpaper: (selectNew?: boolean) => Promise<string | null>;
  onSetClockFontSize: (size: number) => void;
  onSetClockPosition: (position: ClockPosition) => void;
  onSetAudioWidgetPosition: (position: AudioWidgetPosition) => void;
  onSetSyncedLyrics: (enabled: boolean) => void;
  onSetInstrumentals: (enabled: boolean) => void;
  onSetChromeSize: (key: ChromeSizeKey, size: number) => void;
  onSetSlideBackground: (from: string, to: string) => void;
  onSetBibleBackground: (enabled: boolean, from: string, to: string) => void;
  onSetDisplayMonitor: (monitorId: number) => void;
  appVersion: string;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => void;
  mp3CacheStats: MP3CacheStats;
  mp3Downloads: MP3DownloadProgress[];
  onDownloadAllHymnMP3s: () => void;
  onCancelAllHymnMP3Downloads: () => void;
  onClearHymnMP3Cache: () => void;
  devices: DeviceInfo[];
  connectedDeviceIds: string[];
  onRenameDevice: (deviceId: string, name: string) => void;
  onRevokeDevice: (deviceId: string) => void;
}

/** What every section gets: the page's props plus the shared bits it derives. */
export interface SectionProps extends SettingsPageProps {
  t: Translations;
  isElectron: boolean;
  /** Jump to another section (and optionally one row in it). */
  onOpenSection: (section: SettingsSectionId, settingId?: string) => void;
}
