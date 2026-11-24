import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The app stores the JWT under this key everywhere (screens read it directly).
const TOKEN_KEY = "authToken";

// Everything tied to the signed-in account. Device preferences such as the
// biometrics opt-in are intentionally NOT cleared.
const SECURE_SESSION_KEYS = [
  TOKEN_KEY,
  "accessToken",
  "token",
  "refreshToken",
  "userId",
  "providerId",
  "profilePicture",
  "cachedUserProfile",
  "programId",
];
const ASYNC_SESSION_KEYS = [
  "currentProgramId",
  "programsCache",
  "progress",
  "pendingOps",
  "foodsByDate",
];

export async function setToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(TOKEN_KEY, String(token));
}
export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Wipe all per-account data from the device (tokens, cached profile, offline
 * queue, cached foods/progress). Without this, the next person to sign in on
 * the same device would see (and sync) the previous user's data.
 */
export async function clearSession() {
  await Promise.allSettled([
    ...SECURE_SESSION_KEYS.map((k) => SecureStore.deleteItemAsync(k)),
    AsyncStorage.multiRemove(ASYNC_SESSION_KEYS),
  ]);
}

/** Shape used by UserContext everywhere. */
export function normalizeUser(u = {}) {
  return {
    id: u.id || u.userId || null,
    email: u.email || null,
    firstName: u.firstName || null,
    lastName: u.lastName || null,
    profilePicture: u.profilePicture || null,
    provider: u.provider || "local",
    raw: u,
  };
}

/** Persist everything the rest of the app expects after a successful sign-in. */
export async function persistSession({ token, user }) {
  const u = normalizeUser(user);
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, String(token));
  if (u.id) await SecureStore.setItemAsync("userId", String(u.id));
  if (u.email) await SecureStore.setItemAsync("lastLoginEmail", String(u.email).toLowerCase());
  await SecureStore.setItemAsync("cachedUserProfile", JSON.stringify(u));
  return u;
}
