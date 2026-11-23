import { IconClose, IconFolderPlus, IconLink } from "./icons";
import { t } from "./i18n";

export function WelcomeDialog(props: { onClose: () => void; onAddMusic: () => void; onImport: () => void }) {
  return (
    <div class="dialog-layer" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="dialog welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onKeyDown={(e) => e.key === "Escape" && props.onClose()}>
        <div class="dialog-head">
          <h2 id="welcome-title">{t.welcomeIntroTitle}</h2>
          <button class="icon-btn" title={t.closeLabel} aria-label={t.closeLabel} onClick={props.onClose}><IconClose /></button>
        </div>
        <p class="muted small">{t.welcomeIntroText}</p>
        <div class="welcome-actions">
          <button class="primary" onClick={props.onAddMusic}><IconFolderPlus /> {t.welcomeAddMusic}</button>
          <button class="ghost" onClick={props.onImport}><IconLink /> {t.welcomeImport}</button>
        </div>
        <button class="link-btn welcome-skip" onClick={props.onClose}>{t.welcomeSkip}</button>
      </section>
    </div>
  );
}
