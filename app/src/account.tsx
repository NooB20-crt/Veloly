import { createEffect, createSignal, onMount, Show } from "solid-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, type Track } from "./api";
import { t } from "./i18n";

const endpoint = (import.meta.env.VITE_VELOLY_TELEMETRY_URL as string | undefined)?.trim().replace(/\/$/, "");
const [account, setAccount] = createSignal<Profile | null>(null);
const [dialogOpen, setDialogOpen] = createSignal(false);
let token = "";
let inited = false;

export const accountAvailable = () => !!endpoint;

type Profile = { username: string; description: string; favoriteMusic: string; avatarData: string | null; usernameChangeAvailableAt: number; email: string | null; emailVerified: boolean };
type AuthReply = { token?: string; verificationRequired?: boolean };
export type SharedPlaylistTrack = { source: "deezer" | "youtube" | "jamendo" | "metadata"; remoteId: string | null; title: string; artist: string; album: string | null; duration: number | null };
export type SharedPlaylist = { name: string; owner: string; tracks: SharedPlaylistTrack[] };

async function accountRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!endpoint) throw new Error("service_unavailable");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${endpoint}${path}`, { ...init, headers, cache: "no-store", redirect: "error" });
  const result = await response.json().catch(() => ({})) as T & { error?: string; availableAt?: number };
  if (!response.ok) {
    const error = new Error(result.error ?? "network_error") as Error & { availableAt?: number };
    error.availableAt = result.availableAt;
    throw error;
  }
  return result;
}

function errorText(error: unknown): string {
  const code = error instanceof Error ? error.message : "network_error";
  if (code === "invalid_username") return t.accountInvalidUsername;
  if (code === "invalid_email") return t.accountInvalidEmail;
  if (code === "weak_password") return t.accountWeakPassword;
  if (code === "account_name_unavailable") return t.accountNameUnavailable;
  if (code === "email_unavailable") return t.accountEmailUnavailable;
  if (code === "email_not_verified") return t.accountEmailNotVerified;
  if (code === "account_backend_outdated") return t.accountBackendOutdated;
  if (code === "email_service_unavailable" || code === "email_delivery_failed") return t.accountEmailDelivery;
  if (code === "login_failed" || code === "unauthorized") return t.accountLoginFailed;
  if (code === "rate_limited") return t.accountRateLimited;
  if (code === "service_unavailable") return t.accountServiceUnavailable;
  if (code === "username_cooldown") return t.profileUsernameCooldown(new Date((error as Error & { availableAt?: number }).availableAt ?? Date.now()).toLocaleDateString());
  if (code === "invalid_profile_description") return t.profileDescriptionTooLong;
  if (code === "invalid_favorite_music") return t.profileFavoriteTooLong;
  if (code === "invalid_avatar" || code === "profile_too_large") return t.profileAvatarInvalid;
  if (code === "shared_playlist_not_found" || code === "invalid_shared_playlist") return t.shareLinkInvalid;
  return t.accountNetworkError;
}

async function getProfile(): Promise<Profile> {
  return accountRequest<Profile>("/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export async function createPlaylistShareLink(name: string, tracks: Track[]): Promise<string | null> {
  if (!token) { setDialogOpen(true); return null; }
  const shareTracks: SharedPlaylistTrack[] = tracks.map((track) => {
    const source = track.source === "deezer" || track.source === "youtube" || track.source === "jamendo";
    const remoteId = track.location.kind === "remote" ? track.location.remoteId : null;
    const canShareRemote = source && remoteId && remoteId.length <= 200;
    return {
      source: canShareRemote ? track.source as SharedPlaylistTrack["source"] : "metadata",
      remoteId: canShareRemote ? remoteId : null,
      title: track.title, artist: track.artist, album: track.album, duration: track.duration,
    };
  });
  const result = await accountRequest<{ url: string }>("/v1/shared-playlists", {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, tracks: shareTracks }),
  });
  return result.url;
}

export async function fetchSharedPlaylist(url: string): Promise<SharedPlaylist | null> {
  if (!endpoint) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.origin !== new URL(endpoint).origin) return null;
  const match = /(?:^|-)([a-f0-9]{24})$/i.exec(parsed.pathname.startsWith("/s/") ? parsed.pathname.slice(3) : "");
  if (!match) return null;
  return accountRequest<SharedPlaylist>(`/v1/shared-playlists/${match[1]}`);
}

async function imageToWebp(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) throw new Error("invalid_avatar");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid_avatar");
    const scale = Math.min(256 / image.width, 256 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("invalid_avatar")), "image/webp", 0.82));
    if (blob.size > 72_000 || !blob.type.includes("webp")) throw new Error("invalid_avatar");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:image/webp;base64,${btoa(binary)}`;
  } finally {
    image.close();
  }
}

