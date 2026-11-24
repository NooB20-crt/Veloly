interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
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
