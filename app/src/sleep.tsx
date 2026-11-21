import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { api, type Snapshot } from "./api";
import { IconClock } from "./icons";
import { Popover } from "./queue";
import { t as tr } from "./i18n";

type Run = (a: () => Promise<Snapshot>) => void;

/** Minuteur de veille : délai fixe ou arrêt à la fin du morceau en cours. */
export function SleepButton(props: { snap: Snapshot; run: Run }) {
  const [deadline, setDeadline] = createSignal<number | null>(null);
  const [endTrack, setEndTrack] = createSignal<string | null>(null);
  const [left, setLeft] = createSignal(0);
  let timeout: number | undefined;
  let ticker: number | undefined;

  const clear = () => {
    window.clearTimeout(timeout);
    window.clearInterval(ticker);
    timeout = ticker = undefined;
    setDeadline(null);
    setEndTrack(null);
    setLeft(0);
  };

  const stop = () => {
    clear();
    props.run(api.stop);
  };

  const start = (minutes: number) => {
    clear();
    const until = Date.now() + minutes * 60_000;
    setDeadline(until);
    setLeft(minutes * 60);
    ticker = window.setInterval(() => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000))), 1000);
    timeout = window.setTimeout(stop, minutes * 60_000);
  };

  const startAtEnd = () => {
    if (props.snap.track) {
      clear();
      setEndTrack(props.snap.track.id);
    }
  };

  createEffect(() => {
    const target = endTrack();
    const snap = props.snap;
    if (!target) return;
    if (snap.track?.id !== target || (snap.duration != null && snap.duration > 0 && snap.position >= snap.duration - 0.2)) stop();
  });

  onCleanup(clear);
  const active = () => deadline() !== null || endTrack() !== null;
  const label = () => deadline() !== null ? tr.sleepRemaining(Math.ceil(left() / 60)) : endTrack() ? tr.sleepAtTrackEnd : tr.sleepTimer;

  return (
    <Popover icon={<IconClock />} title={label()} active={active()} class="sleep-popover">
      {(close) => (
        <div class="sleep-menu">
          <div class="eq-head"><span class="eq-title">{tr.sleepTimer}</span></div>
          <Show when={active()}>
            <div class="sleep-active">{label()}</div>
            <button class="eq-reset" onClick={() => { clear(); close(); }}>{tr.cancelTimer}</button>
          </Show>
          <div class="sleep-options">
            {[15, 30, 45, 60].map((minutes) => (
              <button class="ghost" onClick={() => { start(minutes); close(); }}>{tr.sleepMinutes(minutes)}</button>
            ))}
            <button class="ghost" disabled={!props.snap.track} onClick={() => { startAtEnd(); close(); }}>{tr.sleepAtTrackEnd}</button>
          </div>
        </div>
      )}
    </Popover>
  );
}
