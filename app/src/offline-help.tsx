import { IconClose } from "./icons";
import { lang, t } from "./i18n";
import { offlineGuide } from "./offline-guide";

export function OfflineHelpDialog(props: { onClose: () => void }) {
  const guide = () => offlineGuide[lang()];
  return (
    <div class="dialog-layer" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="dialog offline-guide" role="dialog" aria-modal="true" aria-labelledby="offline-guide-title">
        <div class="dialog-head">
          <h2 id="offline-guide-title">{guide().title}</h2>
          <button class="icon-btn" title={t.closeLabel} aria-label={t.closeLabel} onClick={props.onClose}>
            <IconClose />
          </button>
        </div>
        <p class="muted small">{guide().intro}</p>
        <ol class="offline-guide-steps">
          {guide().steps.map((step) => (
            <li>
              <strong>{step.title}</strong>
              <p class="muted small">{step.text}</p>
            </li>
          ))}
        </ol>
        <div class="dialog-actions">
          <button class="primary" onClick={props.onClose}>{t.gotIt}</button>
        </div>
      </section>
    </div>
  );
}
