import type { Track } from "./api";

const endpoint = (import.meta.env.VITE_VELOLY_TELEMETRY_URL as string | undefined)?.trim().replace(/\/$/, "");

export type SharedPlaylistTrack = {
  source: "deezer" | "youtube" | "jamendo" | "metadata";
  remoteId: string | null;
  title: string;
  artist: string;
  album: string | null;
  duration: number | null;
};
export type SharedPlaylist = { name: string; owner: string; tracks: SharedPlaylistTrack[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!endpoint) throw new Error("service_unavailable");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${endpoint}${path}`, { ...init, headers, cache: "no-store", redirect: "error" });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "network_error");
  return result;
}

export async function createPlaylistShareLink(name: string, tracks: Track[]): Promise<string> {
  const shareTracks: SharedPlaylistTrack[] = tracks.map((track) => {
    const remoteId = track.location.kind === "remote" ? track.location.remoteId : null;
    const canShareRemote = (track.source === "deezer" || track.source === "youtube" || track.source === "jamendo")
      && !!remoteId && remoteId.length <= 200;
    return {
      source: canShareRemote ? track.source as SharedPlaylistTrack["source"] : "metadata",
      remoteId: canShareRemote ? remoteId : null,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
    };
  });
  const result = await request<{ url: string }>("/v1/shared-playlists", {
    method: "POST",
    body: JSON.stringify({ name, tracks: shareTracks }),
  });
  return result.url;
}

export async function fetchSharedPlaylist(url: string): Promise<SharedPlaylist | null> {
  if (!endpoint) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.origin !== new URL(endpoint).origin) return null;
  const segment = parsed.pathname.startsWith("/s/") ? parsed.pathname.slice(3) : "";
  const match = /(?:^|-)([a-f0-9]{24})$/i.exec(segment);
  if (!match) return null;
  return request<SharedPlaylist>(`/v1/shared-playlists/${match[1]}`);
}
