// Pages de la collection : titres likés et playlists.
import { createEffect, createSignal, on, Show } from "solid-js";
import { api, formatTime, type Snapshot, type Track } from "./api";
import { createPlaylistShareLink } from "./account";
import {
  collection, deletePlaylist, imageToCover, moveInPlaylist, notify, openTrackMenu, playlistById, renamePlaylist, setPlaylistCover,
} from "./collection";
import { IconClose, IconEdit, IconHeart, IconImage, IconLink, IconMore, IconPlay, IconPlaylist, IconTrash } from "./icons";
import { PlaylistArt, TrackList } from "./ui";
import { t } from "./i18n";

type Common = { snap: Snapshot; onPlay: (tracks: Track[], index: number) => void };

const total = (tracks: Track[]) => tracks.reduce((a, t) => a + (t.duration ?? 0), 0);
const countLabel = (n: number) => t.songsCount(n);
type SortKey = "name" | "album" | "duration";
type Sort = { key: SortKey; direction: 1 | -1 } | null;

function currentOccurrence(tracks: Track[], snap: Snapshot): number | undefined {
  if (!snap.track) return undefined;
  // L'index du lecteur désigne aussi l'occurrence, y compris lorsque la playlist contient
  // plusieurs fois le même identifiant. Si la file vient d'une autre liste, choisir la première.
  const index = snap.index;
  if (index !== null && index >= 0 && index < tracks.length && tracks[index]?.id === snap.track.id) return index;
  const first = tracks.findIndex((track) => track.id === snap.track?.id);
  return first < 0 ? undefined : first;
}

export function LikedView(props: Common) {
  const tracks = () => collection().liked;
  return (
    <div class="album-page">
      <header class="artist-head album-head">
        <PlaylistArt liked class="xl" />
        <div class="artist-body">
          <div class="eyebrow">{t.playlist}</div>
          <h1 class="album-title">{t.liked}</h1>
          <p class="muted">
            {countLabel(tracks().length)}
            <Show when={tracks().length > 0}> · {formatTime(total(tracks()))}</Show>
          </p>
          <Show when={tracks().length > 0}>
            <div class="actions hero-play">
              <button class="primary" onClick={() => props.onPlay(tracks(), 0)}>
                <IconPlay size={18} /> {t.play}
              </button>
            </div>
          </Show>
        </div>
      </header>
      <section class="section">
        <Show
          when={tracks().length > 0}
          fallback={
            <div class="empty-state">
              <IconHeart size={26} />
              <h2>{t.noLiked}</h2>
              <p class="muted">{t.noLikedText}</p>
            </div>
          }
        >
          <TrackList tracks={tracks()} current={props.snap.track?.id} status={props.snap.status} onPlay={(i) => props.onPlay(tracks(), i)} showAlbum />
        </Show>
      </section>
    </div>
  );
}

