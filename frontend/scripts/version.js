// Generates src/version.json used by the UI footer badge.
// Runs automatically via prestart / prebuild / pretest (package.json).
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// Fallback chain: git -> env CI (GITHUB_SHA/SOURCE_VERSION) -> version.json lama.
// Build sandbox (mis. Emergent) tidak punya .git; env CI atau file lama
// tetap memberi hash yang bermakna daripada "unknown".
function gitShort() {
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
    if (sha) return sha;
  } catch {
    // no git in sandbox — fall through
  }
  for (const key of ["GITHUB_SHA", "SOURCE_VERSION", "COMMIT_SHA"]) {
    const v = process.env[key];
    if (v) return v.slice(0, 7);
  }
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(root, "src", "version.json"), "utf8"));
    if (prev.commit && prev.commit !== "unknown") return prev.commit;
  } catch {
    // no previous file — fall through
  }
  return "unknown";
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const out = {
  version: pkg.version,
  commit: gitShort(),
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(root, "src", "version.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`version.json -> v${out.version} @ ${out.commit}`);
