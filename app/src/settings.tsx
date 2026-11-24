// Page Réglages, et fenêtre d'import de playlist.
import { getVersion } from "@tauri-apps/api/app";
import { open, save } from "@tauri-apps/plugin-dialog";
import { createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js";
import { api, DEFAULT_CUSTOMIZATION, FLAT_FX, type Customization, type Settings } from "./api";
import { applyCustomization } from "./customization";
import { EqPanel } from "./eq";
import { fx, setFx } from "./fx-store";
import { setVisualizerOn, visualizerOn } from "./visualizer";
import { clearHistory, collection, exportCollectionBackup, importCollectionBackup, importPlaylist, notify } from "./collection";
import { IconClose, IconLink } from "./icons";
import { lang, LANGUAGES, setLang, t, type Lang } from "./i18n";
import { eventShortcut, resetShortcuts, setShortcut, shortcutLabel, shortcutMap, type ShortcutAction } from "./shortcuts";
import { userError } from "./error-message";
import { UpdateCard } from "./update-card";
import { launchTelemetryAvailable, launchTelemetryEnabled, setLaunchTelemetryEnabled } from "./telemetry";

/** Une ligne de réglage : intitulé, explication, et la commande à droite. */
function Row(props: { title: string; hint?: string; children?: JSX.Element }) {
  return (
    <div class="setting">
      <div class="setting-text">
        <div class="setting-title">{props.title}</div>
        <Show when={props.hint}>
          <div class="setting-hint">{props.hint}</div>
        </Show>
      </div>
      <Show when={props.children}>
        <div class="setting-control">{props.children}</div>
      </Show>
    </div>
  );
}

function Toggle(props: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button class={`switch ${props.on ? "on" : ""}`} role="switch" aria-checked={props.on} aria-label={props.label} onClick={() => props.onChange(!props.on)}>
      <span class="switch-thumb" />
    </button>
  );
}

