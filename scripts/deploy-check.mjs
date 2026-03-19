import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const requiredFiles = [
  "package.json",
  "index.html",
  "main.jsx",
  "cafe-chaos.jsx",
  "online-room.js",
  ".env.example",
  ".github/workflows/deploy-pages.yml",
];
const requiredEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

let failed = false;

function ok(message) {
  console.log(`[ok] ${message}`);
}

function warn(message) {
  console.log(`[warn] ${message}`);
}

function fail(message) {
  failed = true;
  console.log(`[fail] ${message}`);
}

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function runGit(command) {
  return execSync(command, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: process.platform === "win32",
  }).trim();
}

console.log("Coffee Chaos deploy check");
console.log(`Workspace: ${root}`);

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) ok(`Found ${rel}`);
  else fail(`Missing ${rel}`);
}

const gitDir = path.join(root, ".git");
if (fs.existsSync(gitDir)) {
  ok("Git repository initialized");
} else {
  fail("Git repository is missing");
}

try {
  let branch = "";
  try {
    branch = runGit("git branch --show-current");
  } catch {
    branch = runGit("git symbolic-ref --short HEAD");
  }
  if (branch === "main") ok("Git branch is main");
  else warn(`Current branch is ${branch || "(none)"}; recommended branch is main`);
} catch {
  warn("Could not detect current git branch");
}

try {
  const remote = runGit("git remote");
  if (remote) ok(`Git remote configured: ${remote}`);
  else warn("No git remote configured yet");
} catch {
  warn("Could not inspect git remotes");
}

try {
  execSync("git rev-parse --verify HEAD", {
    cwd: root,
    stdio: "ignore",
  });
  ok("At least one git commit exists");
} catch {
  warn("No git commit yet; you will need to commit before pushing to GitHub");
}

const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  fail("Missing .env file");
} else {
  ok("Found .env");
  const env = parseEnvFile(envPath);
  for (const key of requiredEnv) {
    const value = env[key];
    if (!value) {
      fail(`Missing ${key} in .env`);
      continue;
    }
    if (value.includes("your-project-ref") || value.includes("your-public-anon-key")) {
      fail(`${key} still has placeholder content`);
      continue;
    }
    ok(`${key} looks configured`);
  }
}

console.log("");
if (failed) {
  console.log("Deploy check failed. Fix the items above, then rerun `npm run check:deploy`.");
  process.exit(1);
} else {
  console.log("Deploy check passed. Next step: commit, push to GitHub, and import into Vercel.");
}
