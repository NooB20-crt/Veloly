interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  DISCORD_FEEDBACK_WEBHOOK_URL?: string;
}

// Cloudflare Workers currently caps PBKDF2 at 100,000 iterations per deriveBits call.
const PASSWORD_ITERATIONS = 100_000;
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const AUTH_WINDOW_SECONDS = 15 * 60;

interface UserRow { id: string; username: string; password_hash: string }
interface SessionRow { user_id: string; username: string; expires_at: number }
interface ProfileRow { username: string; profile_description: string; favorite_music: string; avatar_data: string | null; username_changed_at: number }
const USERNAME_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

const allowedOrigins = new Set([
  "https://noob20-crt.github.io",
  "https://zyndrax707.github.io",
  "tauri://localhost",
  "https://tauri.localhost",
  "http://tauri.localhost",
  "http://localhost:1420",
]);

function responseJson(data: unknown, status = 200, origin: string | null = null, extra: HeadersInit = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function sameSecret(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

async function hashInstallId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function passwordHash(password: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, rounds, saltText, expectedText, extra] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || rounds !== String(PASSWORD_ITERATIONS) || !saltText || !expectedText || extra !== undefined) return false;
  const actual = await passwordHashWithSalt(password, fromBase64Url(saltText));
  const expected = fromBase64Url(expectedText);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

async function passwordHashWithSalt(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256));
}

async function sessionTokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

function secureToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(username) ? username : null;
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && Array.from(value).length >= 12 && Array.from(value).length <= 128 && new TextEncoder().encode(value).length <= 512;
}

function validProfileText(value: unknown, max: number): value is string {
  return typeof value === "string" && Array.from(value).length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function validAvatar(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 100_000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const bytes = atob(value.slice("data:image/webp;base64,".length));
    return bytes.length <= 72_000 && bytes.slice(0, 4) === "RIFF" && bytes.slice(8, 12) === "WEBP";
  } catch {
    return false;
  }
}

function publicProfile(row: ProfileRow) {
  return {
    username: row.username,
    description: row.profile_description,
    favoriteMusic: row.favorite_music,
    avatarData: row.avatar_data,
    usernameChangeAvailableAt: row.username_changed_at ? (row.username_changed_at + USERNAME_COOLDOWN_SECONDS) * 1000 : 0,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function publicProfilePage(row: ProfileRow): Response {
  const username = escapeHtml(row.username);
  const description = escapeHtml(row.profile_description || "Profil Veloly");
  const favorite = escapeHtml(row.favorite_music || "—");
  const avatar = row.avatar_data && validAvatar(row.avatar_data)
    ? `<img class="avatar" src="${row.avatar_data}" alt="Photo de ${username}">`
    : `<div class="avatar empty" aria-label="Photo de profil par défaut"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg></div>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080510"><title>${username} · Veloly</title><style>
    :root{color-scheme:dark;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;background:#080510;color:#f5f3fa}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#28113a 0,transparent 55%),#080510}main{width:min(520px,100%);padding:30px;border:1px solid #ffffff1c;border-radius:26px;background:#120d1bef;box-shadow:0 28px 90px #0009;text-align:center}.avatar{width:116px;height:116px;margin:0 auto 20px;border-radius:50%;object-fit:cover;background:#777;box-shadow:0 0 0 4px #ffffff16}.empty{display:grid;place-items:center;color:#ddd}.empty svg{width:52px;height:52px;stroke:currentColor;stroke-width:1.5}h1{margin:0;font-size:27px;overflow-wrap:anywhere}p{margin:10px 0;color:#bbb6c7;line-height:1.6;overflow-wrap:anywhere}.favorite{margin-top:20px;padding:14px 16px;border-radius:16px;background:#ffffff0c;text-align:left}.favorite small{display:block;margin-bottom:5px;color:#988fa4;font-size:11px;letter-spacing:.12em;text-transform:uppercase}.favorite strong{font-weight:600}a{display:inline-flex;margin-top:24px;padding:10px 18px;border-radius:999px;background:#8a20df;color:white;text-decoration:none;font-weight:700}
  </style></head><body><main>${avatar}<h1>${username}</h1><p>${description}</p><div class="favorite"><small>Musique préférée</small><strong>${favorite}</strong></div><a href="https://zyndrax707.github.io/Veloly/">Découvrir Veloly</a></main></body></html>`;
  return new Response(html, { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'",
  } });
}

async function readJson(request: Request, maxBytes = 2_048): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) return null;
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function playlistSlug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "playlist";
}

