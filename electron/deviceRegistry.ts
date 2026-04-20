import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import type { DeviceInfo } from "../src/shared/types";

interface StoredDevice extends DeviceInfo {
  token: string;
}

interface DeviceRegistrySchema {
  devices: StoredDevice[];
  version: number;
}

type DevicesChangeCallback = (devices: DeviceInfo[]) => void;
type RevokeCallback = (deviceId: string) => void;

function generateDeviceName(userAgent: string): string {
  const ua = userAgent || "";

  let platform = "Device";
  if (/iPad/i.test(ua)) platform = "iPad";
  else if (/iPhone/i.test(ua)) platform = "iPhone";
  else if (/iPod/i.test(ua)) platform = "iPod";
  else if (/Android/i.test(ua)) {
    platform = /Mobile/i.test(ua) ? "Android Phone" : "Android Tablet";
  } else if (/Macintosh|Mac OS X/i.test(ua)) platform = "Mac";
  else if (/Windows/i.test(ua)) platform = "Windows";
  else if (/CrOS/i.test(ua)) platform = "Chromebook";
  else if (/Linux/i.test(ua)) platform = "Linux";

  let browser: string | null = null;
  if (/FBAN|FBAV|FB_IAB/.test(ua)) browser = "Facebook";
  else if (/Instagram/i.test(ua)) browser = "Instagram";
  else if (/\bTwitter\b|TwitterAndroid/.test(ua)) browser = "Twitter";
  else if (/Line\//.test(ua)) browser = "Line";
  else if (/WhatsApp/i.test(ua)) browser = "WhatsApp";
  else if (/GSA\//.test(ua)) browser = "Google App";
  else if (/DuckDuckGo/i.test(ua)) browser = "DuckDuckGo";
  else if (/Edg(iOS|A)?\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/CriOS\//.test(ua)) browser = "Chrome";
  else if (/FxiOS\//.test(ua)) browser = "Firefox";
  else if (/Brave\//i.test(ua)) browser = "Brave";
  else if (/SamsungBrowser\//i.test(ua)) browser = "Samsung";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";
  else if (/AppleWebKit/i.test(ua)) browser = "WebView";

  return browser ? `${platform} — ${browser}` : platform;
}

function stripToken(stored: StoredDevice): DeviceInfo {
  const { token: _token, ...info } = stored;
  void _token;
  return info;
}

export class DeviceRegistry {
  private store: Store<DeviceRegistrySchema>;
  private changeListeners: DevicesChangeCallback[] = [];
  private revokeListeners: RevokeCallback[] = [];

  constructor() {
    this.store = new Store<DeviceRegistrySchema>({
      name: "devices",
      defaults: {
        devices: [],
        version: 1,
      },
    });
  }

  onDevicesChange(cb: DevicesChangeCallback): () => void {
    this.changeListeners.push(cb);
    return () => {
      this.changeListeners = this.changeListeners.filter((x) => x !== cb);
    };
  }

  onRevoke(cb: RevokeCallback): () => void {
    this.revokeListeners.push(cb);
    return () => {
      this.revokeListeners = this.revokeListeners.filter((x) => x !== cb);
    };
  }

  private notifyChange(): void {
    const devices = this.getAll();
    this.changeListeners.forEach((cb) => cb(devices));
  }

  getAll(): DeviceInfo[] {
    return this.store
      .get("devices", [])
      .map(stripToken)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  getByToken(token: string): DeviceInfo | null {
    if (!token) return null;
    const device = this.store
      .get("devices", [])
      .find((d) => d.token === token);
    return device ? stripToken(device) : null;
  }

  createDevice(userAgent: string): { device: DeviceInfo; token: string } {
    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const stored: StoredDevice = {
      id: uuidv4(),
      token,
      name: generateDeviceName(userAgent),
      userAgent,
      firstSeenAt: now,
      lastSeenAt: now,
    };
    const devices = this.store.get("devices", []);
    devices.push(stored);
    this.store.set("devices", devices);
    this.notifyChange();
    return { device: stripToken(stored), token };
  }

  updateLastSeen(deviceId: string): void {
    const devices = this.store.get("devices", []);
    const idx = devices.findIndex((d) => d.id === deviceId);
    if (idx === -1) return;
    devices[idx].lastSeenAt = Date.now();
    this.store.set("devices", devices);
    this.notifyChange();
  }

  rename(deviceId: string, name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const devices = this.store.get("devices", []);
    const idx = devices.findIndex((d) => d.id === deviceId);
    if (idx === -1) return false;
    devices[idx].name = trimmed.slice(0, 64);
    this.store.set("devices", devices);
    this.notifyChange();
    return true;
  }

  revoke(deviceId: string): boolean {
    const devices = this.store.get("devices", []);
    const filtered = devices.filter((d) => d.id !== deviceId);
    if (filtered.length === devices.length) return false;
    this.store.set("devices", filtered);
    this.revokeListeners.forEach((cb) => cb(deviceId));
    this.notifyChange();
    return true;
  }
}

let instance: DeviceRegistry | null = null;

export function getDeviceRegistry(): DeviceRegistry {
  if (!instance) {
    instance = new DeviceRegistry();
  }
  return instance;
}
