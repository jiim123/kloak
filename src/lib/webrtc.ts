/**
 * WebRTC helpers.
 *
 * Configure ICE servers (STUN/TURN) via:
 * - VITE_WEBRTC_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"...","credential":"..."}]'
 */

function defaultIceServers(): RTCIceServer[] {
  // Public STUN for basic connectivity; for reliability you should provide TURN.
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export function getWebRTCIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!raw || typeof raw !== "string") return defaultIceServers();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultIceServers();

    const sanitized = parsed
      .filter((s) => s && (typeof s.urls === "string" || Array.isArray(s.urls)))
      .map((s) => s as RTCIceServer);

    return sanitized.length ? sanitized : defaultIceServers();
  } catch {
    return defaultIceServers();
  }
}