function shareId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sharedPlaylistPage(name: string, owner: string, tracks: SharedTrack[]): Response {
  const rows = tracks.map((track, index) => `<li><span>${index + 1}</span><div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}${track.album ? ` · ${escapeHtml(track.album)}` : ""}</small></div></li>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080510"><title>${escapeHtml(name)} · Playlist Veloly</title><style>
    :root{color-scheme:dark;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;background:#080510;color:#f5f3fa}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(ellipse at 50% 0%,#35104d 0,transparent 58%),#080510}.card{width:min(680px,100%);padding:28px;border:1px solid #ffffff20;border-radius:24px;background:#120d1bef;box-shadow:0 28px 90px #0009}.eyebrow{color:#d17aff;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{margin:8px 0 4px;font-size:clamp(25px,6vw,40px);overflow-wrap:anywhere}.by{margin:0 0 22px;color:#aaa3b5;font-size:14px}ol{display:grid;gap:2px;max-height:55vh;overflow:auto;margin:0;padding:0;list-style:none}li{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:10px 8px;border-bottom:1px solid #ffffff0c}li>span{color:#888096;font-size:12px;text-align:center}li div{display:grid;gap:3px;min-width:0}li strong,li small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}li strong{font-size:14px}li small{color:#aaa3b5;font-size:12px}.foot{margin-top:22px;padding:12px 14px;border-radius:14px;background:#ffffff0c;color:#bdb6c9;font-size:12px;line-height:1.5}.brand{margin-top:18px;color:#d17aff;font-size:12px;font-weight:700}
  </style></head><body><main class="card"><div class="eyebrow">Playlist partagée · Veloly</div><h1>${escapeHtml(name)}</h1><p class="by">Partagée par ${escapeHtml(owner)} · ${tracks.length} morceaux</p><ol>${rows}</ol><p class="foot">Pour l’ajouter à ta collection, ouvre Veloly, choisis « Importer une playlist » et colle ce lien. Les fichiers locaux du créateur ne sont pas inclus ; Veloly cherchera ces titres dans les catalogues disponibles.</p><div class="brand">Veloly · musique, à ta façon</div></main></body></html>`;
  return new Response(html, { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  } });
}

interface SharedTrack { source: "deezer" | "youtube" | "jamendo" | "metadata"; remoteId: string | null; title: string; artist: string; album: string | null; duration: number | null }
interface SharedPlaylistRow { share_id: string; owner_id: string; playlist_name: string; tracks_json: string; created_at: number; username: string }

async function findSharedPlaylist(env: Env, id: string): Promise<{ row: SharedPlaylistRow; tracks: SharedTrack[] } | null> {
  const row = await env.DB.prepare("SELECT shared_playlists.share_id, shared_playlists.owner_id, shared_playlists.playlist_name, shared_playlists.tracks_json, shared_playlists.created_at, users.username FROM shared_playlists JOIN users ON users.id = shared_playlists.owner_id WHERE shared_playlists.share_id = ?")
    .bind(id).first<SharedPlaylistRow>();
  if (!row) return null;
  try {
    const tracks: unknown = JSON.parse(row.tracks_json);
    return Array.isArray(tracks) ? { row, tracks: tracks as SharedTrack[] } : null;
  } catch { return null; }
}

function authError(code: string, status: number, origin: string | null) {
  return responseJson({ error: code }, status, origin);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{40,60})$/.exec(authorization);
  return match?.[1] ?? null;
}

