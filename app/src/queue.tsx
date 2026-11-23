// File d'attente : bouton de la barre du lecteur (et de la vue « En lecture » sur téléphone)
// qui ouvre un panneau. Les morceaux de la file passent avant la suite de la liste ; on peut
// les retirer, les déplacer (glisser-déposer) ou les lancer tout de suite.
import { createMemo, createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js";
import { api, type QueueItem, type Snapshot, type Track } from "./api";
import { collection, createPlaylist, openTrackMenu } from "./collection";
import { IconClose, IconGrip, IconQueueList } from "./icons";
import { t as tr } from "./i18n";
import { ArtistLinks, Cover, ExplicitBadge } from "./ui";
import { isMobile } from "./mobile";

type Run = (a: () => Promise<Snapshot>) => void;

/** Panneau flottant ouvert par un bouton, fermé par un clic à côté ou Échap. */
export function Popover(props: { icon: JSX.Element; title: string; active?: boolean; class?: string; children: (close: () => void) => JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  onMount(() => {
    const outside = (e: PointerEvent) => open() && !root.contains(e.target as Node) && !(e.target as HTMLElement).closest?.(".menu-layer") && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && open() && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    onCleanup(() => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    });
  });
  return (
    <div class="eq-pop" ref={root}>
      <button classList={{ "icon-btn": true, active: open() || !!props.active }} title={props.title} aria-expanded={open()} onClick={() => setOpen(!open())}>
        {props.icon}
      </button>
      <Show when={open()}>
        <div class={`eq-popover ${props.class ?? ""}`} role="dialog" aria-label={props.title}>
          {props.children(() => setOpen(false))}
        </div>
      </Show>
    </div>
  );
}

export function QueueButton(props: { snap: Snapshot; run: Run }) {
  return (
    <Popover icon={<IconQueueList />} title={tr.queue} active={props.snap.upNext.length > 0} class="queue-popover control-queue">
      {() => <QueuePanel snap={props.snap} run={props.run} />}
    </Popover>
  );
}

/** Même contenu, dans le même ordre ? (l'état du lecteur arrive 4 fois par seconde, avec des listes neuves) */
const sameList = <T,>(id: (x: T) => unknown) => (a: T[], b: T[]) => a.length === b.length && a.every((x, i) => id(x) === id(b[i]));

function QueuePanel(props: { snap: Snapshot; run: Run }) {
  // Listes gardées tant qu'elles ne changent pas : sinon chaque ligne (et sa pochette) serait
  // recréée à chaque mise à jour, et clignoterait.
  const upNext = createMemo(() => props.snap.upNext, [], { equals: sameList((q: QueueItem) => q.key) });
  const upcoming = createMemo(() => props.snap.upcoming, [], { equals: sameList((t: Track) => t.id) });
  const current = createMemo(() => props.snap.track, null, { equals: (a, b) => a?.id === b?.id });
  const [dragFrom, setDragFrom] = createSignal<number | null>(null);
  const [dragSection, setDragSection] = createSignal<"queue" | "upcoming" | null>(null);
  const [dragOver, setDragOver] = createSignal<number | null>(null);
  const endDrag = () => (setDragFrom(null), setDragSection(null), setDragOver(null));
  const move = (section: "queue" | "upcoming", from: number, to: number, key?: number) =>
    props.run(() => section === "queue" ? api.moveQueued(key!, to) : api.moveUpcoming(from, to));
  const touchReorder = (e: PointerEvent, section: "queue" | "upcoming", from: number, key?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragFrom(from);
    setDragSection(section);
    setDragOver(from);
    const scroller = (e.currentTarget as HTMLElement).closest(".queue-scroll");
    let y = e.clientY;
    let raf = 0;
    const edgeScroll = () => {
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        const step = y < r.top + 60 ? -7 : y > r.bottom - 60 ? 7 : 0;
        if (step) scroller.scrollTop += step;
      }
      raf = requestAnimationFrame(edgeScroll);
    };
    raf = requestAnimationFrame(edgeScroll);
    const onMove = (ev: PointerEvent) => {
      y = ev.clientY;
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>(".queue-row");
      if (row?.dataset.section === section && row.dataset.index) setDragOver(Number(row.dataset.index));
    };
    const onStop = (ev: PointerEvent) => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onStop);
      window.removeEventListener("pointercancel", onStop);
      const to = dragOver();
      if (ev.type === "pointerup" && to !== null && to !== from) move(section, from, to, key);
      endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onStop);
    window.addEventListener("pointercancel", onStop);
  };
  return (
    <>
      <div class="eq-head">
        <span class="eq-title">{tr.queue}</span>
        <button
          class="eq-reset"
          onClick={() => createPlaylist(tr.queuePlaylistName(collection().playlists.length + 1), upNext().map((q) => q.track))}
          disabled={upNext().length === 0}
          title={tr.saveQueueAsPlaylist}
        >
          {tr.saveQueue}
        </button>
        <button class="eq-reset" onClick={() => props.run(api.clearQueued)} disabled={props.snap.upNext.length === 0}>
          {tr.clearQueue}
        </button>
      </div>
      <div class="queue-scroll">
        <Show when={current()}>
          {(t) => (
            <>
              <div class="menu-label">{tr.nowPlayingLabel}</div>
              <QueueRow track={t()} current />
            </>
          )}
        </Show>
        <div class="menu-label">{tr.nextInQueue}</div>
        <Show when={upNext().length > 0} fallback={<p class="queue-empty">{tr.queueEmpty}</p>}>
          <For each={upNext()}>
            {(q, i) => (
              <QueueRow
                track={q.track}
                draggable={!isMobile()}
                section="queue"
                index={i()}
                onHandlePointerDown={(e) => touchReorder(e, "queue", i(), q.key)}
                classList={{
                  dragging: dragSection() === "queue" && dragFrom() === i(),
                  "drop-before": dragSection() === "queue" && dragOver() === i() && dragFrom() !== null && dragFrom()! > i(),
                  "drop-after": dragSection() === "queue" && dragOver() === i() && dragFrom() !== null && dragFrom()! < i(),
                }}
                onDragStart={(e) => {
                  setDragFrom(i());
                  setDragSection("queue");
                  e.dataTransfer!.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragSection() !== "queue" || dragFrom() === null) return;
                  e.preventDefault();
                  setDragOver(i());
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom();
                  if (dragSection() === "queue" && from !== null && from !== i()) move("queue", from, i(), upNext()[from]?.key);
                  endDrag();
                }}
                onDragEnd={endDrag}
                onPlay={() => props.run(() => api.playQueued(q.key))}
                onRemove={() => props.run(() => api.removeQueued(q.key))}
                onMoveUp={i() > 0 ? () => props.run(() => api.moveQueued(q.key, i() - 1)) : undefined}
              />
            )}
          </For>
        </Show>
        <Show when={upcoming().length > 0}>
          <div class="menu-label">{tr.nextFromList}</div>
          <For each={upcoming()}>{(t, i) => (
            <QueueRow
              track={t}
              draggable={!isMobile()}
              section="upcoming"
              index={i()}
              onHandlePointerDown={(e) => touchReorder(e, "upcoming", i())}
              classList={{
                dragging: dragSection() === "upcoming" && dragFrom() === i(),
                "drop-before": dragSection() === "upcoming" && dragOver() === i() && dragFrom() !== null && dragFrom()! > i(),
                "drop-after": dragSection() === "upcoming" && dragOver() === i() && dragFrom() !== null && dragFrom()! < i(),
              }}
              onDragStart={(e) => { setDragFrom(i()); setDragSection("upcoming"); e.dataTransfer!.effectAllowed = "move"; }}
              onDragOver={(e) => { if (dragSection() !== "upcoming" || dragFrom() === null) return; e.preventDefault(); setDragOver(i()); }}
              onDrop={(e) => { e.preventDefault(); const from = dragFrom(); if (dragSection() === "upcoming" && from !== null && from !== i()) move("upcoming", from, i()); endDrag(); }}
              onDragEnd={endDrag}
            />
          )}</For>
        </Show>
      </div>
    </>
  );
}

