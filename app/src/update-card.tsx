import { createSignal, Show } from "solid-js";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isAndroid, isIOS } from "./mobile";
import { t } from "./i18n";
import { IconDownload } from "./icons";

type UpdateInfo = {
  version: string;
  notes: string;
  platform: "desktop" | "android" | "ios";
  url?: string;
};

const [available, setAvailable] = createSignal<UpdateInfo | null>(null);
const [installing, setInstalling] = createSignal(false);
const [error, setError] = createSignal(false);
let desktopUpdate: import("@tauri-apps/plugin-updater").Update | null = null;
let checking = false;

function compareVersions(left: string, right: string) {
  const parse = (value: string) => value.replace(/^v/i, "").split(/[+-]/, 1)[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

/** Checks the platform's update channel once at startup. */
export async function checkForUpdates() {
  if (checking) return;
  checking = true;
  setError(false);
  try {
    const currentVersion = await getVersion();
    if (isAndroid || isIOS) {
      const response = await fetch("https://api.github.com/repos/zyndrax707/Veloly/releases/latest", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) return;
      const release = await response.json() as {
        tag_name?: string;
        body?: string;
        assets?: { name?: string; browser_download_url?: string }[];
      };
      const version = (release.tag_name ?? "").replace(/^v/i, "");
      if (!version || compareVersions(version, currentVersion) <= 0) return;
      const assets = release.assets ?? [];
      if (isAndroid) {
        const apk = assets.find((asset) => /android.*\.apk$/i.test(asset.name ?? ""));
        if (apk?.browser_download_url) setAvailable({ version, notes: release.body ?? "", platform: "android", url: apk.browser_download_url });
      } else {
        const source = assets.find((asset) => /sidestore\.json$/i.test(asset.name ?? ""));
        if (source?.browser_download_url) setAvailable({ version, notes: release.body ?? "", platform: "ios", url: `sidestore://source?url=${encodeURIComponent(source.browser_download_url)}` });
      }
      return;
    }

    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update) {
      desktopUpdate = update;
      setAvailable({ version: update.version, notes: update.body ?? "", platform: "desktop" });
    }
  } catch {
    // Update checks are best-effort and never interrupt startup or playback.
  } finally {
    checking = false;
  }
}

async function installUpdate() {
  const update = available();
  if (!update) return;
  setInstalling(true);
  setError(false);
  try {
    if (update.platform === "desktop" && desktopUpdate) {
      await desktopUpdate.downloadAndInstall();
    } else if (update.url) {
      await openUrl(update.url);
    }
  } catch {
    setError(true);
  } finally {
    setInstalling(false);
  }
}

export function UpdateCard() {
  return (
    <Show when={available()}>
      {(update) => (
        <section class="update-card" aria-live="polite">
          <div class="update-card-version">Veloly {update().version}</div>
          <p class="update-card-description">{t.updateAvailable}</p>
          <button class="update-card-button" onClick={() => void installUpdate()} disabled={installing()}>
            {installing() ? <span aria-hidden="true">◌</span> : <IconDownload />}
            {installing()
              ? t.updateInstalling
              : update().platform === "desktop"
                ? t.updateInstallDesktop
                : update().platform === "android"
                  ? t.updateInstallAndroid
                  : t.updateInstallIOS}
          </button>
          <Show when={error()}><p class="update-card-error">{t.updateError}</p></Show>
        </section>
      )}
    </Show>
  );
}
