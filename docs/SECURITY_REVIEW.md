# Security & bug review — client changes

Branch: `claude/determined-lovelace-lxs1ad`. Server-side changes and the full write-up are in the server repo (`docs/SECURITY_REVIEW.md`).

**Verification:** every changed file was syntax-checked (esbuild/JSX). The app itself was **not run** (no simulator/device here), so please smoke-test login, logout, Google/GitHub sign-in, calendar/foods and Face ID quick-login.

## Fixed
| Problem | Fix |
|---|---|
| Backend URL hard-coded to `http://localhost` / `10.0.2.2` in ~10 places (Home, CurrentWeekBar, ProfilePic ×3, GoogleAuth, UserContext, Welcome…) plus three divergent copies of `resolveApiBase`. A release build could never reach a server. | One `resolveApiBase()` in `utils/api.js` (`EXPO_PUBLIC_API_BASE` → non-localhost `extra.API_BASE_URL` → dev-machine host). All call sites use it. **Set `EXPO_PUBLIC_API_BASE=https://…` for release builds.** |
| Logout left `userId`, `cachedUserProfile`, programs/progress/foods and the offline queue on the device → next user saw (and synced) the previous user's data. | `clearSession()` (`lib/auth.js`) wipes account SecureStore + AsyncStorage keys; `resetLocalState()` in `UserContext` resets memory; used by Home logout and ProfilePic fallback. Logout no longer fails if the network call fails. Biometric opt-in is kept (device preference). |
| `AuthGate` opened Home on a dead (401/403) token. | Clears the session and returns to Welcome. (Works now because the server returns 401.) |
| `UserContext` effect's deps array referenced `syncPendingOps` before its `const` (TDZ; worked only because Babel downlevels `const`). | Effect moved below the definition. |
| JWT printed to the console (`Welcome.js` Google/GitHub/login logs). | Logs `hasToken` instead. |
| `makeRedirectUri({ useProxy: true })` (option removed from expo-auth-session). | `makeRedirectUri({ scheme: "arturofit", path: "oauth-complete" })` → `exp://…` in Expo Go, `arturofit://oauth-complete` in builds (both allowed by the server). |
| `GoogleAuth.js` WebView screen could never work (token is in the URL fragment, success URLs never produced, Google blocks WebView OAuth). | Screen, route and the `react-native-webview` dependency removed (it stays in the lockfile only as an Expo peer). |
| Dead/inconsistent code: `lib/api.js` (unused), `lib/auth.js` used a different token key, stray `package-lock 2.json`. | Removed / aligned on `authToken`. |

## Not fixed
- Release identifiers are placeholders (`com.anonymous.client`, app name `client`) — set real ones before App Store submission.
- Biometrics only gate the login screen, not cold start with a saved token.
- `AsyncStorage.setItem` is called inside `setState` updaters in `UserContext` (can double-run in StrictMode / write out of order).
- Client `npm audit` shows 38 advisories (mostly Expo tooling); not changed because fixes mean an Expo SDK upgrade.
- Screens other than AuthGate don't yet react to a 401 mid-session (they just show their error state).
- No lint yet.

## Update: session handling
- Access tokens are now **15 minutes**; a rotating **refresh token** (30 days, sliding) keeps users signed in. `lib/http.js` refreshes silently on a 401 and retries the request; only if the refresh token is gone/revoked/expired does the app wipe the session and return to Welcome. A network failure while refreshing keeps the user signed in.
- Logout, password change and Face ID all go through the same session model (see the server's `docs/SECURITY_REVIEW.md`).
- Test: `tests/interceptor/` (14 checks).

## Update: CI
`.github/workflows/build-check.yml` runs `npm ci` and `npx expo export --platform ios` on every push/PR: it compiles the whole app into a real Hermes bundle, catching broken imports/syntax without a simulator. (Verified locally: `npm ci` + export succeed.) Dependabot is enabled for npm and Actions.
