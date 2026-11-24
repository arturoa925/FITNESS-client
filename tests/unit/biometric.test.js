import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getBiometricInfo,
  isBiometricEnrolled,
  enrollBiometric,
  biometricLogin,
  disableBiometric,
  offerBiometricEnrollment,
} from "../../lib/biometric";

const secure = () => globalThis.__secure;
let calls;
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const mockFetch = (fn) => {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined });
    return fn(url, init);
  };
};

beforeEach(() => {
  secure().clear();
  globalThis.__secureOpts.clear();
  globalThis.__secureReadFails = false;
  globalThis.__alerts = [];
  globalThis.__alertPick = undefined;
  globalThis.__bio = { hardware: true, enrolled: true, types: [2] };
  calls = [];
});

test("getBiometricInfo: Face ID on iOS, Touch ID, unsupported", async () => {
  assert.deepEqual(await getBiometricInfo(), { supported: true, label: "Face ID" });
  globalThis.__bio = { hardware: true, enrolled: true, types: [1] };
  assert.equal((await getBiometricInfo()).label, "Touch ID");
  globalThis.__bio = { hardware: true, enrolled: false, types: [2] };
  assert.equal((await getBiometricInfo()).supported, false);
  globalThis.__bio = { hardware: false, enrolled: false, types: [] };
  assert.equal((await getBiometricInfo()).supported, false);
});

test("enrollBiometric stores the device token behind biometrics and flags enrollment", async () => {
  mockFetch(() => reply(201, { deviceToken: "dev.secret" }));
  assert.equal(await enrollBiometric("JWT"), true);
  assert.equal(calls[0].url, "http://api.test/auth/biometric/enroll");
  assert.equal(calls[0].init.headers.Authorization, "Bearer JWT");
  assert.equal(secure().get("biometricDeviceToken"), "dev.secret");
  assert.equal(globalThis.__secureOpts.get("biometricDeviceToken").requireAuthentication, true, "token must require Face ID to read");
  assert.equal(await isBiometricEnrolled(), true);
  assert.equal(secure().get("use_biometrics"), "true");
});

test("enrollBiometric: server failure or network error stores nothing", async () => {
  mockFetch(() => reply(500, {}));
  assert.equal(await enrollBiometric("JWT"), false);
  mockFetch(() => { throw new Error("offline"); });
  assert.equal(await enrollBiometric("JWT"), false);
  assert.equal(secure().has("biometricDeviceToken"), false);
  assert.equal(await isBiometricEnrolled(), false);
});

test("biometricLogin: not enrolled -> no prompt, no request", async () => {
  mockFetch(() => reply(200, {}));
  assert.deepEqual(await biometricLogin(), { ok: false, reason: "not_enrolled" });
  assert.equal(calls.length, 0);
});

test("biometricLogin: dismissing Face ID reports 'cancelled' and keeps the token", async () => {
  secure().set("biometricEnrolled", "true");
  secure().set("biometricDeviceToken", "dev.secret");
  globalThis.__secureReadFails = true;
  mockFetch(() => reply(200, {}));
  assert.deepEqual(await biometricLogin(), { ok: false, reason: "cancelled" });
  assert.equal(calls.length, 0);
  assert.equal(secure().get("biometricDeviceToken"), "dev.secret");
});

test("biometricLogin success: sends the token, returns the session and stores the ROTATED token", async () => {
  secure().set("biometricEnrolled", "true");
  secure().set("biometricDeviceToken", "dev.old");
  mockFetch(() => reply(200, { token: "JWT2", refreshToken: "RT2", deviceToken: "dev.new", user: { id: "7" } }));
  const r = await biometricLogin();
  assert.deepEqual(r, { ok: true, token: "JWT2", refreshToken: "RT2", user: { id: "7" } });
  assert.equal(calls[0].url, "http://api.test/auth/biometric/login");
  assert.deepEqual(calls[0].body, { deviceToken: "dev.old" });
  assert.equal(secure().get("biometricDeviceToken"), "dev.new");
  assert.equal(globalThis.__secureOpts.get("biometricDeviceToken").requireAuthentication, true);
});

test("biometricLogin: 401 (revoked/expired/replayed) clears Face ID locally -> password needed", async () => {
  secure().set("biometricEnrolled", "true");
  secure().set("biometricDeviceToken", "dev.old");
  mockFetch(() => reply(401, {}));
  assert.deepEqual(await biometricLogin(), { ok: false, reason: "invalid" });
  assert.equal(secure().has("biometricDeviceToken"), false);
  assert.equal(await isBiometricEnrolled(), false);
});

test("biometricLogin: network error or 5xx keeps Face ID set up", async () => {
  secure().set("biometricEnrolled", "true");
  secure().set("biometricDeviceToken", "dev.old");
  mockFetch(() => { throw new TypeError("Network request failed"); });
  assert.deepEqual(await biometricLogin(), { ok: false, reason: "network" });
  mockFetch(() => reply(503, {}));
  assert.deepEqual(await biometricLogin(), { ok: false, reason: "network" });
  assert.equal(secure().get("biometricDeviceToken"), "dev.old");
  assert.equal(await isBiometricEnrolled(), true);
});

test("disableBiometric with a session revokes on the server and clears the phone", async () => {
  secure().set("biometricEnrolled", "true");
  secure().set("biometricDeviceToken", "dev.x");
  mockFetch(() => reply(200, {}));
  await disableBiometric("JWT");
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].url, "http://api.test/auth/biometric");
  assert.equal(calls[0].init.headers.Authorization, "Bearer JWT");
  assert.equal(secure().has("biometricDeviceToken"), false);
  assert.equal(await isBiometricEnrolled(), false);
  assert.equal(secure().get("use_biometrics"), "false");
});

test("disableBiometric without a session only clears locally (no request)", async () => {
  secure().set("biometricEnrolled", "true");
  secure().set("biometricDeviceToken", "dev.x");
  mockFetch(() => reply(200, {}));
  await disableBiometric(null);
  assert.equal(calls.length, 0);
  assert.equal(secure().has("biometricDeviceToken"), false);
});

test("offerBiometricEnrollment: Enable -> true", async () => {
  globalThis.__alertPick = "Enable";
  assert.equal(await offerBiometricEnrollment("Face ID"), true);
  assert.match(globalThis.__alerts[0].title, /Face ID/);
});

test("offerBiometricEnrollment: 'Not now' -> false and it never asks again", async () => {
  globalThis.__alertPick = "Not now";
  assert.equal(await offerBiometricEnrollment("Face ID"), false);
  assert.equal(secure().get("biometricPromptDismissed"), "true");
  globalThis.__alerts = [];
  assert.equal(await offerBiometricEnrollment("Face ID"), false);
  assert.equal(globalThis.__alerts.length, 0, "must not prompt again after being dismissed");
});