async function rateLimit(env: Env, key: string, maxAttempts: number, now: number): Promise<boolean> {
  const rateKey = await hashInstallId(key);
  await env.DB.prepare(
    "INSERT INTO auth_rate_limits (rate_key, window_started, attempts) VALUES (?, ?, 1) ON CONFLICT(rate_key) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started = CASE WHEN auth_rate_limits.window_started <= ? THEN excluded.window_started ELSE auth_rate_limits.window_started END",
  ).bind(rateKey, now, now - AUTH_WINDOW_SECONDS, now - AUTH_WINDOW_SECONDS).run();
  const current = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE rate_key = ?")
    .bind(rateKey).first<{ attempts: number }>();
  return (current?.attempts ?? maxAttempts + 1) <= maxAttempts;
}

async function issueSession(env: Env, user: UserRow, origin: string | null): Promise<Response> {
  const token = secureToken();
  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await sessionTokenHash(token);
  await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, user.id, now + SESSION_SECONDS).run();
  return responseJson({ token, username: user.username, expiresAt: now + SESSION_SECONDS }, 200, origin);
}

async function authenticatedUser(env: Env, request: Request): Promise<SessionRow | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = await sessionTokenHash(token);
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    "SELECT auth_sessions.user_id, users.username, auth_sessions.expires_at FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?",
  ).bind(tokenHash, now).first<SessionRow>();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) return responseJson({ error: "origin_not_allowed" }, 403);

    if (request.method === "OPTIONS") {
      if (!origin || !allowedOrigins.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, PUT, DELETE, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/shared-playlists") {
      const user = await authenticatedUser(env, request);
      if (!user) return authError("unauthorized", 401, origin);
      const now = Math.floor(Date.now() / 1000);
      if (!await rateLimit(env, `share:${user.user_id}`, 12, now)) return authError("rate_limited", 429, origin);
      const body = await readJson(request, 180_000);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const inputTracks = body?.tracks;
      if (!name || Array.from(name).length > 120 || !Array.isArray(inputTracks) || inputTracks.length < 1 || inputTracks.length > 300) {
        return authError("invalid_shared_playlist", 400, origin);
      }
      const tracks: SharedTrack[] = [];
      for (const item of inputTracks) {
        if (typeof item !== "object" || item === null) return authError("invalid_shared_playlist", 400, origin);
        const track = item as Record<string, unknown>;
        const title = typeof track.title === "string" ? track.title.trim() : "";
        const artist = typeof track.artist === "string" ? track.artist.trim() : "";
        const album = typeof track.album === "string" ? track.album.trim() : null;
        const source = track.source;
        const remoteId = typeof track.remoteId === "string" ? track.remoteId.trim() : null;
        const duration = typeof track.duration === "number" && Number.isFinite(track.duration) && track.duration >= 0 && track.duration <= 86_400 ? track.duration : null;
        if (!title || !artist || Array.from(title).length > 300 || Array.from(artist).length > 300 || (album !== null && Array.from(album).length > 300)) {
          return authError("invalid_shared_playlist", 400, origin);
        }
        const canUseRemoteId = (source === "deezer" || source === "youtube" || source === "jamendo") && remoteId !== null && remoteId.length <= 200;
        tracks.push({ source: canUseRemoteId ? source : "metadata", remoteId: canUseRemoteId ? remoteId : null, title, artist, album: album || null, duration });
      }
      const id = shareId();
      await env.DB.prepare("INSERT INTO shared_playlists (share_id, owner_id, playlist_name, tracks_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, user.user_id, name, JSON.stringify(tracks), now).run();
      return responseJson({ url: new URL(`/s/${playlistSlug(name)}-${id}`, url.origin).toString() }, 201, origin);
    }

    const sharedApi = /^\/v1\/shared-playlists\/([a-f0-9]{24})$/.exec(url.pathname);
    if (request.method === "GET" && sharedApi) {
      const shared = await findSharedPlaylist(env, sharedApi[1]);
      if (!shared) return authError("shared_playlist_not_found", 404, origin);
      return responseJson({ name: shared.row.playlist_name, owner: shared.row.username, tracks: shared.tracks }, 200, origin);
    }

    if (request.method === "GET" && url.pathname.startsWith("/s/")) {
      const segment = url.pathname.slice(3);
      const match = /(?:^|-)([a-f0-9]{24})$/i.exec(segment);
      const id = match?.[1] ?? null;
      if (!id) return new Response("Lien de playlist invalide.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      const shared = await findSharedPlaylist(env, id);
      if (!shared) return new Response("Cette playlist n'existe plus.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return sharedPlaylistPage(shared.row.playlist_name, shared.row.username, shared.tracks);
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/register") {
      const body = await readJson(request);
      if (!body) return authError("invalid_request", 400, origin);
      const username = normalizeUsername(body.username);
      if (!username) return authError("invalid_username", 400, origin);
      if (!validPassword(body.password)) return authError("weak_password", 400, origin);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const now = Math.floor(Date.now() / 1000);
      if (!await rateLimit(env, `register:${ip}`, 5, now)) return authError("rate_limited", 429, origin);

      // Every account gets a random salt and a deliberately expensive PBKDF2 hash;
      // the password itself is never written to D1 or returned to the client.
      const user: UserRow = { id: crypto.randomUUID(), username, password_hash: await passwordHash(body.password) };
      try {
      await env.DB.prepare("INSERT INTO users (id, username, password_hash, created_at, username_changed_at) VALUES (?, ?, ?, ?, ?)")
          .bind(user.id, user.username, user.password_hash, now, now).run();
      } catch {
        // Keep the response generic; only the account owner needs to know whether creation succeeded.
        return authError("account_name_unavailable", 409, origin);
      }
      await env.DB.prepare("DELETE FROM auth_rate_limits WHERE rate_key = ?").bind(await hashInstallId(`register:${ip}`)).run();
      return issueSession(env, user, origin);
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/login") {
      const body = await readJson(request);
      if (!body) return authError("invalid_request", 400, origin);
      const username = normalizeUsername(body.username);
      if (!username || typeof body.password !== "string" || body.password.length > 128) return authError("login_failed", 401, origin);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const now = Math.floor(Date.now() / 1000);
      if (!await rateLimit(env, `login:${username}:${ip}`, 8, now)) return authError("rate_limited", 429, origin);
      const user = await env.DB.prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
        .bind(username).first<UserRow>();
      if (!user) {
        // Spend comparable password-hash work so unknown names do not get a fast response.
        await passwordHashWithSalt(body.password, new Uint8Array([43, 198, 17, 94, 211, 8, 72, 161, 5, 99, 177, 32, 247, 66, 14, 151]));
        return authError("login_failed", 401, origin);
      }
      if (!await verifyPassword(body.password, user.password_hash)) return authError("login_failed", 401, origin);
      await env.DB.prepare("DELETE FROM auth_rate_limits WHERE rate_key = ?").bind(await hashInstallId(`login:${username}:${ip}`)).run();
      return issueSession(env, user, origin);
    }

    if (request.method === "GET" && url.pathname === "/v1/auth/me") {
      const user = await authenticatedUser(env, request);
      if (!user) return authError("unauthorized", 401, origin);
      const profile = await env.DB.prepare("SELECT username, profile_description, favorite_music, avatar_data, username_changed_at FROM users WHERE id = ?")
        .bind(user.user_id).first<ProfileRow>();
      return profile ? responseJson(publicProfile(profile), 200, origin) : authError("unauthorized", 401, origin);
    }

    if (request.method === "PUT" && url.pathname === "/v1/profile/me") {
      const user = await authenticatedUser(env, request);
      if (!user) return authError("unauthorized", 401, origin);
      if (Number(request.headers.get("Content-Length") ?? 0) > 130_000) return authError("profile_too_large", 413, origin);
      const body = await readJson(request, 130_000);
      if (!body) return authError("invalid_request", 400, origin);
      const username = normalizeUsername(body.username);
      if (!username) return authError("invalid_username", 400, origin);
      const description = typeof body.description === "string" ? body.description.trim() : null;
      const favoriteMusic = typeof body.favoriteMusic === "string" ? body.favoriteMusic.trim() : null;
      if (description === null || !validProfileText(description, 300)) return authError("invalid_profile_description", 400, origin);
      if (favoriteMusic === null || !validProfileText(favoriteMusic, 120)) return authError("invalid_favorite_music", 400, origin);
      if (!validAvatar(body.avatarData)) return authError("invalid_avatar", 400, origin);

      const now = Math.floor(Date.now() / 1000);
      const current = await env.DB.prepare("SELECT username_changed_at FROM users WHERE id = ?")
        .bind(user.user_id).first<{ username_changed_at: number }>();
      if (!current) return authError("unauthorized", 401, origin);
      const renamed = username !== user.username;
      if (renamed && current.username_changed_at + USERNAME_COOLDOWN_SECONDS > now) {
        return responseJson({ error: "username_cooldown", availableAt: (current.username_changed_at + USERNAME_COOLDOWN_SECONDS) * 1000 }, 429, origin);
      }
      try {
        await env.DB.prepare(
          "UPDATE users SET username = ?, profile_description = ?, favorite_music = ?, avatar_data = ?, username_changed_at = CASE WHEN ? THEN ? ELSE username_changed_at END WHERE id = ?",
        ).bind(username, description, favoriteMusic, body.avatarData, renamed ? 1 : 0, now, user.user_id).run();
      } catch {
        return authError("account_name_unavailable", 409, origin);
      }
      const updated = await env.DB.prepare("SELECT username, profile_description, favorite_music, avatar_data, username_changed_at FROM users WHERE id = ?")
        .bind(user.user_id).first<ProfileRow>();
      return updated ? responseJson(publicProfile(updated), 200, origin) : authError("profile_update_failed", 500, origin);
    }

    if (request.method === "GET" && url.pathname.startsWith("/v1/profiles/")) {
      let requested: string;
      try { requested = decodeURIComponent(url.pathname.slice("/v1/profiles/".length)); } catch { return authError("profile_not_found", 404, origin); }
      const username = normalizeUsername(requested);
      if (!username) return authError("profile_not_found", 404, origin);
      const profile = await env.DB.prepare("SELECT username, profile_description, favorite_music, avatar_data, username_changed_at FROM users WHERE username = ?")
        .bind(username).first<ProfileRow>();
      return profile ? responseJson(publicProfile(profile), 200, origin) : authError("profile_not_found", 404, origin);
    }

    if (request.method === "GET" && url.pathname.startsWith("/p/")) {
      let requested: string;
      try { requested = decodeURIComponent(url.pathname.slice(3)); } catch { return responseJson({ error: "profile_not_found" }, 404, origin); }
      const username = normalizeUsername(requested);
      if (!username) return responseJson({ error: "profile_not_found" }, 404, origin);
      const profile = await env.DB.prepare("SELECT username, profile_description, favorite_music, avatar_data, username_changed_at FROM users WHERE username = ?")
        .bind(username).first<ProfileRow>();
      return profile ? publicProfilePage(profile) : responseJson({ error: "profile_not_found" }, 404, origin);
    }

    if (request.method === "DELETE" && url.pathname === "/v1/auth/session") {
      const token = bearerToken(request);
      if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sessionTokenHash(token)).run();
      return responseJson({ loggedOut: true }, 200, origin);
    }

    if ((request.method === "POST" || request.method === "DELETE") && url.pathname === "/v1/first-launch") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return responseJson({ error: "invalid_json" }, 400, origin);
      }
      const id = typeof body === "object" && body !== null && "installId" in body
        ? (body as { installId?: unknown }).installId
        : null;
      if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return responseJson({ error: "invalid_install_id" }, 400, origin);
      }
      const hash = await hashInstallId(id);
      if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM installs WHERE install_hash = ?").bind(hash).run();
        return responseJson({ deleted: true }, 200, origin);
      }
      const result = await env.DB.prepare(
        "INSERT INTO installs (install_hash, first_seen) VALUES (?, ?) ON CONFLICT(install_hash) DO NOTHING",
      ).bind(hash, Math.floor(Date.now() / 1000)).run();
      return responseJson({ recorded: (result.meta.changes ?? 0) > 0 }, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/v1/feedback") {
      if (!env.DISCORD_FEEDBACK_WEBHOOK_URL) return responseJson({ error: "feedback_unavailable" }, 503, origin);
      let body: unknown;
      try {
        if (Number(request.headers.get("Content-Length") ?? 0) > 12_000) return responseJson({ error: "message_too_long" }, 413, origin);
        body = await request.json();
      } catch {
        return responseJson({ error: "invalid_json" }, 400, origin);
      }
      const value = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      const category = value.category;
      const message = typeof value.message === "string" ? value.message.trim() : "";
      const version = typeof value.version === "string" && /^[0-9][0-9A-Za-z.+-]{0,30}$/.test(value.version) ? value.version : "unknown";
      const clientId = value.clientId;
      if (category !== "idea" && category !== "bug" && category !== "other") return responseJson({ error: "invalid_category" }, 400, origin);
      if (message.length < 8 || message.length > 1500) return responseJson({ error: "invalid_message_length" }, 400, origin);
      if (typeof clientId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
        return responseJson({ error: "invalid_client_id" }, 400, origin);
      }
      let webhook: URL;
      try {
        webhook = new URL(env.DISCORD_FEEDBACK_WEBHOOK_URL);
      } catch {
        return responseJson({ error: "feedback_unavailable" }, 503, origin);
      }
      if (webhook.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(webhook.hostname) || !webhook.pathname.startsWith("/api/webhooks/")) {
        return responseJson({ error: "feedback_unavailable" }, 503, origin);
      }

      const hash = await hashInstallId(clientId);
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("DELETE FROM feedback_rate_limits WHERE last_sent < ?").bind(now - 86_400).run();
      const previous = await env.DB.prepare("SELECT last_sent FROM feedback_rate_limits WHERE client_hash = ?").bind(hash).first<{ last_sent: number }>();
      if (previous && now - previous.last_sent < 60) return responseJson({ error: "rate_limited" }, 429, origin);

      let sent: Response;
      try {
        sent = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `**Veloly feedback · ${category}**\n**Version:** ${version}\n\n${message}`,
            allowed_mentions: { parse: [] },
          }),
        });
      } catch {
        return responseJson({ error: "discord_unavailable" }, 502, origin);
      }
      if (!sent.ok) return responseJson({ error: "discord_unavailable" }, 502, origin);
      await env.DB.prepare(
        "INSERT INTO feedback_rate_limits (client_hash, last_sent) VALUES (?, ?) ON CONFLICT(client_hash) DO UPDATE SET last_sent = excluded.last_sent",
      ).bind(hash, now).run();
      return responseJson({ sent: true }, 200, origin);
    }

    if (request.method === "GET" && url.pathname === "/v1/admin/stats") {
      const authorization = request.headers.get("Authorization") ?? "";
      const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!env.ADMIN_TOKEN || !sameSecret(supplied, env.ADMIN_TOKEN)) {
        return responseJson({ error: "unauthorized" }, 401, origin, { "WWW-Authenticate": "Bearer" });
      }
      const [total, recent] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total FROM installs").first<{ total: number }>(),
        env.DB.prepare(
          "SELECT date(first_seen, 'unixepoch') AS day, COUNT(*) AS count FROM installs GROUP BY day ORDER BY day DESC LIMIT 30",
        ).all<{ day: string; count: number }>(),
      ]);
      return responseJson({ total: total?.total ?? 0, recent: recent.results }, 200, origin);
    }

    return responseJson({ error: "not_found" }, 404, origin);
  },
};