export function SettingsView(props: { onImport: () => void; onLibrary: () => void; onHistory: () => void }) {
  const [settings, setSettings] = createSignal<Settings | null>(null);
  const [version, setVersion] = createSignal("");
  const [shareLaunchCount, setShareLaunchCount] = createSignal(false);
  const [listeningShortcut, setListeningShortcut] = createSignal<ShortcutAction | null>(null);
  let shortcutCapture: ((e: KeyboardEvent) => void) | undefined;

  onMount(async () => {
    setShareLaunchCount(launchTelemetryEnabled());
    try {
      const loaded = await api.getSettings();
      setSettings(loaded);
      applyCustomization(loaded.customization);
    } catch (e) {
      notify(userError(e), "error");
    }
    getVersion().then(setVersion).catch(() => {});
  });

  /** Change un réglage : appliqué et enregistré tout de suite. */
  const change = async (patch: Partial<Settings>) => {
    const cur = settings();
    if (!cur) return;
    // Les effets se règlent ailleurs (égaliseur) : on garde toujours leur valeur la plus récente.
    const next = { ...cur, ...patch, fx: fx() };
    setSettings(next);
    if (patch.customization) applyCustomization(next.customization);
    try {
      setSettings(await api.setSettings(next));
    } catch (e) {
      setSettings(cur);
      if (patch.customization) applyCustomization(cur.customization);
      notify(userError(e), "error");
    }
  };

  const updateCustomization = (patch: Partial<Customization>) => {
    const cur = settings();
    if (!cur) return;
    void change({ customization: { ...DEFAULT_CUSTOMIZATION, ...cur.customization, ...patch } });
  };

  const crossfadeLabel = (s: number) => (s === 0 ? t.off : `${s} s`);

  const exportBackup = async () => {
    const path = await save({
      defaultPath: "veloly-backup.json",
      filters: [{ name: "Veloly backup", extensions: ["json"] }],
    });
    if (path) await exportCollectionBackup(path);
  };

  const importBackup = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "Veloly backup", extensions: ["json"] }],
    });
    if (typeof path !== "string" || !window.confirm(t.backupReplaceConfirm)) return;
    await importCollectionBackup(path);
  };

  const listenForShortcut = (action: ShortcutAction) => {
    if (shortcutCapture) window.removeEventListener("keydown", shortcutCapture, true);
    setListeningShortcut(action);
    shortcutCapture = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      if (e.code === "Escape") {
        setListeningShortcut(null);
      } else if (["Backspace", "Delete"].includes(e.code) && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setShortcut(action, null);
        setListeningShortcut(null);
      } else {
        setShortcut(action, eventShortcut(e));
        setListeningShortcut(null);
      }
      if (shortcutCapture) window.removeEventListener("keydown", shortcutCapture, true);
      shortcutCapture = undefined;
    };
    window.addEventListener("keydown", shortcutCapture, true);
  };

  onCleanup(() => {
    if (shortcutCapture) window.removeEventListener("keydown", shortcutCapture, true);
  });

  return (
    <div class="settings-page">
      <div class="mobile-update-card"><UpdateCard /></div>
      <div class="page-head">
        <h1>{t.settings}</h1>
      </div>
      <Show when={settings()}>
        {(s) => (
          <>
            <section class="settings-group">
              <h2 class="section-title">{t.general}</h2>
              <Row title={t.language} hint={t.languageHint}>
                <div class="segmented" role="radiogroup" aria-label={t.language}>
                  <For each={LANGUAGES}>
                    {(l) => (
                      <button
                        role="radio"
                        aria-checked={lang() === l.id}
                        classList={{ on: lang() === l.id }}
                        onClick={() => setLang(l.id as Lang)}
                      >
                        {l.name}
                      </button>
                    )}
                  </For>
                </div>
              </Row>
            </section>

            <section class="settings-group">
              <h2 class="section-title">{t.customization}</h2>
              <Row title={t.primaryColor} hint={t.primaryColorHint}>
                <div class="actions">
                  <input class="custom-color" type="color" value={s().customization?.primaryColor ?? DEFAULT_CUSTOMIZATION.primaryColor} aria-label={t.primaryColor}
                    onInput={(e) => { const customization = { ...DEFAULT_CUSTOMIZATION, ...s().customization, primaryColor: e.currentTarget.value }; setSettings({ ...s(), customization }); applyCustomization(customization); }}
                    onChange={(e) => updateCustomization({ primaryColor: e.currentTarget.value })} />
                  <button class="ghost custom-color-reset" onClick={() => updateCustomization(DEFAULT_CUSTOMIZATION)}>{t.resetColors}</button>
                </div>
              </Row>
              <Row title={t.secondaryColor} hint={t.secondaryColorHint}>
                <input class="custom-color" type="color" value={s().customization?.secondaryColor ?? DEFAULT_CUSTOMIZATION.secondaryColor} aria-label={t.secondaryColor}
                  onInput={(e) => { const customization = { ...DEFAULT_CUSTOMIZATION, ...s().customization, secondaryColor: e.currentTarget.value }; setSettings({ ...s(), customization }); applyCustomization(customization); }}
                  onChange={(e) => updateCustomization({ secondaryColor: e.currentTarget.value })} />
              </Row>
            </section>

            <Show when={launchTelemetryAvailable()}>
              <section class="settings-group">
                <h2 class="section-title">{t.privacy}</h2>
                <Row title={t.launchStats} hint={t.launchStatsHint}>
                  <Toggle
                    on={shareLaunchCount()}
                    label={t.launchStats}
                    onChange={(enabled) => {
                      setShareLaunchCount(enabled);
                      setLaunchTelemetryEnabled(enabled);
                    }}
                  />
                </Row>
              </section>
            </Show>

            <section class="settings-group">
              <h2 class="section-title">{t.playback}</h2>
              <Row title={t.crossfade} hint={t.crossfadeHint}>
                <div class="setting-range">
                  <input
                    type="range"
                    class="slider"
                    min="0"
                    max="12"
                    step="1"
                    value={s().crossfade}
                    style={{ "--pct": `${(s().crossfade / 12) * 100}%` }}
                    aria-label={t.crossfadeLabel}
                    onInput={(e) => setSettings({ ...s(), crossfade: Number(e.currentTarget.value) })}
                    onChange={(e) => change({ crossfade: Number(e.currentTarget.value) })}
                  />
                  <span class="setting-value">{crossfadeLabel(s().crossfade)}</span>
                </div>
              </Row>
              <Row title={t.resume} hint={t.resumeHint}>
                <Toggle on={s().resume} label={t.resume} onChange={(on) => change({ resume: on })} />
              </Row>
              <div class="settings-shortcuts-head">
                <div class="setting-title">{t.keyboardShortcuts}</div>
                <button class="ghost" onClick={resetShortcuts}>{t.resetShortcuts}</button>
              </div>
              <For each={[
                ["playPause", t.shortcutPlayPause],
                ["previous", t.shortcutPrevious],
                ["next", t.shortcutNext],
                ["volumeDown", t.shortcutVolumeDown],
                ["volumeUp", t.shortcutVolumeUp],
                ["lyrics", t.shortcutLyrics],
              ] as [ShortcutAction, string][]}>
                {([action, title]) => (
                  <Row title={title}>
                    <button class="ghost shortcut-key" onClick={() => listenForShortcut(action)}>
                      {listeningShortcut() === action ? t.pressShortcut : shortcutLabel(shortcutMap()[action])}
                    </button>
                  </Row>
                )}
              </For>
            </section>

            <section class="settings-group">
              <h2 class="section-title">{t.sound}</h2>
              <Row title={t.visualizer} hint={t.visualizerHint}>
                <Toggle on={visualizerOn()} label={t.visualizer} onChange={setVisualizerOn} />
              </Row>
              <div class="settings-eq">
                <div class="settings-eq-head">
                  <div class="setting-title">{t.equalizer}</div>
                  <button class="ghost" onClick={() => setFx(FLAT_FX)}>{t.eqReset}</button>
                </div>
                <EqPanel />
              </div>
            </section>

            <section class="settings-group">
              <h2 class="section-title">{t.library}</h2>
              <Row title={t.jamendoClientId} hint={t.jamendoClientIdHint}>
                <input
                  class="setting-text-input"
                  type="text"
                  value={s().jamendoClientId ?? ""}
                  placeholder={t.jamendoClientIdPlaceholder}
                  autocomplete="off"
                  spellcheck={false}
                  onBlur={(e) => {
                    const value = e.currentTarget.value.trim() || null;
                    if (value !== (s().jamendoClientId ?? null)) void change({ jamendoClientId: value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </Row>
              <Row title={t.collectionBackup} hint={t.collectionBackupHint}>
                <div class="actions">
                  <button class="ghost" onClick={exportBackup}>{t.exportBackup}</button>
                  <button class="ghost" onClick={importBackup}>{t.restoreBackup}</button>
                </div>
              </Row>
              <Row title={t.importPlaylist} hint={t.importHint}>
                <button class="ghost" onClick={props.onImport}>
                  <IconLink /> {t.import}
                </button>
              </Row>
              <Row title={t.musicFolders} hint={t.musicFoldersHint}>
                <button class="ghost" onClick={props.onLibrary}>{t.openLibrary}</button>
              </Row>
              <Row title={t.listeningHistory} hint={t.historyHint(collection().history.length)}>
                <div class="actions">
                  <button class="ghost" onClick={props.onHistory}>{t.openHistory}</button>
                  <button class="ghost" onClick={clearHistory} disabled={collection().history.length === 0}>
                    {t.clear}
                  </button>
                </div>
              </Row>
            </section>

            <section class="settings-group">
              <h2 class="section-title">Veloly</h2>
              <Row title={t.version(version() || "-")} />
            </section>
          </>
        )}
      </Show>
    </div>
  );
}

/** Fenêtre d'import : un lien, puis la recherche des morceaux, puis la playlist s'ouvre. */
export function ImportDialog(props: { onClose: () => void; onDone: (id: string) => void }) {
  const [url, setUrl] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [progress, setProgress] = createSignal<[number, number] | null>(null);
  let input: HTMLTextAreaElement | undefined;
  onMount(() => requestAnimationFrame(() => input?.focus()));
  /** Plusieurs liens collés (morceaux Spotify) : le champ s'agrandit et dit combien. */
  const songLinks = () => (url().match(/(\/track\/|spotify:track:)[A-Za-z0-9]{22}/g) ?? []).length;

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!url().trim() || busy()) return;
    setBusy(true);
    setProgress(null);
    const id = await importPlaylist(url().trim(), (done, total) => setProgress([done, total]));
    setBusy(false);
    if (id) props.onDone(id);
  };

  return (
    <div class="dialog-layer" onMouseDown={(e) => e.target === e.currentTarget && !busy() && props.onClose()}>
      <form class="dialog" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && !busy() && props.onClose()}>
        <div class="dialog-head">
          <h2>{t.importPlaylist}</h2>
          <button type="button" class="icon-btn" title={t.closeLabel} onClick={props.onClose} disabled={busy()}>
            <IconClose />
          </button>
        </div>
        <p class="muted small">{t.importText}</p>
        <textarea
          ref={input}
          class="dialog-input"
          classList={{ multi: songLinks() > 1 }}
          rows={1}
          inputMode="url"
          placeholder="https://open.spotify.com/playlist/…"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Entrée valide, comme dans un champ d'une ligne.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={busy()}
          spellcheck={false}
        />
        <Show when={songLinks() > 0 && !busy()}>
          <span class="muted small">{t.songLinks(songLinks())}</span>
        </Show>
        <Show when={busy()}>
          <div class="dialog-progress">
            <div class="engine-bar">
              <div style={{ width: progress() && progress()![1] ? `${(progress()![0] / progress()![1]) * 100}%` : "15%" }} />
            </div>
            <span class="muted small">
              {progress() ? t.findingTracks(progress()![0], progress()![1]) : t.readingPlaylist}
            </span>
          </div>
        </Show>
        <div class="dialog-actions">
          <button type="button" class="ghost" onClick={props.onClose} disabled={busy()}>
            {t.cancel}
          </button>
          <button type="submit" class="primary" disabled={busy() || !url().trim()}>
            {busy() ? t.importing : t.import}
          </button>
        </div>
      </form>
    </div>
  );
}
