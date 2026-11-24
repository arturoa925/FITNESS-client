// `npm test`: build the unit tests, then run them with node's built-in test runner.
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const dir = __dirname;
let r = spawnSync(process.execPath, [path.join(dir, "build.js")], { stdio: "inherit" });
if (r.status) process.exit(r.status);
const files = fs.readdirSync(path.join(dir, ".build")).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, ".build", f));
r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
