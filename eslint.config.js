// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // node scripts (test harnesses, build helpers)
    files: ["tests/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: require("globals").node },
  },
  {
    // unit tests are written as ES modules (bundled before running)
    files: ["tests/unit/*.test.js"],
    languageOptions: { sourceType: "module", globals: require("globals").node },
  },
  {
    ignores: ["dist/*", "tests/unit/.build/*", "tests/interceptor/http.bundle.js", "tests/**/*.bundle.js"],
  },
]);
