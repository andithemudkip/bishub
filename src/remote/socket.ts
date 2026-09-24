import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "../shared/types";
import { getDeviceToken } from "../shared/utils";

export type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One Socket.io connection per tab, shared by every web-remote hook.
 *
 * Each hook used to open its own connection and close it on unmount, so
 * switching pages on a phone tore down and re-opened several sockets — each
 * re-authenticating, re-sending the initial state, and broadcasting a
 * connect/disconnect to every client. Now hooks attach handlers to this one
 * socket and detach only their own on unmount (`listen`); nothing but a
 * token change reconnects it.
 */
let shared: SocketType | null = null;
let sharedToken: string | null = null;

/** The tab's socket, created on first use with the stored device token; null before pairing. */
export function getSocket(): SocketType | null {
  if (shared) return shared;
  const token = getDeviceToken();
  if (!token) return null;
  return connectWithToken(token);
}

/**
 * Point the shared socket at `token` and make sure it's connecting. A new
 * token (re-pairing after a revoke) reconnects the same socket object, so
 * handlers hooks have attached survive it.
 */
export function connectWithToken(token: string): SocketType {
  if (!shared) {
    shared = io({ auth: { token } });
    sharedToken = token;
    return shared;
  }
  if (token !== sharedToken) {
    sharedToken = token;
    shared.auth = { token };
    shared.disconnect();
  }
  // `active` covers connected and auto-reconnecting; a socket the server
  // rejected (or we disconnected) is neither, and needs an explicit connect.
  if (!shared.active) shared.connect();
  return shared;
}

type Listeners = { [E in keyof ServerToClientEvents]?: ServerToClientEvents[E] };

/**
 * Attach handlers and return a cleanup that removes exactly those — never
 * `removeAllListeners`, which would cut off every other hook on the socket.
 */
export function listen(socket: SocketType, listeners: Listeners): () => void {
  // Typed per event at the call site via `Listeners`; socket.io's `on` can't
  // take a union of event names, hence the cast for the loop.
  const entries = Object.entries(listeners) as [keyof ServerToClientEvents, never][];
  for (const [event, handler] of entries) socket.on(event, handler);
  return () => {
    for (const [event, handler] of entries) socket.off(event, handler);
  };
}

/**
 * Run `onConnect` now if the socket is already up, and again after every
 * reconnect. A hook that mounts after the shared socket connected would
 * otherwise never see a "connect" event, and never make its initial request.
 */
export function onConnected(socket: SocketType, onConnect: () => void): () => void {
  socket.on("connect", onConnect);
  if (socket.connected) onConnect();
  return () => {
    socket.off("connect", onConnect);
  };
}
