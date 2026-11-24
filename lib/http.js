// App-wide handling of expired sessions.
//
// installAuthInterceptor() wraps the global fetch ONCE. For requests to our own API that
// were sent with a Bearer token and come back 401, it ends the session cleanly: wipes the
// account data, resets in-memory state and returns the user to the Welcome screen. Every
// screen is covered without changing each fetch call.
//
// Credential endpoints (/users/login, /users/register, /auth/*) are skipped: a 401 there
// means "wrong credentials", not "session expired".
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

let expiring = null;
export function expireSession() {
  // Many requests can 401 at once; only handle the first.
  if (!expiring) {
    expiring = (async () => {
      try {
        await clearSession();
        emitSessionExpired();
        resetToWelcome({ sessionExpired: true });
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
      if (!getAuthHeader(init, input)) return res; // unauthenticated call, nothing to expire
      await expireSession();
    } catch {}
    return res;
  };
}