function Avatar(props: { profile?: Profile | null; large?: boolean }) {
  const size = props.large ? 76 : 30;
  return (
    <span
      classList={{ "profile-avatar": true, large: !!props.large, empty: !props.profile?.avatarData }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        "min-width": `${size}px`,
        "min-height": `${size}px`,
        "max-width": `${size}px`,
        "max-height": `${size}px`,
        "flex-basis": `${size}px`,
        "flex-shrink": "0",
        "aspect-ratio": "1 / 1",
        "border-radius": "50%",
      }}
    >
      <Show when={props.profile?.avatarData} fallback={<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>}>
        {(src) => <img src={src()} alt="" />}
      </Show>
    </span>
  );
}

export function ProfileEntry(props: { class?: string }) {
  return (
    <button class={`profile-entry ${props.class ?? ""}`} title={account()?.username ?? t.profileOpen} aria-label={t.profileOpen} onClick={() => {
      setDialogOpen(true);
      if (token) void getProfile().then(setAccount).catch(() => {});
    }}>
      <Avatar profile={account()} />
      <span>{account()?.username ?? t.profileOpen}</span>
    </button>
  );
}

export function ProfileHost() {
  const [registering, setRegistering] = createSignal(false);
  const [forgotMode, setForgotMode] = createSignal(false);
  const [verificationPending, setVerificationPending] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [passwordVisible, setPasswordVisible] = createSignal(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = createSignal(false);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [emailDraft, setEmailDraft] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [draft, setDraft] = createSignal<Profile | null>(null);
  const [favoriteQuery, setFavoriteQuery] = createSignal("");
  const [favoriteResults, setFavoriteResults] = createSignal<Track[] | null>(null);
  const [favoriteSearching, setFavoriteSearching] = createSignal(false);
  let favoriteSearchTimer: number | undefined;
  let favoriteSearchId = 0;
  let fileInput: HTMLInputElement | undefined;

  onMount(() => {
    if (inited) return;
    inited = true;
    if (!token) return;
    void getProfile().then(setAccount).catch(() => { token = ""; setAccount(null); });
  });

  createEffect(() => {
    if (dialogOpen() && account()) setDraft(account());
  });

  const close = () => { if (!busy()) { setDialogOpen(false); setError(""); setNotice(""); } };
  const submitAuth = async (event: SubmitEvent) => {
    event.preventDefault();
    if (busy()) return;
    setBusy(true); setError("");
    try {
      const result = await accountRequest<AuthReply>(registering() ? "/v1/auth/register" : "/v1/auth/login", {
        method: "POST", body: JSON.stringify(registering()
          ? { username: username(), email: email(), password: password() }
          : { login: username(), username: username(), password: password() }),
      });
      if (result.verificationRequired) {
        setPassword(""); setUsername(""); setEmail(""); setVerificationPending(true); setNotice(t.accountVerifySent);
        return;
      }
      if (registering()) throw new Error("account_backend_outdated");
      if (!result.token) throw new Error("network_error");
      token = result.token;
      const profile = await getProfile();
      setAccount(profile); setDraft(profile); setPassword("");
    } catch (reason) {
      setError(errorText(reason));
    } finally { setBusy(false); }
  };

  const requestPasswordReset = async (event: SubmitEvent) => {
    event.preventDefault();
    if (busy()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await accountRequest("/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email() }) });
      setNotice(t.accountResetSent);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const requestEmailVerification = async () => {
    const address = (emailDraft() || account()?.email || "").trim();
    if (!address || busy()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await accountRequest<{ verificationRequired?: boolean; alreadyVerified?: boolean }>("/v1/auth/email", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: address }),
      });
      setNotice(result.alreadyVerified ? t.accountEmailAlreadyVerified : t.accountVerifySent);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const saveProfile = async (event: SubmitEvent) => {
    event.preventDefault();
    const value = draft();
    if (!value || busy()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await accountRequest<Profile>("/v1/profile/me", {
        method: "PUT", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: value.username, description: value.description, favoriteMusic: value.favoriteMusic, avatarData: value.avatarData }),
      });
      setAccount(updated); setDraft(updated); setNotice(t.profileSaved);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const chooseAvatar = async (file?: File) => {
    if (!file || !draft()) return;
    setError("");
    try {
      const avatarData = await imageToWebp(file);
      setDraft({ ...draft()!, avatarData });
    } catch { setError(t.profileAvatarInvalid); }
    if (fileInput) fileInput.value = "";
  };

  const searchFavoriteMusic = (query: string) => {
    setFavoriteQuery(query);
    setFavoriteResults(null);
    if (favoriteSearchTimer !== undefined) window.clearTimeout(favoriteSearchTimer);
    const id = ++favoriteSearchId;
    const clean = query.trim();
    if (clean.length < 2) { setFavoriteSearching(false); return; }
    setFavoriteSearching(true);
    favoriteSearchTimer = window.setTimeout(async () => {
      try {
        const tracks = await api.search(clean);
        if (id === favoriteSearchId) setFavoriteResults(tracks.slice(0, 7));
      } catch {
        if (id === favoriteSearchId) setFavoriteResults([]);
      } finally {
        if (id === favoriteSearchId) setFavoriteSearching(false);
      }
    }, 250);
  };

  const chooseFavoriteMusic = (track: Track) => {
    const base = `${track.title} — ${track.artist}`;
    const value = track.album && Array.from(`${base} · ${track.album}`).length <= 120 ? `${base} · ${track.album}` : base;
    if (Array.from(value).length > 120) { setError(errorText(new Error("invalid_favorite_music"))); return; }
    setError("");
    setDraft({ ...draft()!, favoriteMusic: value });
    setFavoriteQuery("");
    setFavoriteResults(null);
    setFavoriteSearching(false);
    favoriteSearchId++;
    if (favoriteSearchTimer !== undefined) window.clearTimeout(favoriteSearchTimer);
  };

  const shareProfile = async () => {
    const url = `${endpoint}/p/${encodeURIComponent(account()?.username ?? "")}`;
    try { await openUrl(url); }
    catch { window.open(url, "_blank", "noopener,noreferrer"); }
  };

  const logout = async () => {
    if (busy()) return;
    const current = token;
    setConfirmLogoutOpen(false);
    token = ""; setAccount(null); setDraft(null); setError("");
    try { await accountRequest("/v1/auth/session", { method: "DELETE", headers: { Authorization: `Bearer ${current}` } }); } catch { /* Session expiry revokes it later. */ }
  };

  return (
    <Show when={dialogOpen()}>
      <div class="dialog-layer profile-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
        <section class="dialog profile-dialog" role="dialog" aria-modal="true" aria-label={t.profileOpen}>
          <header class="dialog-head"><h2>{account() ? t.profileTitle : t.account}</h2><button class="icon-btn" title={t.closeLabel} onClick={close}>×</button></header>
          <Show when={account()} fallback={
            <>
              <Show when={verificationPending()} fallback={
                <Show when={forgotMode()} fallback={
                  <>
                    <p class="muted small">{t.accountHint}</p>
                    <form class="account-form" onSubmit={submitAuth}>
                      <Show when={registering()}>
                        <label class="account-field"><span>{t.accountEmail}</span><input class="dialog-input" type="email" value={email()} onInput={(event) => setEmail(event.currentTarget.value)} autocomplete="email" maxlength="254" required disabled={busy()} /></label>
                      </Show>
                      <label class="account-field"><span>{registering() ? t.accountUsername : t.accountLoginField}</span><input class="dialog-input" type="text" value={username()} onInput={(event) => setUsername(event.currentTarget.value)} autocomplete="username" minlength="3" maxlength="254" pattern={registering() ? "[A-Za-z0-9_]{3,24}" : undefined} required disabled={busy()} /></label>
                      <div class="account-field">
                        <label for="account-password">{t.accountPassword}</label>
                        <div class="password-input-wrap">
                          <input id="account-password" class="dialog-input" type={passwordVisible() ? "text" : "password"} value={password()} onInput={(event) => setPassword(event.currentTarget.value)} autocomplete={registering() ? "new-password" : "current-password"} minlength={registering() ? 12 : undefined} maxlength="128" required disabled={busy()} />
                          <button class="password-visibility" type="button" aria-label={passwordVisible() ? t.passwordHide : t.passwordShow} title={passwordVisible() ? t.passwordHide : t.passwordShow} aria-pressed={passwordVisible()} onClick={() => setPasswordVisible(!passwordVisible())} disabled={busy()}>
                            <Show when={!passwordVisible()} fallback={<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.1 0 8.5 4.7 9.5 6.4a1.2 1.2 0 0 1 0 1.2 16 16 0 0 1-3.1 3.7"/><path d="M6.2 6.2a16.3 16.3 0 0 0-3.7 5.2 1.2 1.2 0 0 1 0 1.2C3.5 14.3 6.9 19 12 19c1 0 1.9-.2 2.8-.5"/></svg>}>
                              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>
                            </Show>
                          </button>
                        </div>
                      </div>
                      <p class="account-help">{registering() ? t.accountPasswordRule : t.accountNoRecovery}</p>
                      <Show when={!registering()}><button class="link-btn account-forgot" type="button" disabled={busy()} onClick={() => { setForgotMode(true); setEmail(username().includes("@") ? username() : ""); setError(""); setNotice(""); }}>{t.accountForgotPassword}</button></Show>
                      <Show when={error()}><p class="feedback-error" role="alert">{error()}</p></Show>
                      <div class="account-actions"><button class="primary" type="submit" disabled={busy()}>{busy() ? t.accountWorking : registering() ? t.accountCreate : t.accountSignIn}</button><button class="ghost" type="button" disabled={busy()} onClick={() => { setRegistering(!registering()); setForgotMode(false); setError(""); }}>{registering() ? t.accountSwitchLogin : t.accountSwitchCreate}</button></div>
                    </form>
                  </>
                }>
                  <p class="muted small">{t.accountForgotHint}</p>
                  <form class="account-form" onSubmit={requestPasswordReset}>
                    <label class="account-field"><span>{t.accountEmail}</span><input class="dialog-input" type="email" value={email()} onInput={(event) => setEmail(event.currentTarget.value)} autocomplete="email" maxlength="254" required disabled={busy()} /></label>
                    <Show when={notice()}><p class="profile-success" role="status">{notice()}</p></Show>
                    <Show when={error()}><p class="feedback-error" role="alert">{error()}</p></Show>
                    <div class="account-actions"><button class="primary" type="submit" disabled={busy()}>{busy() ? t.accountWorking : t.accountRequestReset}</button><button class="ghost" type="button" disabled={busy()} onClick={() => { setForgotMode(false); setError(""); setNotice(""); }}>{t.accountSwitchLogin}</button></div>
                  </form>
                </Show>
              }>
                <p class="muted small" role="status">{notice() || t.accountVerifySent}</p>
                <div class="account-actions"><button class="primary" type="button" onClick={() => { setVerificationPending(false); setRegistering(false); setNotice(""); }}>{t.accountSignIn}</button><button class="ghost" type="button" onClick={() => { setVerificationPending(false); setRegistering(true); setNotice(""); }}>{t.accountSwitchCreate}</button></div>
              </Show>
            </>
          }>
            <div class="profile-public-note">{t.profilePublicHint}</div>
            <form class="profile-form" onSubmit={saveProfile}>
              <div class="profile-avatar-editor">
                <Avatar profile={draft()} large />
                <div><button class="ghost" type="button" onClick={() => fileInput?.click()}>{t.profileChangePhoto}</button><Show when={draft()?.avatarData}><button class="link-btn" type="button" onClick={() => setDraft({ ...draft()!, avatarData: null })}>{t.profileRemovePhoto}</button></Show></div>
                <input ref={fileInput} class="profile-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseAvatar(event.currentTarget.files?.[0])} />
              </div>
              <label class="account-field"><span>{t.accountUsername}</span><input class="dialog-input" type="text" value={draft()?.username ?? ""} onInput={(event) => setDraft({ ...draft()!, username: event.currentTarget.value })} autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required disabled={busy() || (draft()?.usernameChangeAvailableAt ?? 0) > Date.now()} />
                <Show when={(draft()?.usernameChangeAvailableAt ?? 0) > Date.now()}><small class="account-help">{t.profileUsernameCooldown(new Date(draft()!.usernameChangeAvailableAt).toLocaleDateString())}</small></Show>
              </label>
              <div class="account-email-settings">
                <label class="account-field"><span>{t.accountEmail}</span><input class="dialog-input" type="email" value={emailDraft() || draft()?.email || ""} onInput={(event) => setEmailDraft(event.currentTarget.value)} autocomplete="email" maxlength="254" placeholder={t.accountEmail} disabled={busy()} /></label>
                <small class="account-help">{emailDraft().trim() && emailDraft().trim().toLowerCase() !== draft()?.email?.toLowerCase() ? t.accountEmailPending : draft()?.emailVerified ? t.accountEmailVerified : t.accountEmailPending}</small>
                <button class="ghost" type="button" onClick={() => void requestEmailVerification()} disabled={busy()}>{busy() ? t.accountWorking : t.accountSendVerification}</button>
              </div>
              <label class="account-field"><span>{t.profileDescription}</span><textarea class="dialog-input profile-textarea" maxlength="300" value={draft()?.description ?? ""} onInput={(event) => setDraft({ ...draft()!, description: event.currentTarget.value })} placeholder={t.profileDescriptionPlaceholder} disabled={busy()} /></label>
              <div class="account-field favorite-music-field">
                <label for="favorite-music-search">{t.profileFavoriteMusic}</label>
                <Show when={draft()?.favoriteMusic}>
                  <div class="favorite-music-selected">
                    <span>{draft()?.favoriteMusic}</span>
                    <button class="link-btn" type="button" aria-label={t.profileFavoriteRemove} disabled={busy()} onClick={() => setDraft({ ...draft()!, favoriteMusic: "" })}>×</button>
                  </div>
                </Show>
                <input id="favorite-music-search" class="dialog-input" type="search" value={favoriteQuery()} onInput={(event) => searchFavoriteMusic(event.currentTarget.value)} placeholder={t.profileFavoritePlaceholder} autocomplete="off" disabled={busy()} />
                <Show when={favoriteSearching()}><small class="account-help">{t.profileFavoriteSearching}</small></Show>
                <Show when={favoriteResults()}>
                  {(tracks) => <div class="favorite-music-results" role="listbox" aria-label={t.profileFavoriteMusic}>
                    <Show when={tracks().length > 0} fallback={<div class="favorite-music-empty">{t.profileFavoriteNoResults}</div>}>
                      {tracks().map((track) => <button class="favorite-music-result" type="button" role="option" onClick={() => chooseFavoriteMusic(track)}>
                        <Show when={track.artwork}><img src={track.artwork!} alt="" /></Show>
                        <span class="favorite-music-result-text"><strong>{track.title}</strong><small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small></span>
                      </button>)}
                    </Show>
                  </div>}
                </Show>
              </div>
              <Show when={error()}><p class="feedback-error" role="alert">{error()}</p></Show><Show when={notice()}><p class="profile-success" role="status">{notice()}</p></Show>
              <footer class="profile-actions"><button class="ghost" type="button" onClick={() => void shareProfile()}>{t.profileShare}</button><button class="ghost" type="button" onClick={() => setConfirmLogoutOpen(true)} disabled={busy()}>{t.accountLogout}</button><button class="primary" type="submit" disabled={busy()}>{busy() ? t.accountWorking : t.profileSave}</button></footer>
            </form>
          </Show>
        </section>
      </div>
      <Show when={confirmLogoutOpen()}>
        <div class="dialog-layer confirm-logout-layer" onMouseDown={(event) => event.target === event.currentTarget && setConfirmLogoutOpen(false)}>
          <section class="dialog confirm-logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-logout-title" aria-describedby="confirm-logout-message">
            <div class="dialog-head"><h2 id="confirm-logout-title">{t.confirmLogoutTitle}</h2><button type="button" class="icon-btn" title={t.closeLabel} onClick={() => setConfirmLogoutOpen(false)}>×</button></div>
            <p id="confirm-logout-message" class="muted small">{t.confirmLogoutMessage}</p>
            <div class="dialog-actions"><button class="ghost" type="button" onClick={() => setConfirmLogoutOpen(false)}>{t.confirmLogoutNo}</button><button class="logout-confirm-button" type="button" onClick={() => void logout()}>{t.confirmLogoutYes}</button></div>
          </section>
        </div>
      </Show>
    </Show>
  );
}
