// Page Réglages, et fenêtre d'import de playlist.
import { getVersion } from "@tauri-apps/api/app";
import { open, save } from "@tauri-apps/plugin-dialog";
import { createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js";
import { api, DEFAULT_CUSTOMIZATION, FLAT_FX, type Customization, type Settings } from "./api";
import { applyCustomization } from "./customization";
import { EqPanel } from "./eq";
import { fx, setFx } from "./fx-store";
import { setVisualizerOn, visualizerOn } from "./visualizer";
import { clearHistory, collection, exportCollectionBackup, importCollectionBackup, importCollectionBackupData, importPlaylist, notify } from "./collection";
import { IconClose, IconLink } from "./icons";
import { lang, LANGUAGES, setLang, t, type Lang } from "./i18n";
import { eventShortcut, resetShortcuts, setShortcut, shortcutLabel, shortcutMap, type ShortcutAction } from "./shortcuts";
import { userError } from "./error-message";
import { UpdateCard, UpdateSettings } from "./update-card";
import { FeedbackDialog } from "./feedback";
import { feedbackAvailable, launchTelemetryAvailable, launchTelemetryEnabled, setLaunchTelemetryEnabled } from "./telemetry";
import { isAndroid, isIOS } from "./mobile";
import { ThemesPanel } from "./theme-ui";
import { clearCustomCss, customCss, setCustomCss } from "./themes";
import { setDiscordPresenceEnabled } from "./discord-presence";

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

function readGlowPreference() {
  try {
    return localStorage.getItem("veloly-glow-enabled") !== "false";
  } catch {
    return true;
  }
}

export function SettingsView(props: { onImport: () => void; onLibrary: () => void; onHistory: () => void; onReplayTour: () => void }) {
  const [settings, setSettings] = createSignal<Settings | null>(null);
  const [version, setVersion] = createSignal("");
  const [shareLaunchCount, setShareLaunchCount] = createSignal(false);
  const [glowEnabled, setGlowEnabled] = createSignal(readGlowPreference());
  const [feedbackOpen, setFeedbackOpen] = createSignal(false);
  const [listeningShortcut, setListeningShortcut] = createSignal<ShortcutAction | null>(null);
  let shortcutCapture: ((e: KeyboardEvent) => void) | undefined;

  onMount(async () => {
    document.documentElement.classList.toggle("no-glow", !glowEnabled());
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
    if (patch.discordPresence !== undefined) setDiscordPresenceEnabled(patch.discordPresence);
    if (patch.customization) applyCustomization(next.customization);
    try {
      setSettings(await api.setSettings(next));
    } catch (e) {
      setSettings(cur);
      if (patch.discordPresence !== undefined) setDiscordPresenceEnabled(cur.discordPresence);
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

  const changeGlow = (enabled: boolean) => {
    setGlowEnabled(enabled);
    document.documentElement.classList.toggle("no-glow", !enabled);
    try {
      localStorage.setItem("veloly-glow-enabled", String(enabled));
    } catch {
      // Le réglage reste actif pour cette session si le stockage local n'est pas disponible.
    }
  };

  const exportBackup = async () => {
    const path = await save({
      defaultPath: "veloly-backup.json",
      filters: [{ name: "Veloly backup", extensions: ["json"] }],
    });
    if (path) await exportCollectionBackup(path);
  };

  const importBackup = async () => {
    if (isAndroid || isIOS) {
      // Sur mobile, laisser le sélecteur système fournir le contenu au WebView. Les chemins
      // retournés par les fournisseurs iOS (Files/iCloud) ne sont pas toujours lisibles par std::fs.
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file || !window.confirm(t.backupReplaceConfirm)) return;
        try {
          await importCollectionBackupData(await file.text());
        } catch (e) {
          notify(userError(e), "error");
        }
      };
      input.click();
      return;
    }
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

            <Show when={!isAndroid && !isIOS}>
              <section class="settings-group">
                <h2 class="section-title">{t.discord}</h2>
                <Row title={t.discordPresence} hint={t.discordPresenceHint}>
                  <Toggle on={s().discordPresence} label={t.discordPresence} onChange={(enabled) => change({ discordPresence: enabled })} />
                </Row>
              </section>
            </Show>

            <section class="settings-group">
              <h2 class="section-title">{t.customization}</h2>
              <Row title={t.primaryColor} hint={t.primaryColorHint}>
                <div class="color-options" role="radiogroup" aria-label={t.primaryColor}>
                  <For each={["#304ffe", "#8738e8", "#e91e63", "#ff781f", "#149b55", "#08a9d8", "#9e9e9e"]}>
                    {(color) => (
                      <button type="button" class="color-swatch" classList={{ selected: (s().customization?.primaryColor ?? DEFAULT_CUSTOMIZATION.primaryColor).toLowerCase() === color }}
                        style={{ "--swatch": color }} role="radio" aria-checked={(s().customization?.primaryColor ?? DEFAULT_CUSTOMIZATION.primaryColor).toLowerCase() === color}
                        aria-label={`${t.colorChoice} ${color}`} onClick={() => updateCustomization({ primaryColor: color })} />
                    )}
                  </For>
                  <label class="color-wheel" classList={{ selected: !["#304ffe", "#8738e8", "#e91e63", "#ff781f", "#149b55", "#08a9d8", "#9e9e9e"].includes((s().customization?.primaryColor ?? DEFAULT_CUSTOMIZATION.primaryColor).toLowerCase()) }} title={t.customColor}>
                    <input class="color-wheel-input" type="color" value={s().customization?.primaryColor ?? DEFAULT_CUSTOMIZATION.primaryColor} aria-label={t.customColor}
                      onInput={(e) => { const customization = { ...DEFAULT_CUSTOMIZATION, ...s().customization, primaryColor: e.currentTarget.value }; setSettings({ ...s(), customization }); applyCustomization(customization); }}
                      onChange={(e) => updateCustomization({ primaryColor: e.currentTarget.value })} />
                  </label>
                  <button class="ghost custom-color-reset" onClick={() => updateCustomization(DEFAULT_CUSTOMIZATION)}>{t.resetColors}</button>
                </div>
              </Row>
              <Row title={t.glowEffects} hint={t.glowEffectsHint}>
                <Toggle on={glowEnabled()} label={t.glowEffects} onChange={changeGlow} />
              </Row>
              <ThemesPanel />
              <div class="settings-css">
                <div class="settings-css-head">
                  <div class="setting-text">
                    <div class="setting-title">{t.customCss}</div>
                    <div class="setting-hint">{t.customCssHint}</div>
                  </div>
                  <button class="ghost" onClick={clearCustomCss} disabled={!customCss().trim()}>{t.clearCustomCss}</button>
                </div>
                <textarea
                  class="css-editor"
                  rows={6}
                  spellcheck={false}
                  autocapitalize="off"
                  autocomplete="off"
                  placeholder={".np-title {\n  font-style: italic;\n}"}
                  value={customCss()}
                  onInput={(event) => setCustomCss(event.currentTarget.value)}
                  aria-label={t.customCss}
                />
              </div>
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
              <Row title={t.version(version() || "-")}>
                <UpdateSettings />
              </Row>
              <Row title={t.replayTour} hint={t.replayTourHint}>
                <button class="ghost" onClick={props.onReplayTour}>{t.replayTourButton}</button>
              </Row>
              <Show when={feedbackAvailable()}>
                <Row title={t.feedbackTitle} hint={t.feedbackSettingHint}>
                  <button class="ghost" onClick={() => setFeedbackOpen(true)}>{t.feedbackOpen}</button>
                </Row>
              </Show>
            </section>
          </>
        )}
      </Show>
      <Show when={feedbackOpen()}>
        <FeedbackDialog onClose={() => setFeedbackOpen(false)} onSent={() => { setFeedbackOpen(false); notify(t.feedbackSent); }} />
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
          placeholder="https://…"
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
