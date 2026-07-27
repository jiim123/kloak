import { config } from "./config.js";
import type { AuthUser } from "./protocol.js";

type RpcOptions = {
  keyHash?: string;
  mfaSessionToken?: string | null;
};

export class SupabaseRpcError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Supabase RPC failed with HTTP ${status}`;
    super(message);
    this.name = "SupabaseRpcError";
    this.status = status;
    this.payload = payload;
  }
}

export async function rpc<T>(name: string, body: Record<string, unknown>, opts: RpcOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    apikey: config.supabasePublishableKey,
    authorization: `Bearer ${config.supabasePublishableKey}`,
    "content-type": "application/json",
  };

  if (opts.keyHash) headers["x-key-hash"] = opts.keyHash;
  if (opts.mfaSessionToken) headers["x-mfa-session"] = opts.mfaSessionToken;

  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new SupabaseRpcError(response.status, payload);
  }

  return payload as T;
}

export async function authenticate(keyHash: string, mfaSessionToken?: string | null): Promise<AuthUser> {
  const user = await rpc<Record<string, unknown> | null>(
    "restore_user_session",
    { _key_hash: keyHash },
    { keyHash, mfaSessionToken },
  );

  if (!user || user.mfa_required === true || typeof user.id !== "string") {
    throw new Error(user?.mfa_required === true ? "MFA session required" : "Invalid websocket credentials");
  }

  return {
    id: user.id,
    username: typeof user.username === "string" ? user.username : undefined,
    display_name: typeof user.display_name === "string" ? user.display_name : null,
    avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
  };
}

export async function canSubscribeChannel(channelId: string, userId: string, opts: RpcOptions) {
  return await rpc<boolean>("can_subscribe_socket_channel", { _channel_id: channelId, _user_id: userId }, opts);
}

export async function canSubscribeDm(conversationId: string, userId: string, opts: RpcOptions) {
  return await rpc<boolean>("can_subscribe_socket_dm", { _conversation_id: conversationId, _user_id: userId }, opts);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
