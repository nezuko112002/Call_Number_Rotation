/** Per-user, per-conversation read cursor (epoch ms). Persisted in localStorage. */
const storageKey = (userId: string) => `message-read-through:${userId}`;

export function loadMessageReadThrough(userId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveMessageReadThrough(userId: string, map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function readThroughForConversation(
  messages: { direction: string; status: string; timestamp: string }[],
): number {
  const inboundReceived = messages.filter((m) => m.direction === "inbound" && m.status === "received");
  if (inboundReceived.length === 0) return Date.now();
  return Math.max(...inboundReceived.map((m) => new Date(m.timestamp).getTime()));
}
