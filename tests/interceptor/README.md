# Interceptor test (silent refresh / expired session)

Runs the real `lib/http.js` (bundled with in-memory stand-ins for Expo/React Navigation) against a **running, freshly seeded server** and checks: silent refresh + retry, one refresh for parallel 401s, body re-sent, revoked session -> wiped + sent to Welcome, offline refresh keeps the session, login failures aren't treated as expiry.

```bash
# server: seeded DB, JWT_SECRET=testsecret-testsecret-123456, listening on :3099
npm i --no-save esbuild
node tests/interceptor/build.js
SERVER_DIR=/path/to/FITNESS-server BASE_URL=http://localhost:3099 node tests/interceptor/run.js
```
(The build script points the API base at `http://localhost:3099`; edit it for another port.)