function QueueRow(props: {
  track: Track;
  current?: boolean;
  draggable?: boolean;
  classList?: Record<string, boolean>;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  onPlay?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  section?: "queue" | "upcoming";
  index?: number;
  onHandlePointerDown?: (e: PointerEvent) => void;
}) {
  return (
    <div
      classList={{ "queue-row": true, current: !!props.current, ...props.classList }}
      draggable={props.draggable}
      data-section={props.section}
      data-index={props.index}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
      onDblClick={props.onPlay}
      onContextMenu={(e) => openTrackMenu(e, [props.track])}
    >
      <Cover track={props.track} />
      <div class="row-main">
        <div class="row-title">
          <ExplicitBadge track={props.track} />
          {props.track.title}
        </div>
        <div class="row-sub">
          <ArtistLinks track={props.track} />
        </div>
      </div>
      <Show when={props.onMoveUp}>
        <button class="icon-btn queue-up" title={tr.moveUp} onClick={props.onMoveUp}>
          <span aria-hidden="true">↑</span>
        </button>
      </Show>
      <Show when={props.onRemove}>
        <button class="icon-btn" title={tr.removeFromQueue} onClick={props.onRemove}>
          <IconClose />
        </button>
      </Show>
      <Show when={props.onHandlePointerDown}>
        <span class="queue-handle" title={tr.dragToReorder} onPointerDown={props.onHandlePointerDown} onClick={(e) => e.stopPropagation()}>
          <IconGrip />
        </span>
      </Show>
    </div>
  );
}
