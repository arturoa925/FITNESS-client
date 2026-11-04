# FITNESS — Client

A React Native (Expo) fitness app for following structured training programs, generating daily workouts, and logging workouts and food on a calendar. The app is built **offline-first**: sessions, progress, and food logs keep working without a connection and sync back to the server once you're online again.

> This repo is the mobile client. It talks to a separate REST API (default `http://localhost:3004`).

---

## Features

- **Authentication**
  - Email/password registration and login
  - Sign in with Google and GitHub (OAuth through the backend, handled in an in-app WebView)
  - **Face ID / Touch ID** quick login via `expo-local-authentication`
  - **Offline login**: the auth token and a cached user profile are stored in `expo-secure-store`, so `AuthGate` can restore your session immediately and refresh it from the server when it can reach it
- **Training programs**: browse a catalog and enroll in a program:
  - Half Marathon — 8-Week Prep
  - Hybrid / Hypertrophy Split
  - Kettlebell Burner
  - Yoga Foundations — 3-Week Reset
  - Calisthenics Foundations — 4 Weeks
- **Sessions → Today's Session**: walk through your program day by day, view exercise details, and mark workouts complete
- **Daily Grind**: generate a one-off AI workout (`POST /ai/daily-workout`) that isn't tied to a program
- **Calendar**: view completed workouts by month and log or remove foods for any day
- **Profile**: profile photo from the camera or photo library (`expo-image-picker`)
- **Animated loading screen** with haptic feedback

### Offline sync

`components/UserContext.js` is the app's state and sync layer:

1. Every write (completing a workout, adding or deleting a food) updates local state and `AsyncStorage` **first**, so the UI responds instantly.
2. If the request fails or the device is offline, the action goes into a persisted `pendingOps` queue (`COMPLETE_WORKOUT`, `FOOD_ADD`, `FOOD_DELETE`).
3. A `NetInfo` listener replays the queue when connectivity returns. Operations that still fail stay queued for the next attempt.
4. The enrolled program and the programs cache are kept locally as well, so your current program loads without a network.

---

## Tech Stack

| Area | Tools |
| --- | --- |
| Framework | Expo SDK 54, React Native 0.81 (New Architecture enabled), React 19 |
| Navigation | React Navigation 7 (native stack) |
| Styling | `twrnc` (Tailwind for RN), NativeWind, `expo-linear-gradient`, custom fonts (Joan, Manrope, Inter) |
| Networking | `fetch`, Axios (with a bearer-token interceptor) |
| Storage | `expo-secure-store` (tokens, cached profile), `@react-native-async-storage/async-storage` (programs, progress, queue, foods) |
| Connectivity | `@react-native-community/netinfo`, `expo-network` |
| Device APIs | `expo-local-authentication`, `expo-image-picker`, `expo-haptics` |
| UI | `react-native-calendars`, `react-native-svg`, `react-native-webview`, `@react-native-picker/picker` |

---

## Project Structure

```
.
├── App.js                  # Fonts, loading overlay, navigation stack
├── index.js                # Expo entry point
├── app.json                # Expo config (scheme, iOS permissions, API_BASE_URL)
├── components/
│   ├── UserContext.js      # Global state + offline queue / sync
│   ├── logger.js           # Colored console helpers for Metro
│   └── Home/
│       ├── Calendar.js     # Workout + food calendar
│       ├── CurrentWeekBar.js
│       └── ProfilePic.js
├── lib/
│   ├── api.js              # Axios instance with auth interceptor
│   └── auth.js             # SecureStore token helpers
├── utils/
│   └── api.js              # Resolves API base URL per platform
├── screens/
│   ├── Phase 0/            # Onboarding & auth
│   │   ├── Loading.js  AuthGate.js  Welcome.js
│   │   ├── Register.js  GoogleAuth.js  OutsideAuth.js
│   ├── Phase 1/
│   │   └── Home.js         # Dashboard + program catalog
│   ├── Phase 2/
│   │   ├── Sessions.js     # Program sessions list
│   │   └── DailyGrind.js   # AI daily workout
│   └── Phase 3/
│       ├── ProgramDetails.js
│       └── TodaysSession.js
└── assets/                 # Logo, program images, fonts
```

### App flow

```
Loading → AuthGate ─┬─ (no session) → Welcome → Register / Google / GitHub → Home
                    └─ (cached session) ────────────────────────────────→ Home

Home ─┬─ ProgramDetails → enroll
      ├─ Sessions → TodaysSession → mark complete
      ├─ DailyGrind (AI workout)
      └─ Calendar (workouts + foods)
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Xcode (iOS Simulator) and/or Android Studio (Android emulator)
- The FITNESS backend running locally on port **3004**

> Face ID, the image picker, and secure storage use native modules, so a **development build** (`expo run:ios` / `expo run:android`) works best. Expo Go may not support every feature.

### Install & run

```bash
git clone https://github.com/arturoa925/FITNESS-client.git
cd FITNESS-client
npm install

# Start Metro
npm start

# Or build and run natively
npm run ios
npm run android

# Web
npm run web
```

### Configuring the API URL

The app resolves the backend URL in this order (`utils/api.js`):

1. `EXPO_PUBLIC_API_BASE` environment variable
2. Android emulator: `http://10.0.2.2:3004` (the host machine)
3. iOS simulator / web: `http://localhost:3004`

To run on a **physical device**, point the app at your computer's LAN IP:

```bash
# .env.local  (git-ignored)
EXPO_PUBLIC_API_BASE=http://192.168.1.XX:3004
```

`app.json` also defines `extra.API_BASE_URL`, which the Axios client in `lib/api.js` reads.

---

## API Endpoints Used

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/users/register` | Create account |
| POST | `/users/login` | Email/password login |
| POST | `/users/logout` | Log out |
| GET | `/users/me`, `/users/:id` | Fetch / refresh profile |
| GET | `/auth/google`, `/auth/github` | OAuth sign-in |
| GET | `/users/training-programs` | Program catalog |
| GET | `/users/:id/training-programs` | User's current program |
| POST | `/users/:id/program/choose` | Enroll in a program |
| POST | `/users/:id/program/complete` | Complete a program |
| POST | `/users/:id/workouts/complete` | Mark a workout complete |
| GET | `/users/:id/calendar` | Monthly calendar data |
| GET / POST / DELETE | `/users/:id/calendar/foods` | Read / add / remove food entries |
| POST | `/ai/daily-workout` | Generate a daily workout |

Authenticated requests send `Authorization: Bearer <token>`.

---

## Permissions (iOS)

| Key | Reason |
| --- | --- |
| `NSFaceIDUsageDescription` | Quick, secure Face ID login |
| `NSPhotoLibraryUsageDescription` | Choose a profile photo |
| `NSCameraUsageDescription` | Take a profile photo |

---

## Roadmap

- [ ] Consolidate API base URL handling into a single module
- [ ] Use one consistent SecureStore key for the auth token
- [ ] Production bundle identifier and app icon/favicon
- [ ] Consistency / streak view

---

## Author

**Arturo Ayala**: [GitHub](https://github.com/arturoa925) · [LinkedIn](https://linkedin.com/in/arturo-ayala-775493187)
