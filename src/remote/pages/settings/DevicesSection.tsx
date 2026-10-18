import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { DeviceInfo } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { buildRemoteURL, formatTimeAgo } from "../../../shared/utils";
import { renderTip } from "../../components/ui/renderTip";
import { SettingRow, SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

/** Electron-only: the address, key and paired devices live on the main computer. */
export function DevicesSection({
  settings,
  devices,
  connectedDeviceIds,
  onRenameDevice,
  onRevokeDevice,
  t,
}: SectionProps) {
  const [localIP, setLocalIP] = useState("...");
  const [securityKey, setSecurityKey] = useState("...");

  useEffect(() => {
    window.electronAPI?.getLocalIP().then(setLocalIP);
    window.electronAPI?.getSecurityKey().then(setSecurityKey);
  }, []);

  const remoteURL = buildRemoteURL(localIP, settings.serverPort, securityKey);

  return (
    <>
      <SettingsGroup tip={renderTip(t.settings.mobileRemoteTip)}>
        <SettingRow id="connectPhone" label={t.settings.connectPhoneTitle} hint={t.settings.sameWifi}>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="bg-white p-3 rounded-lg flex-shrink-0">
              <QRCodeSVG value={remoteURL} size={160} />
            </div>
            <div className="min-w-0 space-y-4 text-center sm:text-left">
              <div>
                <div className="text-sm text-gray-400 mb-1">{t.settings.scanOrVisit}</div>
                <div className="font-mono text-sm text-blue-400 break-all">{remoteURL}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">{t.settings.securityKey}</div>
                <div className="font-mono text-2xl font-bold text-green-400 tracking-widest">
                  {securityKey}
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.settings.securityKeyHint}</p>
              </div>
            </div>
          </div>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow id="devices" label={t.devices.sectionTitle} hint={t.settings.devicesHint}>
          {devices.length === 0 ? (
            <p className="text-sm text-gray-500">{t.devices.empty}</p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  online={connectedDeviceIds.includes(device.id)}
                  onRename={(name) => onRenameDevice(device.id, name)}
                  onRevoke={() => onRevokeDevice(device.id)}
                  t={t}
                />
              ))}
            </div>
          )}
        </SettingRow>
      </SettingsGroup>
    </>
  );
}

function DeviceRow({
  device,
  online,
  onRename,
  onRevoke,
  t,
}: {
  device: DeviceInfo;
  online: boolean;
  onRename: (name: string) => void;
  onRevoke: () => void;
  t: Translations;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(device.name);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    setDraft(device.name);
  }, [device.name]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== device.name) {
      onRename(trimmed);
    } else {
      setDraft(device.name);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 flex items-center gap-3">
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
          online ? "bg-green-400" : "bg-gray-500"
        }`}
        aria-label={online ? t.devices.online : t.devices.offline}
        title={online ? t.devices.online : t.devices.offline}
      />
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(device.name);
                setEditing(false);
              }
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left w-full truncate text-white hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            title={t.devices.renameHint}
          >
            {device.name}
          </button>
        )}
        <div className="text-xs text-gray-500 mt-0.5">
          {t.devices.lastSeen} {formatTimeAgo(device.lastSeenAt, t.common)}
        </div>
      </div>
      {confirmRevoke ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-300 hidden sm:inline">{t.devices.revokeConfirm}</span>
          <button
            type="button"
            onClick={() => {
              setConfirmRevoke(false);
              onRevoke();
            }}
            className="px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40"
          >
            {t.devices.revoke}
          </button>
          <button
            type="button"
            onClick={() => setConfirmRevoke(false)}
            className="px-2 py-1 rounded bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40"
          >
            {t.devices.revokeCancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmRevoke(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 flex-shrink-0"
        >
          {t.devices.revoke}
        </button>
      )}
    </div>
  );
}
