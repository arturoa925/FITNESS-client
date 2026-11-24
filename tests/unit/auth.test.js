import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { persistSession, clearSession, normalizeUser } from "../../lib/auth";

const secure = () => globalThis.__secure;
beforeEach(() => {
  secure().clear();
  globalThis.__async.clear();
});

test("normalizeUser maps fields, defaults provider to local and keeps isVerified", () => {
  const u = normalizeUser({ id: "1", email: "a@b.com", firstName: "A", isVerified: true });
  assert.equal(u.id, "1");
  assert.equal(u.provider, "local");
  assert.equal(u.isVerified, true);
  assert.equal(normalizeUser({}).isVerified, null);
  assert.equal(normalizeUser({ userId: "9" }).id, "9");
});

test("persistSession stores everything the app expects", async () => {
  const u = await persistSession({ token: "T", refreshToken: "R", user: { id: "42", email: "Foo@Bar.com", firstName: "F" } });
  assert.equal(secure().get("authToken"), "T");
  assert.equal(secure().get("refreshToken"), "R");
  assert.equal(secure().get("userId"), "42");
  assert.equal(secure().get("lastLoginEmail"), "foo@bar.com");
  assert.equal(JSON.parse(secure().get("cachedUserProfile")).id, "42");
  assert.equal(u.id, "42");
});

test("persistSession without a refresh token does not write one", async () => {
  await persistSession({ token: "T", user: { id: "1" } });
  assert.equal(secure().has("refreshToken"), false);
});

test("clearSession wipes account data and offline caches but keeps device Face ID settings", async () => {
  await persistSession({ token: "T", refreshToken: "R", user: { id: "1", email: "a@b.com" } });
  for (const k of ["accessToken", "token", "providerId", "profilePicture", "programId"]) secure().set(k, "x");
  for (const k of ["currentProgramId", "programsCache", "progress", "pendingOps", "foodsByDate", "unrelated"]) globalThis.__async.set(k, "x");
  // device-level Face ID state must survive a logout
  secure().set("biometricDeviceToken", "dev.token");
  secure().set("biometricEnrolled", "true");
  secure().set("use_biometrics", "true");
  secure().set("biometricEmail", "a@b.com");
  secure().set("lastLoginEmail", "a@b.com");

  await clearSession();

  for (const k of ["authToken", "refreshToken", "userId", "cachedUserProfile", "accessToken", "token", "providerId", "profilePicture", "programId"]) {
    assert.equal(secure().has(k), false, `${k} should be cleared`);
  }
  for (const k of ["currentProgramId", "programsCache", "progress", "pendingOps", "foodsByDate"]) {
    assert.equal(globalThis.__async.has(k), false, `${k} should be cleared`);
  }
  assert.equal(globalThis.__async.has("unrelated"), true, "unrelated AsyncStorage keys are untouched");
  // lastLoginEmail is a deliberate convenience: the sign-in screen pre-fills it after logout
  for (const k of ["lastLoginEmail", "biometricDeviceToken", "biometricEnrolled", "use_biometrics", "biometricEmail"]) {
    assert.equal(secure().has(k), true, `${k} must survive logout`);
  }
});
