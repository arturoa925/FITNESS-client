// Tiny pub/sub so non-React code (the fetch interceptor) can tell React state
// (UserContext) that the session ended.
const listeners = new Set();

export function onSessionExpired(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitSessionExpired() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}
