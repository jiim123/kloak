import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import type { ShouldStartLoadRequest, WebViewErrorEvent } from "react-native-webview/lib/WebViewTypes";

type MobileExtraConfig = {
  webUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const mobileConfig = (Constants.expoConfig?.extra?.mobile ?? {}) as MobileExtraConfig;
const WEB_URL = process.env.EXPO_PUBLIC_KLOAK_WEB_URL || mobileConfig.webUrl || "https://kloak.app/app";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || mobileConfig.supabaseUrl || "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || mobileConfig.supabasePublishableKey || "";
const APP_ORIGIN = new URL(WEB_URL).origin;
const APP_HOME_URL = withNativeMobileParam(WEB_URL);
const MOBILE_AUTH_URL = `${APP_ORIGIN}/auth?mode=login&mobile=1`;
const splashLogo = require("./assets/app-icon.png");
const SPLASH_LOADING_LINES = [
  "Doing the thing...",
  "One sec, don't panic",
  "Please enjoy this loading screen",
  "Nearly done-ish",
  "Give it a tiny second",
  "Pretending to be fast...",
  "Almost there!",
];

type PushRegistration = {
  token: string;
  platform: "ios" | "android";
  deviceId: string | null;
  appVersion: string | null;
};

type ShellMessage =
  | { type: "push-token-registration"; ok: boolean; reason?: string; tokenPrefix?: string; userId?: string; diagnostics?: string[] }
  | { type: string; [key: string]: unknown };

type PushStatus = "idle" | "native-ready" | "registered" | "not-authenticated" | "failed";
type ConnectivityStatus = "online" | "offline";
type NativePushState = {
  status: PushStatus;
  message: string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function logPush(message: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[KloakPush] ${message}`);
    return;
  }
  console.log(`[KloakPush] ${message}`, details);
}
function getProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId
  );
}

function toAppUrl(pathOrUrl: string) {
  try {
    const url = new URL(pathOrUrl, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return WEB_URL;

    const serverId = url.searchParams.get("server");
    const channelId = url.searchParams.get("channel");
    const messageId = url.searchParams.get("message");
    if (url.pathname === "/app" && serverId && channelId) {
      const params = messageId ? `?message=${encodeURIComponent(messageId)}` : "";
      return withNativeMobileParam(`${APP_ORIGIN}/app/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}${params}`);
    }

    return webViewTargetUrl(url.toString());
  } catch {
    return APP_HOME_URL;
  }
}

function withNativeMobileParam(urlValue: string) {
  try {
    const url = new URL(urlValue, APP_ORIGIN);
    if (url.origin === APP_ORIGIN) url.searchParams.set("native", "1");
    return url.toString();
  } catch {
    return urlValue;
  }
}

function getPrivateAppRoute(urlValue: string) {
  try {
    const url = new URL(urlValue, APP_ORIGIN);
    if (url.origin === APP_ORIGIN && url.pathname.startsWith("/app") && url.pathname !== "/app") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return null;
  }
  return null;
}

function webViewTargetUrl(urlValue: string) {
  return getPrivateAppRoute(urlValue) ? APP_HOME_URL : withNativeMobileParam(urlValue);
}

async function checkAppReachable(timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(APP_ORIGIN, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function isConnectivityWebViewError(description: string) {
  return [
    "ERR_INTERNET_DISCONNECTED",
    "ERR_NAME_NOT_RESOLVED",
    "ERR_NETWORK_CHANGED",
    "ERR_ADDRESS_UNREACHABLE",
    "NSURLErrorNotConnectedToInternet",
    "NSURLErrorNetworkConnectionLost",
    "The Internet connection appears to be offline",
  ].some((needle) => description.includes(needle));
}

function notificationUrl(data: Record<string, unknown>) {
  if (data.type === "friend_request") return toAppUrl("/app/friends");

  const explicitLink = typeof data.link === "string" ? data.link : typeof data.url === "string" ? data.url : null;
  if (explicitLink) return toAppUrl(explicitLink);

  const conversationId = typeof data.conversationId === "string" ? data.conversationId : typeof data.conversation_id === "string" ? data.conversation_id : null;
  if (conversationId) return toAppUrl(`/app?conversation=${encodeURIComponent(conversationId)}`);

  const serverId = typeof data.serverId === "string" ? data.serverId : typeof data.server_id === "string" ? data.server_id : null;
  const channelId = typeof data.channelId === "string" ? data.channelId : typeof data.channel_id === "string" ? data.channel_id : null;
  const messageId = typeof data.messageId === "string" ? data.messageId : typeof data.message_id === "string" ? data.message_id : null;
  if (serverId && channelId) {
    const params = messageId ? `?message=${encodeURIComponent(messageId)}` : "";
    return toAppUrl(`/app/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}${params}`);
  }

  return APP_HOME_URL;
}

async function registerNativePush(): Promise<PushRegistration | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Kloak",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#5865F2",
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync() as { status?: string; granted?: boolean };
  const permission = currentPermission.granted || currentPermission.status === "granted"
    ? currentPermission
    : await Notifications.requestPermissionsAsync() as { status?: string; granted?: boolean };

  if (!permission.granted && permission.status !== "granted") {
    logPush("notification permission not granted", permission);
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error("No EAS project id found. Set EXPO_PUBLIC_EAS_PROJECT_ID in mobileapps-new/.env.");
  }
  logPush("requesting Expo push token", { projectId, platform: Platform.OS });
  const token = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  logPush("received Expo push token", { tokenPrefix: token.data.slice(0, 24) });

  return {
    token: token.data,
    platform: Platform.OS,
    deviceId: [Device.manufacturer, Device.modelName, Device.osBuildId].filter(Boolean).join(" ") || null,
    appVersion: Constants.expoConfig?.version ?? null,
  };
}

function pushRegistrationScript(registration: PushRegistration) {
  const payload = {
    token: registration.token,
    platform: registration.platform,
    device_id: registration.deviceId,
    app_version: registration.appVersion,
  };

  return `
    (function () {
      const payload = ${JSON.stringify(payload)};
      const supabaseUrl = ${JSON.stringify(SUPABASE_URL)};
      const supabaseKey = ${JSON.stringify(SUPABASE_KEY)};
      const validHash = /^[a-f0-9]{64}$/i;
      const diagnostics = [];

      function post(message) {
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
        } catch (_) {}
      }

      function parseJson(value) {
        try {
          return value ? JSON.parse(value) : null;
        } catch (_) {
          return null;
        }
      }

      async function sha256Hex(value) {
        const bytes = new TextEncoder().encode(value);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      }

      function idbGet(db, key) {
        return new Promise((resolve, reject) => {
          const tx = db.transaction("keys", "readonly");
          const request = tx.objectStore("keys").get(key);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      }

      function openDeviceDb() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open("kloak-device", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error("indexeddb-blocked"));
        });
      }

      async function decryptDeviceValue(storageId) {
        try {
          const db = await openDeviceDb();
          if (!db.objectStoreNames.contains("keys")) return null;
          const deviceKey = await idbGet(db, "device-key");
          const stored = await idbGet(db, storageId);
          if (!deviceKey || !stored || !Array.isArray(stored.iv) || !Array.isArray(stored.data)) return null;
          const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(stored.iv) },
            deviceKey,
            new Uint8Array(stored.data)
          );
          return new TextDecoder().decode(decrypted);
        } catch (_) {
          return null;
        }
      }

      async function getAuthHeaders() {
        const fallback = parseJson(window.localStorage.getItem("kloak-device-credentials-v1"));
        const persistedAuth = parseJson(window.localStorage.getItem("kloak-auth"));
        const persistedState = persistedAuth && typeof persistedAuth === "object" ? persistedAuth.state : null;
        diagnostics.push("origin:" + window.location.origin);
        diagnostics.push("fallback:" + (fallback ? "yes" : "no"));
        diagnostics.push("persistedAuth:" + (persistedAuth ? "yes" : "no"));

        let keyHash = fallback && typeof fallback.keyHash === "string" ? fallback.keyHash.toLowerCase() : null;
        if (keyHash) diagnostics.push("keyHash:fallback");
        if (!keyHash && persistedState && typeof persistedState.keyHash === "string") {
          keyHash = persistedState.keyHash.toLowerCase();
          diagnostics.push("keyHash:persisted");
        }
        if (!keyHash && persistedState && typeof persistedState.secretKey === "string" && persistedState.secretKey.length > 0) {
          keyHash = await sha256Hex(persistedState.secretKey.trim().toLowerCase());
          diagnostics.push("keyHash:secret");
        }
        if (!keyHash) {
          const encryptedKeyHash = await decryptDeviceValue("encrypted-keyhash");
          keyHash = encryptedKeyHash ? encryptedKeyHash.toLowerCase() : null;
          diagnostics.push("keyHash:" + (keyHash ? "indexeddb" : "missing"));
        }

        let mfaSession = fallback && typeof fallback.mfaSession === "string" ? fallback.mfaSession.toLowerCase() : null;
        if (mfaSession) diagnostics.push("mfa:fallback");
        if (!mfaSession && persistedState && typeof persistedState.mfaSessionToken === "string") {
          mfaSession = persistedState.mfaSessionToken.toLowerCase();
          diagnostics.push("mfa:persisted");
        }
        if (!mfaSession) {
          const encryptedMfaSession = await decryptDeviceValue("encrypted-mfa-session");
          mfaSession = encryptedMfaSession ? encryptedMfaSession.toLowerCase() : null;
          diagnostics.push("mfa:" + (mfaSession ? "indexeddb" : "none"));
        }

        return { keyHash, mfaSession };
      }

      async function register() {
        try {
          if (!supabaseUrl || !supabaseKey) {
            post({ type: "push-token-registration", ok: false, reason: "missing-supabase-config" });
            return;
          }
          if (window.__KLOAK_NATIVE_PUSH_TOKEN === payload.token) return;

          const { keyHash, mfaSession } = await getAuthHeaders();

          if (!keyHash || !validHash.test(keyHash)) {
            post({ type: "push-token-registration", ok: false, reason: "not-authenticated", diagnostics });
            return;
          }

          const headers = {
            apikey: supabaseKey,
            Authorization: "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            "x-key-hash": keyHash
          };
          if (mfaSession && validHash.test(mfaSession)) headers["x-mfa-session"] = mfaSession;

          const sessionResponse = await fetch(supabaseUrl + "/rest/v1/rpc/restore_user_session", {
            method: "POST",
            headers,
            body: JSON.stringify({ _key_hash: keyHash })
          });
          if (!sessionResponse.ok) {
            diagnostics.push("restore:" + sessionResponse.status);
            throw new Error("restore_user_session:" + sessionResponse.status);
          }

          const user = await sessionResponse.json();
          if (!user || typeof user.id !== "string") {
            post({ type: "push-token-registration", ok: false, reason: "no-user", diagnostics });
            return;
          }
          diagnostics.push("user:" + user.id.slice(0, 8));

          const tokenResponse = await fetch(supabaseUrl + "/rest/v1/push_tokens?on_conflict=token", {
            method: "POST",
            headers: {
              ...headers,
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify({
              user_id: user.id,
              token: payload.token,
              platform: payload.platform,
              device_id: payload.device_id,
              app_version: payload.app_version,
              enabled: true,
              last_used_at: new Date().toISOString()
            })
          });
          if (!tokenResponse.ok) {
            diagnostics.push("push_tokens:" + tokenResponse.status);
            throw new Error("push_tokens:" + tokenResponse.status);
          }

          window.__KLOAK_NATIVE_PUSH_TOKEN = payload.token;
          window.__KLOAK_NATIVE_PUSH_TOKEN_STATUS = "registered";
          post({
            type: "push-token-registration",
            ok: true,
            tokenPrefix: payload.token.slice(0, 24),
            userId: user.id,
            diagnostics
          });
        } catch (error) {
          window.__KLOAK_NATIVE_PUSH_TOKEN_STATUS = "failed";
          post({
            type: "push-token-registration",
            ok: false,
            reason: error && error.message ? error.message : "unknown",
            diagnostics
          });
        }
      }

      register();
    })();
    true;
  `;
}

function siteReadyScript() {
  return `
    (function () {
      if (window.__KLOAK_NATIVE_READY_WATCHER) return true;
      window.__KLOAK_NATIVE_READY_WATCHER = true;

      var startedAt = Date.now();
      var timer = null;
      var observer = null;
      var checkQueued = false;
      var posted = false;

      function postReady(reason) {
        if (posted) return;
        posted = true;
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "site-ready",
            reason: reason
          }));
        } catch (_) {}
      }

      function visibleText() {
        return ((document.body && document.body.textContent) || "").slice(0, 4000).replace(/\\s+/g, " ").trim();
      }

      function isVisible(element) {
        if (!element || !element.getBoundingClientRect) return false;
        var rect = element.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        var style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0;
      }

      function hasBlockingLoader() {
        var selectors = [
          '[aria-busy="true"]',
          '[data-loading="true"]',
          '[data-state="loading"]',
          '.loading',
          '.spinner',
          '.loader'
        ];
        return selectors.some(function (selector) {
          return Array.prototype.some.call(document.querySelectorAll(selector), isVisible);
        }) || /loading\\s+kloak|loading kloak/.test(visibleText().toLowerCase());
      }

      function hasUsablePage() {
        if (document.readyState !== "complete" || !document.body) return false;
        var text = visibleText();
        var hasInteractiveElement = Boolean(document.querySelector("input, textarea, button, a[href], [role='button']"));
        var hasRenderedRoot = Boolean(document.querySelector("#root")) && document.body.children.length > 0;
        return text.length > 20 && (hasInteractiveElement || hasRenderedRoot);
      }

      function cleanup() {
        if (timer) window.clearInterval(timer);
        if (observer) observer.disconnect();
        window.removeEventListener("load", scheduleCheck);
        window.__KLOAK_NATIVE_READY_WATCHER = false;
      }

      function check() {
        checkQueued = false;
        var timedOut = Date.now() - startedAt > 12000;
        if (timedOut || (hasUsablePage() && !hasBlockingLoader())) {
          cleanup();
          postReady(timedOut ? "timeout" : "ready");
        }
      }

      function scheduleCheck() {
        if (checkQueued || posted) return;
        checkQueued = true;
        window.requestAnimationFrame(check);
      }

      timer = window.setInterval(scheduleCheck, 500);
      observer = new MutationObserver(scheduleCheck);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener("load", scheduleCheck);
      scheduleCheck();
    })();
    true;
  `;
}

function nativeMobileBootstrapScript() {
  return `
    (function () {
      try {
        window.localStorage.setItem("kloak:native-mobile", "1");
        document.documentElement.classList.add("kloak-native-mobile");
      } catch (_) {}

      function postConnectivity(online) {
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "connectivity-change",
            online: online
          }));
        } catch (_) {}
      }

      window.addEventListener("online", function () { postConnectivity(true); });
      window.addEventListener("offline", function () { postConnectivity(false); });
      if (navigator && navigator.onLine === false) postConnectivity(false);
    })();
    true;
  `;
}

function navigateScript(url: string) {
  const privateRoute = getPrivateAppRoute(url);
  const targetUrl = privateRoute ? APP_HOME_URL : webViewTargetUrl(url);

  return `
    (function () {
      var targetUrl = ${JSON.stringify(targetUrl)};
      var privateRoute = ${JSON.stringify(privateRoute)};
      try {
        if (privateRoute) {
          window.sessionStorage.setItem("kloak:pending-private-route", privateRoute);
        }
      } catch (_) {}
      if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
      }
    })();
    true;
  `;
}

function AppShell() {
  const webViewRef = useRef<WebViewType>(null);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashVisibleRef = useRef(true);
  const [pushRegistration, setPushRegistration] = useState<PushRegistration | null>(null);
  const [currentUrl, setCurrentUrl] = useState(MOBILE_AUTH_URL);
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus>("online");
  const [loadError, setLoadError] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashLineIndex, setSplashLineIndex] = useState(0);

  const canRegisterInWebView = useMemo(() => Boolean(pushRegistration && SUPABASE_URL && SUPABASE_KEY), [pushRegistration]);

  const showSplash = useCallback(() => {
    if (!splashVisibleRef.current) return;
    splashOpacity.setValue(1);
    setSplashVisible(true);
  }, [splashOpacity]);

  const dismissSplash = useCallback(() => {
    if (!splashVisibleRef.current) return;
    splashVisibleRef.current = false;
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSplashVisible(false));
  }, [splashOpacity]);

  const injectSiteReadyWatcher = useCallback(() => {
    webViewRef.current?.injectJavaScript(siteReadyScript());
  }, []);

  const injectPushRegistration = useCallback(() => {
    if (!pushRegistration || !canRegisterInWebView || pushStatus === "registered") return;
    webViewRef.current?.injectJavaScript(pushRegistrationScript(pushRegistration));
  }, [canRegisterInWebView, pushRegistration, pushStatus]);

  const routeToNotification = useCallback((data: Record<string, unknown>) => {
    const nextUrl = notificationUrl(data);
    setCurrentUrl(webViewTargetUrl(nextUrl));
    webViewRef.current?.injectJavaScript(navigateScript(nextUrl));
  }, []);

  const refreshNativePush = useCallback(async (): Promise<NativePushState> => {
    try {
      const registration = await registerNativePush();
      setPushRegistration(registration);
      setPushStatus(registration ? "native-ready" : "failed");
      const message = registration ? `native ready ${registration.token.slice(0, 24)}` : "Native push unavailable";
      logPush(registration ? "native token ready" : "native push unavailable", registration ? { tokenPrefix: registration.token.slice(0, 24) } : undefined);
      return { status: registration ? "native-ready" : "failed", message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Native push failed";
      setPushRegistration(null);
      setPushStatus("failed");
      logPush("native push failed", message);
      return { status: "failed", message };
    }
  }, []);

  const refreshConnectivity = useCallback(async () => {
    const reachable = await checkAppReachable();
    setConnectivityStatus(reachable ? "online" : "offline");
    if (!reachable) setLoadError(false);
    return reachable;
  }, []);

  useEffect(() => {
    void refreshNativePush();
  }, [refreshNativePush]);

  useEffect(() => {
    void refreshConnectivity();
  }, [refreshConnectivity]);

  useEffect(() => {
    if (pushRegistration) injectPushRegistration();
  }, [injectPushRegistration, pushRegistration]);

  useEffect(() => {
    if (!splashVisible) return;
    const timeout = setTimeout(dismissSplash, 15_000);
    return () => clearTimeout(timeout);
  }, [dismissSplash, splashVisible]);

  useEffect(() => {
    if (!splashVisible) return;
    const interval = setInterval(() => {
      setSplashLineIndex((index) => (index + 1) % SPLASH_LOADING_LINES.length);
    }, 1_600);
    return () => clearInterval(interval);
  }, [splashVisible]);

  useEffect(() => {
    if (!pushRegistration || pushStatus === "registered") return;
    const interval = setInterval(injectPushRegistration, 4_000);
    return () => clearInterval(interval);
  }, [injectPushRegistration, pushRegistration, pushStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshConnectivity();
        void refreshNativePush().then((result) => {
          if (result.status === "native-ready") setTimeout(injectPushRegistration, 500);
        });
      }
    });
    return () => subscription.remove();
  }, [injectPushRegistration, refreshConnectivity, refreshNativePush]);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (data) routeToNotification(data as Record<string, unknown>);
    };

    void Notifications.getLastNotificationResponseAsync().then(handleResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [routeToNotification]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ShellMessage;
      if (message.type === "push-token-registration") {
        const reason = typeof message.reason === "string" ? message.reason : "Push not ready";
        setPushStatus(message.ok ? "registered" : reason === "not-authenticated" ? "not-authenticated" : "failed");
        logPush("web registration result", {
          ok: message.ok,
          reason,
          tokenPrefix: message.tokenPrefix,
          userId: message.userId,
          diagnostics: message.diagnostics,
        });
      } else if (message.type === "site-ready") {
        dismissSplash();
      } else if (message.type === "connectivity-change") {
        const online = message.online === true;
        setConnectivityStatus(online ? "online" : "offline");
        if (!online) {
          setLoadError(false);
          dismissSplash();
        }
      }
    } catch {
      // Ignore ordinary app messages; this shell only consumes its own envelope.
    }
  };

  const handleNavigationChange = (event: WebViewNavigation) => {
    setCurrentUrl(webViewTargetUrl(event.url));
    setTimeout(injectPushRegistration, 350);
  };

  const handleShouldStartLoadWithRequest = (request: ShouldStartLoadRequest) => {
    if (!request.isTopFrame || !getPrivateAppRoute(request.url)) return true;
    setCurrentUrl(APP_HOME_URL);
    webViewRef.current?.injectJavaScript(navigateScript(request.url));
    return false;
  };

  const recoverWebView = (url: string) => {
    setLoadError(false);
    setCurrentUrl(webViewTargetUrl(url));
    setTimeout(() => webViewRef.current?.injectJavaScript(navigateScript(url)), 50);
  };

  const handleWebViewError = (event: WebViewErrorEvent) => {
    const failedUrl = event.nativeEvent.url || currentUrl;
    const description = event.nativeEvent.description || "";
    if (isConnectivityWebViewError(description)) {
      setConnectivityStatus("offline");
      setLoadError(false);
      dismissSplash();
      return;
    }

    const isTransientProtocolError = description.includes("ERR_HTTP2_PROTOCOL_ERROR");
    if (isTransientProtocolError || getPrivateAppRoute(failedUrl)) {
      recoverWebView(failedUrl);
      return;
    }
    setLoadError(true);
  };

  const handleRetryConnection = async () => {
    const reachable = await refreshConnectivity();
    if (!reachable) return;
    setLoadError(false);
    recoverWebView(currentUrl);
  };

  if (connectivityStatus === "offline") {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="light" />
        <Image source={splashLogo} style={styles.offlineLogo} resizeMode="contain" />
        <Text style={styles.title}>No internet connection</Text>
        <Text style={styles.copy}>Connect to the internet, then try again.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRetryConnection}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.title}>Missing mobile config</Text>
        <Text style={styles.copy}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar style="light" backgroundColor="#0f0f0f" />
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webview}
        originWhitelist={[APP_ORIGIN, "https://*.supabase.co", "https://*.b-cdn.net"]}
        injectedJavaScriptBeforeContentLoaded={nativeMobileBootstrapScript()}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={showSplash}
        onLoadEnd={() => {
          injectSiteReadyWatcher();
          injectPushRegistration();
        }}
        onNavigationStateChange={handleNavigationChange}
        onError={handleWebViewError}
        onLoad={() => setLoadError(false)}
        renderError={() => <View style={styles.webviewErrorFallback} />}
        renderLoading={() => <View style={styles.hiddenLoader} />}
        startInLoadingState={false}
      />
      {loadError ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>Kloak could not load.</Text>
          <TouchableOpacity onPress={() => recoverWebView(currentUrl)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {splashVisible ? (
        <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
          <Image source={splashLogo} style={styles.splashLogo} resizeMode="contain" />
          <Text style={styles.splashCopy}>{SPLASH_LOADING_LINES[splashLineIndex]}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  hiddenLoader: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  webviewErrorFallback: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0f0f0f",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  copy: {
    color: "#a3a3a3",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  splash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#0d0d0d",
    zIndex: 20,
  },
  splashLogo: {
    width: 112,
    height: 112,
    borderRadius: 28,
  },
  offlineLogo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    marginBottom: 18,
  },
  splashCopy: {
    color: "#8f8f8f",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 18,
    textTransform: "uppercase",
  },
  errorBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#311818",
    borderWidth: 1,
    borderColor: "#5f2525",
  },
  errorText: {
    color: "#ffd1d1",
    fontSize: 13,
    fontWeight: "700",
  },
  retryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 44,
    minWidth: 132,
    marginTop: 22,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ededed",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#0f0f0f",
    fontSize: 14,
    fontWeight: "800",
  },
});
