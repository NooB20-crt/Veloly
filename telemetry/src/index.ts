interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  DISCORD_FEEDBACK_WEBHOOK_URL?: string;
}

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
          "Access-Control-Allow-Methods": "POST, DELETE, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
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
