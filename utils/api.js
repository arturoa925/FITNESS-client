// client/utils/api.js
// Single source of truth for the backend URL.
import { Platform } from "react-native";
import Constants from "expo-constants";

const strip = (u) => String(u).trim().replace(/\/+$/, "");

/**
 * Resolution order:
 *  1. EXPO_PUBLIC_API_BASE  (set this for staging/production builds, use https://)
 *  2. expo.extra.API_BASE_URL from app.json, when it isn't a localhost placeholder
 *  3. Dev only: the machine running Metro (so physical devices reach your laptop),
 *     else 10.0.2.2 (Android emulator) / localhost (iOS simulator / web).
 */
export const resolveApiBase = () => {
  const env = (process.env.EXPO_PUBLIC_API_BASE || "").trim();
  if (env) return strip(env);

  const extra = Constants?.expoConfig?.extra?.API_BASE_URL;
  if (extra && !/localhost|127\.0\.0\.1|10\.0\.2\.2/.test(extra)) return strip(extra);

  if (!__DEV__) {
    console.warn(
      "[api] EXPO_PUBLIC_API_BASE is not set for this release build; requests will fail."
    );
  }

  let host = null;
  try {
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.manifest?.debuggerHost;
    if (hostUri) host = String(hostUri).split(":")[0];
  } catch {}

  if (Platform.OS === "android") return `http://${host || "10.0.2.2"}:3004`;
  return `http://${host || "localhost"}:3004`;
};
