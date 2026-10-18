import { useEffect, useState } from "react";
import type { BinaryInfo } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { ChevronDownIcon } from "../../components/icons/ui";
import { SettingRow, SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

export function AboutSection({
  appVersion,
  updateStatus,
  onCheckForUpdates,
  isElectron,
  t,
}: SectionProps) {
  const busy = updateStatus.state === "checking" || updateStatus.state === "downloading";

  return (
    <>
      <SettingsGroup>
        <SettingRow
          id="updates"
          label={t.settings.updatesTitle}
          hint={
            <>
              BisHub — {t.settings.churchDisplayApp} ·{" "}
              <span className="font-mono text-gray-300">v{appVersion}</span>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            {isElectron && (
              <button
                type="button"
                onClick={onCheckForUpdates}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {updateStatus.state === "checking"
                  ? t.updates.checkingForUpdates
                  : updateStatus.state === "downloading"
                    ? `${t.updates.updateDownloading} ${updateStatus.progress || 0}%`
                    : t.updates.checkForUpdates}
              </button>
            )}
            {updateStatus.state === "idle" && (
              <span className="text-sm text-green-400">{t.updates.upToDate}</span>
            )}
            {updateStatus.state === "available" && (
              <span className="text-sm text-yellow-400">
                {t.updates.newVersion}: v{updateStatus.version}
              </span>
            )}
            {updateStatus.state === "ready" && (
              <span className="text-sm text-green-400">
                {t.updates.updateReady}: v{updateStatus.version}
              </span>
            )}
            {updateStatus.state === "error" && (
              <span className="text-sm text-red-400">{updateStatus.error}</span>
            )}
          </div>
        </SettingRow>
      </SettingsGroup>

      {isElectron && <TechnicalDetails t={t} />}
    </>
  );
}

/** Tucked away by default: only useful when something isn't working. */
function TechnicalDetails({ t }: { t: Translations }) {
  const [binaryInfo, setBinaryInfo] = useState<BinaryInfo[] | null>(null);

  useEffect(() => {
    window.electronAPI?.getBinaryInfo?.().then(setBinaryInfo);
  }, []);

  const sourceLabels = {
    ota: t.diagnostics.sourceOta,
    bundled: t.diagnostics.sourceBundled,
    system: t.diagnostics.sourceSystem,
  };

  return (
    <details className="group bg-gray-800/50 border border-gray-700/50 rounded-xl">
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none px-4 sm:px-6 py-3 text-sm text-gray-400 hover:text-gray-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        {t.settings.technicalDetails}
        <ChevronDownIcon className="w-4 h-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 sm:px-6 pb-4">
        <div className="text-sm text-gray-300 mb-2">{t.diagnostics.bundledBinaries}</div>
        <div className="space-y-1.5">
          {binaryInfo === null
            ? ["yt-dlp", "qjs", "ffmpeg", "ffprobe"].map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-xs font-mono gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-600 animate-pulse"
                      aria-hidden
                    />
                    <span className="text-gray-300">{name}</span>
                  </span>
                  <span
                    className="inline-block h-3 w-28 rounded bg-gray-700/60 animate-pulse"
                    aria-hidden
                  />
                </div>
              ))
            : binaryInfo.map((bin) => {
                const sourceLabel = bin.source ? sourceLabels[bin.source] : null;
                return (
                  <div
                    key={bin.name}
                    className="flex items-center justify-between text-xs font-mono gap-2"
                    title={bin.path ?? undefined}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          bin.available ? "bg-green-400" : "bg-red-400"
                        }`}
                        aria-hidden
                      />
                      <span className="text-gray-300">{bin.name}</span>
                    </span>
                    <span className="flex items-center gap-2 text-gray-500 min-w-0 truncate">
                      {bin.available ? (
                        <>
                          <span className="text-gray-400 truncate">
                            {bin.version || t.diagnostics.unknownVersion}
                          </span>
                          {sourceLabel && (
                            <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] uppercase tracking-wide flex-shrink-0">
                              {sourceLabel}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-400">{t.diagnostics.notFound}</span>
                      )}
                    </span>
                  </div>
                );
              })}
        </div>
      </div>
    </details>
  );
}
