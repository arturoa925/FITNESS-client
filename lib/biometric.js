// Face ID / biometric sign-in.
//
// How it works
//  1. After a normal password (or social) sign-in the app calls enrollBiometric(jwt).
//     The server returns a random long-lived "device token".
//  2. The device token is stored in the OS keychain with requireAuthentication, so
//     reading it makes iOS show the Face ID prompt. No password is ever stored.
//  3. biometricLogin() reads it (Face ID), exchanges it for a fresh 1-hour JWT, and
//     stores the rotated device token the server sends back.
//  4. The server revokes device tokens when the password changes; a 401 here means
//     "sign in with your password again".
import { Alert, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { resolveApiBase } from "../utils/api";

const DEVICE_TOKEN_KEY = "biometricDeviceToken"; // secret, behind Face ID
const ENROLLED_FLAG = "biometricEnrolled"; // non-secret: lets the UI know without prompting
const PROMPT_DISMISSED = "biometricPromptDismissed";

const guarded = (prompt) => ({
  requireAuthentication: true,
  authenticationPrompt: prompt,
});

export async function getBiometricInfo() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const face = types?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return {
      supported: !!(hasHardware && isEnrolled),
      label: face ? (Platform.OS === "ios" ? "Face ID" : "Face unlock") : finger ? "Touch ID" : "Biometrics",
    };
  } catch {
    return { supported: false, label: "Biometrics" };
  }
}

export async function isBiometricEnrolled() {
  try {
    return (await SecureStore.getItemAsync(ENROLLED_FLAG)) === "true";
  } catch {
    return false;
  }
}

async function clearLocalBiometric() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY),
    SecureStore.deleteItemAsync(ENROLLED_FLAG),
  ]);
}

/** Register this device with the server and keep its token behind Face ID. */
export async function enrollBiometric(jwt, label = "Face ID") {
  try {
    const res = await fetch(`${resolveApiBase()}/auth/biometric/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ deviceName: Platform.OS }),
    });
    if (!res.ok) return false;
    const { deviceToken } = await res.json();
    if (!deviceToken) return false;
    await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, deviceToken, guarded(`Enable ${label}`));
    await SecureStore.setItemAsync(ENROLLED_FLAG, "true");
    await SecureStore.setItemAsync("use_biometrics", "true");
    return true;
  } catch (e) {
    console.warn("[biometric] enroll failed:", e?.message);
    return false;
  }
}

/**
 * Prompt Face ID, then exchange the stored device token for a session.
 * Returns { ok: true, token, user } or { ok: false, reason } where reason is one of
 *   "not_enrolled" | "cancelled" | "invalid" (needs password) | "network".
 */
export async function biometricLogin(label = "Face ID") {
  if (!(await isBiometricEnrolled())) return { ok: false, reason: "not_enrolled" };

  let deviceToken = null;
  try {
    // This read is what shows the Face ID prompt.
    deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY, guarded(`Sign in with ${label}`));
  } catch {
    return { ok: false, reason: "cancelled" };
  }
  if (!deviceToken) return { ok: false, reason: "cancelled" };

  let res;
  try {
    res = await fetch(`${resolveApiBase()}/auth/biometric/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceToken }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (res.status === 401) {
    await clearLocalBiometric(); // revoked/expired/rotated away: start over with the password
    return { ok: false, reason: "invalid" };
  }
  if (!res.ok) return { ok: false, reason: "network" };

  const data = await res.json();
  try {
    // Store the rotated token; if this fails the old one is dead, so require the password next time.
    await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, data.deviceToken, guarded(`Sign in with ${label}`));
  } catch {
    await clearLocalBiometric();
  }
  return { ok: true, token: data.token, refreshToken: data.refreshToken, user: data.user };
}

/** Turn Face ID off on this device (and on the server when we have a valid session). */
export async function disableBiometric(jwt) {
  if (jwt) {
    try {
      await fetch(`${resolveApiBase()}/auth/biometric`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({}),
      });
    } catch {}
  }
  await clearLocalBiometric();
  await SecureStore.setItemAsync("use_biometrics", "false");
}

/** After a first successful password sign-in: ask whether to enable Face ID. Resolves true if yes. */
export async function offerBiometricEnrollment(label = "Face ID") {
  try {
    if ((await SecureStore.getItemAsync(PROMPT_DISMISSED)) === "true") return false;
  } catch {}
  return new Promise((resolve) => {
    Alert.alert(
      `Use ${label} next time?`,
      `Sign in faster with ${label}. Your password is never stored on this device.`,
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: async () => {
            try { await SecureStore.setItemAsync(PROMPT_DISMISSED, "true"); } catch {}
            resolve(false);
          },
        },
        { text: `Enable ${label}`, onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });
}
