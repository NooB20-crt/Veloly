// Theme definitions and custom CSS stay on this device. No theme service is contacted.
import { createSignal } from "solid-js";

export type Theme = {
  id: string;
  name: string;
  author?: string;
  description?: string;
  css: string;
};

export const MAX_THEME_BYTES = 256 * 1024;
const THEMES_KEY = "veloly.themes.v1";
const CUSTOM_CSS_KEY = "veloly.custom-css.v1";
const styleObjectUrls = new Map<string, string>();

type StoredThemes = { themes: Theme[]; active: string | null };

function readThemes(): StoredThemes {
  try {
    const value = JSON.parse(localStorage.getItem(THEMES_KEY) ?? "null");
    if (!value || !Array.isArray(value.themes)) return { themes: [], active: null };
    const themes = (value.themes as Theme[]).filter(
      (theme) => theme && typeof theme.id === "string" && typeof theme.name === "string" && typeof theme.css === "string",
    );
    return { themes, active: themes.some((theme) => theme.id === value.active) ? value.active : null };
  } catch {
    return { themes: [], active: null };
  }
}

function readCustomCss() {
  try {
    const css = localStorage.getItem(CUSTOM_CSS_KEY);
    return css && new Blob([css]).size <= MAX_THEME_BYTES ? css : "";
  } catch {
    return "";
  }
}

/** Adapt CSS made for 555 to Veloly's bundled fonts and existing design tokens. */
function compatibleCss(css: string) {
  // Theme imports are not dependable inside a packaged WebView and may be blocked by CSP.
  // Veloly already bundles its display and body fonts, so use those instead of remote fonts.
  const adapted = css
    .replace(/@import\b[^;]*;/gi, "")
    .replace(/(["'])Anton\1/gi, '"Unbounded Variable"')
    .replace(/(["'])Impact\1/gi, '"Unbounded Variable"')
    .replace(/(["'])Barlow Condensed\1/gi, '"Manrope Variable"')
    .replace(/(["'])Arial Narrow\1/gi, '"Manrope Variable"');
  const clean = adapted.replace(/\/\*[\s\S]*?\*\//g, "");
  const bridges: string[] = [];
  if (/--blue\s*:/.test(clean)) bridges.push("--violet:var(--blue) !important");
  if (/--blue-deep\s*:/.test(clean)) bridges.push("--violet-deep:var(--blue-deep) !important");
  if (/--blue-light\s*:/.test(clean)) bridges.push("--violet-light:var(--blue-light) !important", "--accent:var(--blue-light) !important");
  return adapted + (bridges.length ? `\n:root{${bridges.join(";")}}` : "");
}

const [stored, setStored] = createSignal<StoredThemes>(readThemes());
const [customCss, setCustomCssSignal] = createSignal(readCustomCss());

export const installedThemes = () => stored().themes;
export const activeThemeId = () => stored().active;
export { customCss };

function setGeneratedStylesheet(id: string, css: string) {
  const existing = document.getElementById(id);
  // Older app versions created these IDs as <style> nodes. Replace them so a
  // CSS update after upgrading can't accidentally write `href` onto a style tag.
  if (existing && existing.tagName !== "LINK") existing.remove();
  let link = document.getElementById(id) as HTMLLinkElement | null;
  const previousUrl = styleObjectUrls.get(id);
  if (!css.trim()) {
    link?.remove();
    styleObjectUrls.delete(id);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    return;
  }

  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  const nextUrl = URL.createObjectURL(new Blob([css], { type: "text/css" }));
  link.disabled = false;
  link.onload = () => {
    if (previousUrl && previousUrl !== nextUrl) URL.revokeObjectURL(previousUrl);
  };
  link.onerror = () => {
    if (styleObjectUrls.get(id) === nextUrl) styleObjectUrls.delete(id);
    URL.revokeObjectURL(nextUrl);
    console.error(`[Veloly] Could not apply stylesheet ${id}`);
  };
  styleObjectUrls.set(id, nextUrl);
  link.href = nextUrl;
}

function applyThemeStyles() {
  const selected = stored().themes.find((theme) => theme.id === stored().active) ?? null;
  // Blob-backed link stylesheets avoid WebView quirks with dynamically edited inline <style> tags.
  setGeneratedStylesheet("veloly-theme-css", selected ? compatibleCss(selected.css) : "");
  setGeneratedStylesheet("veloly-user-css", customCss());
}

function saveThemes(next: StoredThemes) {
  setStored(next);
  try {
    localStorage.setItem(THEMES_KEY, JSON.stringify(next));
  } catch {
    // Keep this session's selected theme if local storage is unavailable.
  }
  applyThemeStyles();
}

/** Emergency reset for CSS that makes the app difficult to use; restored on next launch. */
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.code !== "Digit0") return;
    event.preventDefault();
    for (const id of ["veloly-theme-css", "veloly-user-css"]) {
      const sheet = (document.getElementById(id) as HTMLStyleElement | HTMLLinkElement | null)?.sheet;
      if (sheet) sheet.disabled = !sheet.disabled;
    }
  });
}

export function setActiveTheme(id: string | null) {
  saveThemes({ ...stored(), active: id && stored().themes.some((theme) => theme.id === id) ? id : null });
}

export function removeTheme(id: string) {
  const current = stored();
  saveThemes({ themes: current.themes.filter((theme) => theme.id !== id), active: current.active === id ? null : current.active });
}

export function installTheme(theme: Omit<Theme, "id"> & { id?: string }) {
  const current = stored();
  const id = theme.id ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const installed: Theme = { ...theme, id };
  const themes = [...current.themes.filter((item) => item.id !== id), installed];
  saveThemes({ themes, active: id });
}

export function setCustomCss(css: string) {
  setCustomCssSignal(css);
  try {
    localStorage.setItem(CUSTOM_CSS_KEY, css);
  } catch {
    // Keep live styles for this session if storage is unavailable.
  }
  applyThemeStyles();
}

export function clearCustomCss() {
  setCustomCss("");
}

export function parseTheme(css: string, fallbackName: string): Omit<Theme, "id"> {
  const header = css.match(/^\s*\/\*([\s\S]*?)\*\//)?.[1] ?? "";
  const tag = (name: string) => header.match(new RegExp(`@${name}\\s+(.+)`))?.[1]?.replace(/\*\/?$/, "").trim() || undefined;
  return { name: tag("name") ?? fallbackName, author: tag("author"), description: tag("description"), css };
}

export async function importThemeFile(file: File): Promise<Theme> {
  if (file.size > MAX_THEME_BYTES) throw new Error("too-big");
  const css = await file.text();
  const parsed = parseTheme(css, file.name.replace(/\.css$/i, ""));
  if (!parsed.name.trim()) throw new Error("invalid-theme");
  installTheme(parsed);
  return installedThemes().find((theme) => theme.id === activeThemeId())!;
}

applyThemeStyles();
