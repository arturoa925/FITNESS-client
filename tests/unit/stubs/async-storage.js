const mem = (globalThis.__async = globalThis.__async || new Map());
const api = {
  getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: async (k, v) => void mem.set(k, v),
  multiRemove: async (keys) => keys.forEach((k) => mem.delete(k)),
};
module.exports = { ...api, default: api };
