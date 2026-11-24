// App-wide handling of expired access tokens (15 min) and sessions.
//
// installAuthInterceptor() wraps the global fetch ONCE. For requests to our own API that
// were sent with a Bearer token and come back 401 it:
//   1. silently swaps the refresh token for a new access token and retries the request, or
//   2. if the refresh token is gone/revoked/expired, ends the session cleanly (wipes account
//      data, resets in-memory state, back to Welcome).
// A network failure while refreshing does NOT log the user out. Every screen is covered
// without changing each fetch call.
//
// Credential endpoints (/users/login, /users/register, /auth/*) are skipped: a 401 there
// means "wrong credentials", not "session expired".
import * as SecureStore from "expo-secure-store";
import { resolveApiBase } from "../utils/api";
import { clearSession } from "./auth";
import { emitSessionExpired } from "./session";
import { resetToWelcome } from "./navigation";

const CREDENTIAL_PATHS = /^\/(auth\/|users\/(login|register)(\/|$|\?))/;

function getAuthHeader(init, input) {
  const h = init?.headers || (typeof input === "object" ? input?.headers : null);
  if (!h) return null;
  if (typeof h.get === "function") return h.get("Authorization") || h.get("authorization");
  for (const k of Object.keys(h)) if (k.toLowerCase() === "authorization") return h[k];
  return null;
}

// One refresh at a time: refresh tokens rotate, so parallel refreshes would race.
let refreshing = null;
async function refreshSession(originalFetch) {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return { status: "invalid" };
      let res;
      try {
        res = await originalFetch(`${resolveApiBase()}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        return { status: "error" }; // offline etc.: keep the session, just fail this request
      }
      if (res.status === 401) return { status: "invalid" };
      if (!res.ok) return { status: "error" };
      const data = await res.json();
      await SecureStore.setItemAsync("authToken", data.token);
      await SecureStore.setItemAsync("refreshToken", data.refreshToken);
      return { status: "ok", token: data.token };
    })().finally(() => setTimeout(() => (refreshing = null), 0));
  }
  return refreshing;
}

function withAuthHeader(init, token) {
  const h = init?.headers;
  let headers;
  if (h && typeof h.get === "function") {
    headers = new Headers(h);
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers = { ...(h || {}) };
    for (const k of Object.keys(headers)) if (k.toLowerCase() === "authorization") delete headers[k];
    headers.Authorization = `Bearer ${token}`;
  }
  return { ...(init || {}), headers };
}

let expiring = null;
export function expireSession() {
  // Many requests can 401 at once; only handle the first.
  if (!expiring) {
    expiring = (async () => {
      try {
        // Each step is independent: a failure in one must not stop the user being signed out.
        try { await clearSession(); } catch {}
        try { emitSessionExpired(); } catch {}
        try { resetToWelcome({ sessionExpired: true }); } catch {}
      } finally {
        setTimeout(() => (expiring = null), 1000);
      }
    })();
  }
  return expiring;
}

export function installAuthInterceptor() {
  if (globalThis.__authInterceptorInstalled) return;
  globalThis.__authInterceptorInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    if (res.status !== 401) return res;

    try {
      const url = typeof input === "string" ? input : input?.url;
      const base = resolveApiBase();
      if (!url || !url.startsWith(base)) return res; // not our API
      if (CREDENTIAL_PATHS.test(url.slice(base.length))) return res;
      const sent = getAuthHeader(init, input);
      if (!sent) return res; // unauthenticated call, nothing to expire
      if (typeof input !== "string") return res; // only plain URL calls are retried

      // Someone else may already have refreshed while this request was in flight.
      const stored = await SecureStore.getItemAsync("authToken");
      let newToken = null;
      if (stored && sent !== `Bearer ${stored}`) {
        newToken = stored;
      } else {
        const r = await refreshSession(originalFetch);
        if (r.status === "ok") newToken = r.token;
        else if (r.status === "invalid") {
          await expireSession();
          return res;
        } else return res; // network error: surface the original 401
      }
      return originalFetch(input, withAuthHeader(init, newToken));
    } catch {}
    return res;
  };
}
