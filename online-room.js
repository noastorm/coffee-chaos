import { createClient } from "@supabase/supabase-js";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let supabaseClient = null;

function createFallbackId() {
  return `guest-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return createFallbackId();
}

function readEnv(name) {
  return import.meta.env?.[name] || "";
}

function buildPresenceList(state) {
  return Object.entries(state || {})
    .flatMap(([presenceKey, metas]) =>
      (metas || []).map((meta) => ({
        presenceKey,
        ...meta,
      })),
    )
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

export function normalizeRoomCode(value) {
  return (value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 6);
}

export function createRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

export function getRoomCodeFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }
  return normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
}

export function setRoomCodeInLocation(roomCode) {
  if (typeof window === "undefined") {
    return;
  }
  const next = new URL(window.location.href);
  if (roomCode) {
    next.searchParams.set("room", normalizeRoomCode(roomCode));
  } else {
    next.searchParams.delete("room");
  }
  window.history.replaceState({}, "", next.toString());
}

export function buildInviteLink(roomCode) {
  if (typeof window === "undefined") {
    return "";
  }
  const next = new URL(window.location.href);
  next.searchParams.set("room", normalizeRoomCode(roomCode));
  return next.toString();
}

export function hasOnlineConfig() {
  return Boolean(readEnv("VITE_SUPABASE_URL") && readEnv("VITE_SUPABASE_ANON_KEY"));
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = readEnv("VITE_SUPABASE_URL");
  const key = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

export function createRoomSession({ roomCode, role }) {
  const client = getSupabaseClient();
  const clientId = getClientId();
  const normalizedCode = normalizeRoomCode(roomCode);
  const playerId = role === "host" ? 0 : 1;
  let handlers = {};
  let channel = null;
  let connected = false;

  const session = {
    roomCode: normalizedCode,
    role,
    playerId,
    clientId,
    inviteLink: buildInviteLink(normalizedCode),
    setHandlers(nextHandlers = {}) {
      handlers = nextHandlers;
    },
    async connect() {
      if (connected) {
        return session;
      }

      channel = client.channel(`coffee-chaos:${normalizedCode}`, {
        config: {
          broadcast: { self: false },
          presence: { key: clientId },
        },
      });

      channel
        .on("broadcast", { event: "input" }, ({ payload }) => {
          handlers.onInput?.(payload);
        })
        .on("broadcast", { event: "snapshot" }, ({ payload }) => {
          handlers.onSnapshot?.(payload);
        })
        .on("broadcast", { event: "start" }, ({ payload }) => {
          handlers.onStart?.(payload);
        })
        .on("broadcast", { event: "game-over" }, ({ payload }) => {
          handlers.onGameOver?.(payload);
        })
        .on("presence", { event: "sync" }, () => {
          handlers.onPresence?.(buildPresenceList(channel.presenceState()));
        });

      await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Realtime room connection timed out."));
          }
        }, 10000);

        channel.subscribe(async (status) => {
          handlers.onStatus?.(status);

          if (status === "SUBSCRIBED" && !settled) {
            try {
              await channel.track({
                clientId,
                playerId,
                role,
                joinedAt: Date.now(),
              });
              connected = true;
              settled = true;
              clearTimeout(timeout);
              resolve();
            } catch (error) {
              settled = true;
              clearTimeout(timeout);
              reject(error);
            }
          }

          if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error(`Realtime room failed with status: ${status}`));
          }

          if (status === "CLOSED") {
            connected = false;
            handlers.onClosed?.();
          }
        });
      });

      return session;
    },
    async send(event, payload) {
      if (!channel) {
        return;
      }
      await channel.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    async sendInput(payload) {
      await session.send("input", payload);
    },
    async sendSnapshot(payload) {
      await session.send("snapshot", payload);
    },
    async sendStart(payload) {
      await session.send("start", payload);
    },
    async sendGameOver(payload) {
      await session.send("game-over", payload);
    },
    async destroy() {
      connected = false;
      if (channel) {
        const current = channel;
        channel = null;
        handlers = {};
        await client.removeChannel(current);
      }
    },
  };

  return session;
}
