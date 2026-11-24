// In-memory stand-in for expo-secure-store that records how items were written.
const mem = (globalThis.__secure = globalThis.__secure || new Map());
const opts = (globalThis.__secureOpts = globalThis.__secureOpts || new Map());
exports.getItemAsync = async (k, o) => {
  if (globalThis.__secureReadFails && o?.requireAuthentication) throw new Error("user cancelled");
  return mem.has(k) ? mem.get(k) : null;
};
exports.setItemAsync = async (k, v, o) => {
  mem.set(k, String(v));
  opts.set(k, o || {});
};
exports.deleteItemAsync = async (k) => {
  mem.delete(k);
  opts.delete(k);
};
