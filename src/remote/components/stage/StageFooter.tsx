import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Translations } from "../../../shared/i18n";
import { buildRemoteURL } from "../../../shared/utils";
import { CloseIcon, PhoneIcon, QrCodeIcon } from "../icons/ui";

const STORAGE_KEY_QR_HIDDEN = "stage-phone-qr-hidden";

interface Props {
  serverPort: number;
  connectedDeviceCount: number;
  t: Translations;
}

/**
 * The address phones connect to — asked for constantly, otherwise buried in
 * Settings — and how many remotes are connected right now. In the app it also
 * shows the pairing QR, so people find the phone remote without digging
 * through Settings; it stays until the operator hides it.
 */
export function StageFooter({ serverPort, connectedDeviceCount, t }: Props) {
  const isElectron = !!window.electronAPI;
  const [localIP, setLocalIP] = useState<string | null>(null);
  const [pairingKey, setPairingKey] = useState<string | null>(null);
  const [qrHidden, setQrHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_QR_HIDDEN) === "true";
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI!.getLocalIP().then(setLocalIP);
    window.electronAPI!.getSecurityKey().then(setPairingKey);
  }, [isElectron]);

  const setQrHiddenPersisted = (hidden: boolean) => {
    setQrHidden(hidden);
    try {
      localStorage.setItem(STORAGE_KEY_QR_HIDDEN, String(hidden));
    } catch {
      // Private mode / blocked storage: the choice just won't persist.
    }
  };

  // Web remotes are already connected, and a phone is no place for it.
  const qrURL =
    isElectron && localIP && pairingKey
      ? buildRemoteURL(localIP, serverPort, pairingKey)
      : null;

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

  const addressButton = address && (
    <button
      onClick={copy}
      className="min-w-0 max-w-full truncate font-mono select-all text-gray-500 hover:text-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      title={t.stage.copyAddress}
    >
      {copied ? t.stage.copied : address}
    </button>
  );

  // A phone and the count — the words read oddly alone on the card's line.
  const devicesLabel = t.stage.devices.replace("{n}", String(connectedDeviceCount));
  const devices = (
    <span
      role="img"
      aria-label={devicesLabel}
      title={devicesLabel}
      className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums text-sm text-gray-400"
    >
      <PhoneIcon className="w-[18px] h-[18px]" />
      {connectedDeviceCount}
    </span>
  );

  // The card carries the address and device count itself, so the row below
  // would be left holding nothing but the count — drop it instead.
  if (qrURL && !qrHidden) {
    return (
      <div className="relative flex items-center gap-3 p-2 bg-gray-900/50 border border-gray-700/50 rounded-lg">
        {/* The white quiet zone is what lets a phone lock onto it. */}
        <div className="flex-shrink-0 bg-white p-1.5 rounded-md">
          <QRCodeSVG value={qrURL} size={96} />
        </div>
        <div className="min-w-0 pr-5">
          <div className="text-sm font-medium text-gray-200">{t.stage.phoneRemoteTitle}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t.stage.phoneRemoteHint}</div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            {addressButton}
            {devices}
          </div>
        </div>
        <button
          onClick={() => setQrHiddenPersisted(true)}
          className="absolute top-1.5 right-1.5 p-1 text-gray-500 hover:text-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={t.stage.hidePhoneQr}
          title={t.stage.hidePhoneQr}
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-1 text-xs text-gray-500">
      <div className="flex min-w-0 items-center gap-2">
        {qrURL && qrHidden && (
          // Labelled, not a bare icon: it's the way back after a stray
          // click on the ×, so it has to be findable.
          <button
            onClick={() => setQrHiddenPersisted(false)}
            className="flex flex-shrink-0 items-center gap-1 pr-1 whitespace-nowrap text-blue-400 hover:text-blue-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <QrCodeIcon className="w-3.5 h-3.5" />
            {t.stage.showPhoneQr}
          </button>
        )}
        {/* In the app the address lives on the QR card, and only there —
            the row keeps just the way to bring the card back. */}
        {!isElectron && addressButton}
      </div>
      {devices}
    </div>
  );
}
