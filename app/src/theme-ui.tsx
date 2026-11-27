import { For, Show } from "solid-js";
import { notify } from "./collection";
import { t } from "./i18n";
import { IconClose } from "./icons";
import { activeThemeId, importThemeFile, installedThemes, removeTheme, setActiveTheme } from "./themes";

export function ThemesPanel() {
  let file: HTMLInputElement | undefined;

  const onFile = async (event: Event & { currentTarget: HTMLInputElement }) => {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selected) return;
    try {
      const theme = await importThemeFile(selected);
      notify(t.themeInstalled(theme.name));
    } catch (error) {
      notify(String(error).includes("too-big") ? t.themeTooBig : t.themeImportFailed, "error");
    }
  };

  return (
    <div class="themes">
      <div class="setting-text">
        <div class="setting-title">{t.themes}</div>
        <div class="setting-hint">{t.themesHint}</div>
      </div>
      <div class="theme-list" role="radiogroup" aria-label={t.themes}>
        <ThemeRow name={t.noTheme} on={activeThemeId() === null} onPick={() => setActiveTheme(null)} />
        <For each={installedThemes()}>
          {(theme) => (
            <ThemeRow
              name={theme.name}
              author={theme.author}
              on={activeThemeId() === theme.id}
              onPick={() => setActiveTheme(theme.id)}
              onRemove={() => removeTheme(theme.id)}
            />
          )}
        </For>
      </div>
      <div class="actions theme-actions">
        <button class="ghost" onClick={() => file?.click()}>{t.importTheme}</button>
        <input ref={file} type="file" accept=".css,text/css" hidden onChange={onFile} />
      </div>
    </div>
  );
}

function ThemeRow(props: { name: string; author?: string; on: boolean; onPick: () => void; onRemove?: () => void }) {
  return (
    <div classList={{ "theme-row": true, on: props.on }}>
      <button class="theme-pick" role="radio" aria-checked={props.on} onClick={props.onPick}>
        <span class="theme-dot" />
        <span class="theme-name">{props.name}</span>
        <Show when={props.author}><span class="theme-author">{t.byAuthor(props.author!)}</span></Show>
      </button>
      <Show when={props.onRemove}>
        <button class="icon-btn" title={t.removeTheme} aria-label={t.removeTheme} onClick={props.onRemove}>
          <IconClose />
        </button>
      </Show>
    </div>
  );
}
