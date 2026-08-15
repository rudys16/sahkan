// Generates src/version.json used by the UI footer badge.
// Runs automatically via prestart / prebuild / pretest (package.json).
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function gitShort() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const out = {
  version: pkg.version,
  commit: gitShort(),
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(root, "src", "version.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`version.json -> v${out.version} @ ${out.commit}`);