/** `editing` : la playlist vient d'être créée, son nom est prêt à être changé. */
export function PlaylistView(props: Common & { id: string; editing: boolean; onDeleted: () => void }) {
  const playlist = () => playlistById(props.id);
  const [sort, setSort] = createSignal<Sort>(null);
  const [editing, setEditing] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [sharing, setSharing] = createSignal(false);
  const [shareUrl, setShareUrl] = createSignal("");
  createEffect(on(() => [props.id, props.editing] as const, ([, e]) => {
    setEditing(e);
    setConfirmDelete(false);
  }));
  let input: HTMLInputElement | undefined;
  createEffect(() => {
    if (editing()) requestAnimationFrame(() => input?.select());
  });
  const save = (name: string) => {
    setEditing(false);
    const p = playlist();
    if (p && name.trim() && name.trim() !== p.name) renamePlaylist(p.id, name);
  };
  let picker: HTMLInputElement | undefined;
  let shareInput: HTMLInputElement | undefined;
  const share = async () => {
    const p = playlist();
    if (!p || sharing()) return;
    if (!p.tracks.length) { notify(t.emptyPlaylistText, "error"); return; }
    setSharing(true);
    try {
      const link = await createPlaylistShareLink(p.name, p.tracks);
      if (link) setShareUrl(link);
      else notify(t.shareSignIn);
    } catch {
      notify(t.shareFailed, "error");
    } finally { setSharing(false); }
  };
  const copyShareUrl = async () => {
    const value = shareUrl();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      notify(t.shareCopied);
    } catch {
      shareInput?.focus();
      shareInput?.select();
      notify(t.shareCopyManual);
    }
  };
  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    try {
      await setPlaylistCover(props.id, await imageToCover(file));
    } catch {
      notify(t.coverError, "error");
    }
  };
  const remove = async () => {
    if (!confirmDelete()) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    if (await deletePlaylist(props.id)) props.onDeleted();
  };
  const sortedEntries = () => {
    const p = playlist();
    if (!p) return [];
    const selected = sort();
    const entries = p.tracks.map((track, index) => ({ track, index }));
    if (!selected) return entries;
    const compare = selected.key === "name"
      ? (a: Track, b: Track) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
      : selected.key === "album"
        ? (a: Track, b: Track) => (a.album ?? "").localeCompare(b.album ?? "", undefined, { sensitivity: "base", numeric: true }) || a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
        : (a: Track, b: Track) => (a.duration ?? 0) - (b.duration ?? 0);
    return entries.sort((a, b) => {
      if (selected.key === "duration" && (a.track.duration === null || b.track.duration === null)) {
        if (a.track.duration === null && b.track.duration !== null) return 1;
        if (b.track.duration === null && a.track.duration !== null) return -1;
      }
      return selected.direction * compare(a.track, b.track) || a.index - b.index;
    });
  };
  const sortedTracks = () => sortedEntries().map((entry) => entry.track);
  const changeSort = (key: SortKey) => setSort((old) => old?.key === key
    ? old.direction === 1 ? { key, direction: -1 } : null
    : { key, direction: 1 });
  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      class="playlist-column-sort"
      classList={{ active: sort()?.key === key }}
      aria-label={`${label} — ${t.sortPlaylist}`}
      aria-pressed={sort()?.key === key}
      onClick={() => changeSort(key)}
    >
      {label}
      <Show when={sort()?.key === key}>
        <span class="playlist-sort-arrow" aria-hidden="true">{sort()!.direction === 1 ? "↑" : "↓"}</span>
      </Show>
    </button>
  );

  return (
    <Show when={playlist()} fallback={<p class="muted empty">{t.playlistGone}</p>}>
      {(p) => (
        <>
        <div class="album-page">
          <header class="artist-head album-head">
            <button class="pl-art-btn" title={t.changeCover} aria-label={t.changeCover} onClick={() => picker?.click()}>
              <PlaylistArt id={p().id} class="xl" />
              <span class="pl-art-edit"><IconImage /></span>
            </button>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void pickCover(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <div class="artist-body">
              <div class="eyebrow">{t.playlist}</div>
              <Show
                when={editing()}
                fallback={
                  <h1 class="album-title pl-title" title={t.rename} onClick={() => setEditing(true)}>
                    {p().name}
                  </h1>
                }
              >
                <input
                  ref={input}
                  class="album-title pl-title-input"
                  value={p().name}
                  maxLength={120}
                  spellcheck={false}
                  aria-label={t.playlistName}
                  onBlur={(e) => save(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      e.currentTarget.value = p().name;
                      e.currentTarget.blur();
                    }
                  }}
                />
              </Show>
              <p class="muted">
                {countLabel(p().tracks.length)}
                <Show when={p().tracks.length > 0}> · {formatTime(total(p().tracks))}</Show>
              </p>
              <div class="actions hero-play">
                <Show when={p().tracks.length > 0}>
                  <button class="primary" onClick={() => props.onPlay(p().tracks, 0)}>
                    <IconPlay size={18} /> {t.play}
                  </button>
                </Show>
                <button class="icon-btn" title={t.rename} onClick={() => setEditing(true)}>
                  <IconEdit />
                </button>
                <button class="icon-btn" title={t.changeCover} onClick={() => picker?.click()}>
                  <IconImage />
                </button>
                <Show when={p().cover}>
                  <button class="icon-btn" title={t.removeCover} onClick={() => setPlaylistCover(p().id, null)}>
                    <IconClose />
                  </button>
                </Show>
                <Show when={p().tracks.length > 0}>
                  <button class="icon-btn" title={t.addWholePlaylist} onClick={(e) => openTrackMenu(e, p().tracks, p().id)}>
                    <IconMore />
                  </button>
                  <button class="icon-btn" title={t.sharePlaylist} aria-label={t.sharePlaylist} disabled={sharing()} onClick={() => void share()}>
                    <IconLink />
                  </button>
                </Show>
                <button classList={{ ghost: confirmDelete(), "icon-btn": !confirmDelete(), danger: true }} title={t.deletePlaylist} onClick={remove}>
                  <IconTrash />
                  <Show when={confirmDelete()}>{t.confirmDelete}</Show>
                </button>
              </div>
            </div>
          </header>
          <section class="section">
            <Show
              when={p().tracks.length > 0}
              fallback={
                <div class="empty-state">
                  <IconPlaylist size={26} />
                  <h2>{t.emptyPlaylist}</h2>
                  <p class="muted">{t.emptyPlaylistText}</p>
                </div>
              }
            >
              <TrackList
                tracks={sortedTracks()}
                current={props.snap.track?.id}
                currentIndex={currentOccurrence(sortedTracks(), props.snap)}
                status={props.snap.status}
                onPlay={(i) => props.onPlay(sortedTracks(), i)}
                showAlbum
                playlist={p().id}
                header={
                  <div class="row playlist-column-header" role="row" aria-label={t.sortPlaylist}>
                    <div class="row-num" aria-hidden="true">#</div>
                    <div class="playlist-cover-heading" aria-hidden="true" />
                    <div class="row-main" role="columnheader">{sortButton("name", t.sortName)}</div>
                    <div class="row-album" role="columnheader">{sortButton("album", t.sortAlbum)}</div>
                    <div class="row-like playlist-empty-heading" aria-hidden="true" />
                    <div class="row-time" role="columnheader">{sortButton("duration", t.sortDuration)}</div>
                    <div class="row-more playlist-empty-heading" aria-hidden="true" />
                  </div>
                }
                sourceIndex={(index) => sortedEntries()[index]?.index ?? index}
                onMove={sort() ? undefined : (from, to) => moveInPlaylist(p().id, from, to)}
              />
            </Show>
          </section>
        </div>
        <Show when={shareUrl()}>
          <div class="dialog-layer share-playlist-layer" onMouseDown={(event) => event.target === event.currentTarget && setShareUrl("")}>
            <section class="dialog share-playlist-dialog" role="dialog" aria-modal="true" aria-label={t.sharePlaylistTitle}>
              <div class="dialog-head"><h2>{t.sharePlaylistTitle}</h2><button type="button" class="icon-btn" title={t.closeLabel} onClick={() => setShareUrl("")}><IconClose /></button></div>
              <p class="muted small">{t.sharePlaylistHint}</p>
              <input ref={shareInput} class="dialog-input share-playlist-url" readonly value={shareUrl()} onFocus={(event) => event.currentTarget.select()} />
              <div class="dialog-actions"><button type="button" class="ghost" onClick={() => setShareUrl("")}>{t.closeLabel}</button><button type="button" class="primary" onClick={() => void copyShareUrl()}>{t.copyLink}</button></div>
            </section>
          </div>
        </Show>
        </>
      )}
    </Show>
  );
}
