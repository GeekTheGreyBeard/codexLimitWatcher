const crypto = require("node:crypto");
const http = require("node:http");
const { URL } = require("node:url");
const { authSummary, clearAuth, openAiClaims, readAuth, writeAuth } = require("./authStore");

const ISSUER = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CALLBACK_PORTS = [1455, 1457];
const SCOPE = "openid profile email offline_access api.connectors.read api.connectors.invoke";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function createPkce() {
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function authUrl({ redirectUri, state, challenge }) {
  const url = new URL(`${ISSUER}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", "codex_limit_watcher");
  url.searchParams.set("state", state);
  return url.toString();
}

async function listenForCallback(port, state) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== "/auth/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const actualState = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (actualState !== state) {
        res.writeHead(400);
        res.end("State mismatch. Return to Codex Limit Watcher and try again.");
        reject(new Error("OAuth state mismatch"));
        server.close();
        return;
      }
      if (error) {
        const description = url.searchParams.get("error_description") ?? error;
        res.writeHead(400);
        res.end(`Sign-in failed: ${description}`);
        reject(new Error(description));
        server.close();
        return;
      }
      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received.");
        reject(new Error("No authorization code received"));
        server.close();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>Codex Limit Watcher</title><p>Sign-in complete. You may return to Codex Limit Watcher.</p>");
      resolve(code);
      server.close();
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1");
  });
}

async function withCallbackServer(state, handler) {
  let lastError;
  for (const port of CALLBACK_PORTS) {
    try {
      const redirectUri = `http://localhost:${port}/auth/callback`;
      const callback = listenForCallback(port, state);
      return await handler({ port, redirectUri, callback });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Could not start OAuth callback server");
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString()
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OAuth endpoint returned ${response.status}: ${text.slice(0, 240)}`);
  }
  return JSON.parse(text);
}

function normalizeTokens(tokens) {
  const accessToken = tokens.access_token ?? tokens.accessToken;
  const refreshToken = tokens.refresh_token ?? tokens.refreshToken;
  const idToken = tokens.id_token ?? tokens.idToken;
  if (!accessToken || !refreshToken || !idToken) {
    throw new Error("OAuth response did not include the expected tokens");
  }
  const claims = openAiClaims(accessToken);
  return {
    accessToken,
    refreshToken,
    idToken,
    accountId: claims.chatgpt_account_id ?? null,
    planType: claims.chatgpt_plan_type ?? null,
    expiresAt: Date.now() + Number(tokens.expires_in ?? 3600) * 1000
  };
}

async function exchangeCode({ code, redirectUri, verifier }) {
  return normalizeTokens(await postForm(`${ISSUER}/oauth/token`, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: verifier
  }));
}

async function refreshTokens(auth) {
  const refreshed = normalizeTokens(await postForm(`${ISSUER}/oauth/token`, {
    grant_type: "refresh_token",
    refresh_token: auth.tokens.refreshToken,
    client_id: CLIENT_ID
  }));
  return { ...auth, tokens: refreshed, accountId: refreshed.accountId, lastRefresh: new Date().toISOString() };
}

async function signIn(userDataPath) {
  const pkce = createPkce();
  const state = base64Url(crypto.randomBytes(32));
  return withCallbackServer(state, async ({ redirectUri, callback }) => {
    const { shell } = require("electron");
    await shell.openExternal(authUrl({ redirectUri, state, challenge: pkce.challenge }));
    const code = await callback;
    const tokens = await exchangeCode({ code, redirectUri, verifier: pkce.verifier });
    const auth = { authMode: "chatgpt-oauth", tokens, accountId: tokens.accountId, lastRefresh: new Date().toISOString() };
    writeAuth(userDataPath, auth);
    return authSummary(auth);
  });
}

async function getUsableAuth(userDataPath) {
  const auth = readAuth(userDataPath);
  if (!auth?.tokens?.accessToken) return null;
  if (auth.tokens.expiresAt && auth.tokens.expiresAt - Date.now() > 120000) return auth;
  const refreshed = await refreshTokens(auth);
  writeAuth(userDataPath, refreshed);
  return refreshed;
}

async function fetchCodexUsage(userDataPath) {
  const auth = await getUsableAuth(userDataPath);
  if (!auth) return null;
  const response = await fetch(USAGE_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.tokens.accessToken}`,
      ...(auth.accountId ? { "ChatGPT-Account-Id": auth.accountId } : {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Codex usage endpoint returned ${response.status}: ${text.slice(0, 240)}`);
  }
  return { body: JSON.parse(text), account: authSummary(auth), sourceUrl: USAGE_URL };
}

function signOut(userDataPath) {
  clearAuth(userDataPath);
  return { signedIn: false };
}

function getAuthSummary(userDataPath) {
  return authSummary(readAuth(userDataPath));
}

module.exports = {
  CLIENT_ID,
  ISSUER,
  SCOPE,
  USAGE_URL,
  authUrl,
  fetchCodexUsage,
  getAuthSummary,
  signIn,
  signOut
};
