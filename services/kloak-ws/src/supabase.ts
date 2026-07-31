import { config } from "./config.js";
import type { AuthUser } from "./protocol.js";

type RpcOptions = {
  keyHash?: string;
  mfaSessionToken?: string | null;
};

type RestOptions = RpcOptions & {
  method?: "GET" | "PATCH" | "DELETE";
  body?: unknown;
  prefer?: string;
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

  const response = await fetchWithTimeout(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
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

export async function rest<T>(path: string, opts: RestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    apikey: config.supabasePublishableKey,
    authorization: `Bearer ${config.supabasePublishableKey}`,
  };

  if (opts.keyHash) headers["x-key-hash"] = opts.keyHash;
  if (opts.mfaSessionToken) headers["x-mfa-session"] = opts.mfaSessionToken;
  if (opts.prefer) headers.prefer = opts.prefer;

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };

  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  const response = await fetchWithTimeout(`${config.supabaseUrl}/rest/v1/${path}`, init);
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

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Supabase request timed out after ${config.supabaseFetchTimeoutMs}ms`));
  }, config.supabaseFetchTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
