import { useEffect, useRef, useState } from "react";
import type { Translations } from "../../../shared/i18n";

interface Props {
  serverPort: number;
  connectedDeviceCount: number;
  t: Translations;
}

/**
 * The address phones connect to — asked for constantly, otherwise buried in
 * Settings — and how many remotes are connected right now.
 */
export function StageFooter({ serverPort, connectedDeviceCount, t }: Props) {
  const isElectron = !!window.electronAPI;
  const [localIP, setLocalIP] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isElectron) window.electronAPI!.getLocalIP().then(setLocalIP);
  }, [isElectron]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // A web remote already reached the server at this address.
  const address = isElectron
    ? localIP && `${localIP}:${serverPort}`
    : window.location.host;

  const copy = async () => {
    if (!address) return;
    try {
      // Unavailable over plain http on a phone (not a secure context).
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Leave the address selectable instead.
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 px-1 text-xs text-gray-500">
      {address ? (
        <button
          onClick={copy}
          className="min-w-0 truncate font-mono select-all hover:text-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title={t.stage.copyAddress}
        >
          {copied ? t.stage.copied : address}
        </button>
      ) : (
        <span />
      )}
      <span className="whitespace-nowrap">
        {t.stage.devices.replace("{n}", String(connectedDeviceCount))}
      </span>
    </div>
  );
}
