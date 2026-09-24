import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Web remote parity (CLAUDE.md): every action the Electron remote can take
// over IPC must also reach the main process from a phone over Socket.io, and
// every Electron broadcast needs a matching io.emit. Forgetting the web half
// raises no error anywhere — the button just does nothing on a phone — so this
// reads both sides from source and fails on anything unmatched.
//
// Names are compared loosely: IPC uses kebab-case ("go-idle"), Socket.io uses
// camelCase ("goIdle"), and broadcasts drop an "-update" suffix on the web
// ("audio-library-update" → "audioLibrary").

const ROOT = path.resolve(__dirname, "..");

/**
 * IPC channels with no same-named socket handler, and why that's fine. A
 * `socket` or `http` equivalent is checked to exist; `electronOnly` is for
 * what can't run remotely (native dialogs, the local filesystem, this
 * machine's settings) or isn't a remote action at all.
 */
type Counterpart = { socket: string } | { http: string } | { electronOnly: string };

const IPC_COUNTERPARTS: Record<string, Counterpart> = {
  // Served to web remotes another way
  "get-settings": { socket: "getState" },
  "get-app-version": { http: "GET /api/version" },
  "get-local-ip": { http: "GET /api/ip" },
  "cancel-youtube-download": { socket: "cancelDownload" },
  "cancel-youtube-audio-download": { socket: "cancelAudioDownload" },
  "get-active-downloads": { socket: "getInFlight" },
  "get-active-audio-downloads": { socket: "getInFlight" },
  "get-video-thumbnail": { http: "GET /api/videos/thumbnail/:id" },
  "import-pptx": { http: "POST /api/hymns/import" },
  "delete-transfer": { http: "POST /api/transfers/delete" },
  "add-transfer-to-video": { http: "POST /api/transfers/add-to-video" },
  "add-transfer-to-audio": { http: "POST /api/transfers/add-to-audio" },
  "add-transfer-to-image": { http: "POST /api/transfers/add-to-image" },

  // Native pickers and the local filesystem; web remotes upload instead
  "open-file-dialog": { electronOnly: "native file picker" },
  "set-idle-wallpaper": { electronOnly: "native file picker; hidden on web" },
  "add-local-video": { electronOnly: "native file picker; web uses /api/videos/upload" },
  "add-local-audio": { electronOnly: "native file picker; web uses /api/audio/upload" },
  "add-local-audio-directory": { electronOnly: "native folder picker" },
  "add-local-images": { electronOnly: "native file picker; web uses /api/images/upload" },
  "show-item-in-folder": { electronOnly: "reveals a file in Finder/Explorer" },

  // This machine's install, not something to drive from a phone
  "get-binary-info": { electronOnly: "bundled/OTA binary versions" },
  "check-for-updates": { electronOnly: "app updater" },
  "install-update": { electronOnly: "app updater" },
  "get-security-key": { electronOnly: "pairing key shown on the main screen" },
  "get-open-on-startup": { electronOnly: "OS login item" },
  "set-open-on-startup": { electronOnly: "OS login item" },

  // Sent by the display window, not by a remote
  "video-time-update": { electronOnly: "display → main playback clock" },
  "audio-time-update": { electronOnly: "display → main playback clock" },
  "audio-ended": { electronOnly: "display → main playback event" },
  "audio-error": { electronOnly: "display → main playback event" },
};

/** Broadcasts with no same-named io.emit, and why. */
const BROADCAST_COUNTERPARTS: Record<string, Counterpart> = {
  "connected-devices-update": { socket: "connectedDeviceIds" },
  "hymn-mp3-download-progress": { socket: "mp3DownloadProgress" },
  "hymn-mp3-cache-stats": { socket: "mp3CacheStats" },
  "audio-directory-import-progress": { electronOnly: "folder import is Electron-only" },
};

// ── Reading the source ───────────────────────────────────────────────────────

