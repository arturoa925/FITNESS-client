// Bundles every tests/unit/*.test.js (+ the real lib/ code) with stand-ins for the Expo /
// React Native modules, into .build/, so they run on plain Node's test runner.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const stubs = path.join(__dirname, "stubs");
const map = [
  [/^expo-secure-store$/, "secure-store.js"],
  [/^@react-native-async-storage\/async-storage$/, "async-storage.js"],
  [/^react-native$/, "react-native.js"],
  [/^expo-local-authentication$/, "local-authentication.js"],
  [/utils\/api$/, "api.js"],
];
const plugin = {
  name: "native-stubs",
  setup(b) {
    for (const [filter, file] of map) {
      b.onResolve({ filter }, () => ({ path: path.join(stubs, file) }));
    }
  },
};

const outdir = path.join(__dirname, ".build");
fs.rmSync(outdir, { recursive: true, force: true });
const entries = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).map((f) => path.join(__dirname, f));
esbuild
  .build({ entryPoints: entries, bundle: true, platform: "node", format: "cjs", outdir, plugins: [plugin], logLevel: "error" })
  .then(() => console.log(`built ${entries.length} test file(s)`));
