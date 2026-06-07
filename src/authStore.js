const fs = require("node:fs");
const path = require("node:path");

const AUTH_FILE = "auth.json";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

function authFilePath(userDataPath) {
  return path.join(userDataPath, AUTH_FILE);
}

function readAuth(userDataPath) {
  const filePath = authFilePath(userDataPath);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeAuth(userDataPath, auth) {
  ensureDir(userDataPath);
  const filePath = authFilePath(userDataPath);
  fs.writeFileSync(filePath, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function clearAuth(userDataPath) {
  const filePath = authFilePath(userDataPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string") return {};
  const [, payload] = jwt.split(".");
  if (!payload) return {};
  try {
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function openAiClaims(jwt) {
  const payload = decodeJwtPayload(jwt);
  return payload["https://api.openai.com/auth"] ?? payload;
}

function authSummary(auth) {
  if (!auth?.tokens) return { signedIn: false };
  const claims = openAiClaims(auth.tokens.accessToken ?? auth.tokens.access_token);
  return {
    signedIn: true,
    accountId: auth.accountId ?? claims.chatgpt_account_id ?? null,
    planType: claims.chatgpt_plan_type ?? null,
    lastRefresh: auth.lastRefresh ?? null
  };
}

module.exports = {
  authFilePath,
  authSummary,
  clearAuth,
  decodeJwtPayload,
  openAiClaims,
  readAuth,
  writeAuth
};