function parse(file: string): ts.SourceFile {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

const electronFiles = fs
  .readdirSync(path.join(ROOT, "electron"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => parse(`electron/${f}`));
const serverFile = electronFiles.find((f) => f.fileName === "electron/server.ts")!;

/**
 * First string-literal argument of every `<receiver>.<method>(...)` call,
 * where the receiver's text ends with `receiver` (so "windowManager" matches
 * both `windowManager.x` and `this.windowManager.x`).
 */
function callNames(files: ts.SourceFile[], receiver: string, methods: string[]): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      methods.includes(node.expression.name.text) &&
      node.expression.expression.getText().split(".").pop() === receiver &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const method = node.expression.name.text;
      const name = node.arguments[0].text;
      names.push(receiver === "app" ? `${method.toUpperCase()} ${name}` : name);
    }
    ts.forEachChild(node, visit);
  };
  files.forEach(visit);
  return [...new Set(names)];
}

function clientEventNames(): string[] {
  const types = parse("src/shared/types.ts");
  const alias = types.statements.find(
    (s): s is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(s) && s.name.text === "ClientToServerEvents"
  );
  if (!alias || !ts.isTypeLiteralNode(alias.type)) {
    throw new Error("ClientToServerEvents is no longer a type literal — update this test");
  }
  return alias.type.members.map((m) => m.name!.getText());
}

const ipcChannels = callNames(electronFiles, "ipcMain", ["handle", "on"]);
const socketHandlers = callNames([serverFile], "socket", ["on"]);
const httpRoutes = callNames([serverFile], "app", ["get", "post", "put", "delete", "patch"]);
const broadcasts = callNames(electronFiles, "windowManager", ["broadcastToAll"]).concat(
  callNames(electronFiles, "this", ["broadcastToAll"])
);
const ioEmits = callNames(electronFiles, "io", ["emit"]);

const key = (name: string) => name.replace(/-/g, "").toLowerCase();
const broadcastKey = (name: string) => key(name).replace(/update$/, "");
const socketKeys = new Set(socketHandlers.map(key));
const emitKeys = new Set(ioEmits.map(broadcastKey));

function missingCounterpart(counterpart: Counterpart, sockets: string[]): string | null {
  if ("socket" in counterpart && !sockets.includes(counterpart.socket)) {
    return `socket event "${counterpart.socket}" not found`;
  }
  if ("http" in counterpart && !httpRoutes.includes(counterpart.http)) {
    return `route "${counterpart.http}" not found`;
  }
  return null;
}

// ── Checks ───────────────────────────────────────────────────────────────────

describe("web remote parity", () => {
  it("finds what it's checking", () => {
    // Guards the parsing itself: an empty list would make every check pass.
    for (const list of [ipcChannels, socketHandlers, httpRoutes, broadcasts, ioEmits]) {
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it("handles every typed client event in server.ts", () => {
    const unhandled = clientEventNames().filter((name) => !socketHandlers.includes(name));
    expect(unhandled, "add a socket.on handler in electron/server.ts").toEqual([]);
  });

  it("gives every IPC action a web path", () => {
    const unmatched = ipcChannels.filter(
      (channel) => !socketKeys.has(key(channel)) && !(channel in IPC_COUNTERPARTS)
    );
    expect(
      unmatched,
      "add a Socket.io handler in server.ts, or list the channel in IPC_COUNTERPARTS with its reason"
    ).toEqual([]);
  });

  it("gives every Electron broadcast a web emit", () => {
    const unmatched = broadcasts.filter(
      (channel) => !emitKeys.has(broadcastKey(channel)) && !(channel in BROADCAST_COUNTERPARTS)
    );
    expect(
      unmatched,
      "add a matching io.emit, or list the channel in BROADCAST_COUNTERPARTS with its reason"
    ).toEqual([]);
  });

  it.each([
    ["IPC_COUNTERPARTS", IPC_COUNTERPARTS, ipcChannels, socketHandlers, key, socketKeys],
    ["BROADCAST_COUNTERPARTS", BROADCAST_COUNTERPARTS, broadcasts, ioEmits, broadcastKey, emitKeys],
  ] as const)("keeps %s accurate", (_name, counterparts, channels, sockets, toKey, sameNamed) => {
    const problems = Object.entries(counterparts).flatMap(([channel, counterpart]) => {
      if (!channels.includes(channel)) return [`${channel}: channel no longer exists`];
      if (sameNamed.has(toKey(channel))) return [`${channel}: now has a same-named web path`];
      const missing = missingCounterpart(counterpart, [...sockets]);
      return missing ? [`${channel}: ${missing}`] : [];
    });
    expect(problems).toEqual([]);
  });
});
