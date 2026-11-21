import { createSignal } from "solid-js";

export type ShortcutAction = "playPause" | "previous" | "next" | "volumeDown" | "volumeUp" | "lyrics";
export type ShortcutMap = Record<ShortcutAction, string | null>;

const KEY = "veloly.shortcuts";
const DEFAULTS: ShortcutMap = {
  playPause: "Space",
  previous: "Alt+ArrowLeft",
  next: "Alt+ArrowRight",
  volumeDown: "Alt+ArrowDown",
  volumeUp: "Alt+ArrowUp",
  lyrics: "KeyL",
};

function initial(): ShortcutMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<ShortcutMap> | null;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

const [shortcutMap, setShortcutMap] = createSignal<ShortcutMap>(initial());
export { shortcutMap };

export function setShortcut(action: ShortcutAction, value: string | null) {
  const next = { ...shortcutMap(), [action]: value };
  setShortcutMap(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function resetShortcuts() {
  setShortcutMap({ ...DEFAULTS });
  try {
    localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
  } catch {}
}

export function eventShortcut(e: KeyboardEvent): string {
  return [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.altKey ? "Alt" : "", e.shiftKey ? "Shift" : "", e.code]
    .filter(Boolean)
    .join("+");
}

export function matchesShortcut(e: KeyboardEvent, action: ShortcutAction): boolean {
  const assigned = shortcutMap()[action];
  return assigned !== null && eventShortcut(e) === assigned;
}

export function shortcutLabel(value: string | null): string {
  if (!value) return "—";
  return value
    .replace("Arrow", "")
    .replace("Key", "")
    .replace("Digit", "")
    .replace("Space", "Spacebar")
    .replaceAll("+", " + ");
}
