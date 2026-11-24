# Face ID login

## Who does what
| Situation | Flow |
|---|---|
| **Existing account, first time on this device** | Sign in with email + password. After success, the app asks "Use Face ID next time?" (once; "Not now" is remembered). Yes → enrolled. |
| **New account** | Welcome → *Create account* (first name, last name, email, password, optional photo, optional "Use Face ID" toggle) → `POST /users/register` → session saved → if the toggle was on, this device is enrolled immediately → Home. |
| **Every later launch** | Welcome auto-prompts Face ID once. Success → Home. Cancel → stay on the screen (password still works, or tap **Login with Face ID**). |
| **After you tap Log out** | No auto-prompt (so logout doesn't instantly log you back in). The Face ID button is still there. |
| **Password changed anywhere** | The server revokes every Face ID device. Next Face ID attempt says "expired, sign in with your password"; you can re-enable it afterwards. |
| **Toggle "Use Face ID" off** | Removes the local token. |

## Security design
- No password is ever stored. The server issues a random 256-bit **device token**; only its SHA-256 hash is in the database.
- On the phone it lives in the iOS Keychain with `requireAuthentication`, so reading it triggers the Face ID prompt (a different enrolled face invalidates it).
- Each use **rotates** the token. Re-using an old one (replay/theft) deletes that device and fails.
- 90-day sliding expiry, max 5 devices per user, rate-limited (20 / 15 min / IP).
- The JWT stays 1 hour; Face ID just gets you a fresh one.

## Files
- Client: `lib/biometric.js` (all logic), `lib/auth.js` (`persistSession`, `clearSession`), `screens/Phase 0/Welcome.js`, `Register.js`.
- Server: `models/BiometricDevices.js`, `controllers/auth.js` (`POST /auth/biometric/enroll`, `POST /auth/biometric/login`, `DELETE /auth/biometric`), revoke-on-password-change in `controllers/users.js`.
- Server tests: 16 new checks in `tests/e2e.js`.

## Testing notes
- **Expo Go on iOS does not support Face ID.** Use a dev build: `npx expo run:ios` (simulator: *Features → Face ID → Enrolled*, then *Matching Face*).
- Auto-prompt can be turned off with `AUTO_PROMPT_BIOMETRIC = false` in `Welcome.js`.
- Deploy the server first. The new `BiometricDevices` table is created automatically by `sequelize.sync()` on boot.

## Sign-in screen behaviour
- **Enrolled device:** Welcome shows "Welcome back", the saved email and one big **Sign in with Face ID** button. The password form is hidden behind "Use password or a different account" (and "Use Face ID instead" brings it back). If Face ID can no longer be used (password changed elsewhere, token expired) the password form appears automatically with an explanation.
- **Not enrolled:** the normal email/password form. After the first successful sign-in (password, Google or GitHub) the app offers to enable Face ID once.
- The old "Use Face ID to login" checkbox on the sign-in screen was removed: enabling now happens at the offer prompt, at registration, or in the profile menu.

## Profile menu
Tap your avatar → **Use Face ID** switch (only shown when the phone supports it). On = Face ID prompt then enroll; Off = revokes this phone on the server and removes the local token. Changing your password re-enrolls this phone automatically so Face ID keeps working.

## Placeholder buttons
The **Apple** and **LinkedIn** buttons on the sign-in screen are intentional placeholders (no handler). Working sign-in methods are email/password, Google and GitHub, each with Face ID on top.
Heads-up for App Store submission only: guideline 4.8 requires Sign in with Apple when an app offers other third-party sign-in, so the Apple button would need to become real (or the Google/GitHub buttons removed) before release.
