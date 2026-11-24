import { createSignal, For } from "solid-js";
import { IconClose, IconCompass, IconFolderPlus, IconHeart, IconLibrary, IconLink, IconLyrics, IconNote, IconPlay, IconQueue, IconSettings } from "./icons";
import { t } from "./i18n";

const steps = [
  { title: () => t.tourDiscoverTitle, text: () => t.tourDiscoverText, icon: IconCompass, kind: "discover" },
  { title: () => t.tourLibraryTitle, text: () => t.tourLibraryText, icon: IconLibrary, kind: "library" },
  { title: () => t.tourPlayerTitle, text: () => t.tourPlayerText, icon: IconNote, kind: "player" },
  { title: () => t.tourPersonalTitle, text: () => t.tourPersonalText, icon: IconSettings, kind: "personal" },
] as const;

export function WelcomeDialog(props: { onClose: () => void; onAddMusic: () => void; onImport: () => void }) {
  const [current, setCurrent] = createSignal(0);
  const active = () => steps[current()];
  const next = () => current() < steps.length - 1 ? setCurrent(current() + 1) : props.onClose();
  const previous = () => setCurrent(Math.max(0, current() - 1));

  return (
    <div class="dialog-layer welcome-tour-layer" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="dialog welcome-tour" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") previous();
      }}>
        <div class="dialog-head welcome-tour-head">
          <div class="welcome-tour-brand"><span class="welcome-tour-mark">V</span><span>VELOLY <small>{t.tourLabel}</small></span></div>
          <button class="icon-btn" title={t.closeLabel} aria-label={t.closeLabel} onClick={props.onClose}><IconClose /></button>
        </div>

        <div class="welcome-tour-art" aria-hidden="true" classList={{ [`tour-art-${active().kind}`]: true }}>
          <div class="tour-orbit tour-orbit-one" /><div class="tour-orbit tour-orbit-two" />
          <div class="tour-preview-nav">
            <For each={steps}>{(step, index) => {
              const StepIcon = step.icon;
              return <button classList={{ active: current() === index() }} aria-label={t.tourGoToStep(index() + 1)} onClick={() => setCurrent(index())}><StepIcon /></button>;
            }}</For>
          </div>
          <div class="tour-preview-card">
            {current() === 0 && <>
              <span class="tour-preview-kicker">{t.discover}</span>
              <div class="tour-search"><span><IconCompass /> {t.tourSearchMock}</span><IconHeart size={16} /></div>
              <div class="tour-cover-row"><i /><i /><i /></div>
              <div class="tour-preview-lines"><b /><b /><b /></div>
            </>}
            {current() === 1 && <>
              <span class="tour-preview-kicker">{t.tourYourSpace}</span>
              <div class="tour-library-row"><span class="tour-cover mini-cover">♫</span><span><b>{t.tourTrackMock}</b><small>{t.tourArtistMock}</small></span><IconPlay size={16} /></div>
              <div class="tour-library-actions"><span><IconFolderPlus /> {t.welcomeAddMusic}</span><span><IconLink /> {t.welcomeImport}</span></div>
            </>}
            {current() === 2 && <>
              <span class="tour-preview-kicker">{t.nowPlaying}</span>
              <div class="tour-player-art"><IconNote /></div>
              <div class="tour-preview-lines centered"><b /><b /></div>
              <div class="tour-player-controls"><span>‹</span><i><IconPlay size={17} /></i><span>›</span></div>
              <div class="tour-progress"><b /></div>
              <div class="tour-chip-row"><span><IconQueue /> {t.queue}</span><span><IconLyrics /> {t.lyrics}</span></div>
            </>}
            {current() === 3 && <>
              <span class="tour-preview-kicker">{t.settings}</span>
              <div class="tour-setting-row"><span><IconSettings /> {t.tourSoundMock}</span><i /></div>
              <div class="tour-setting-row"><span><IconLyrics /> {t.lyrics}</span><i /></div>
              <div class="tour-setting-row"><span><IconHeart /> {t.tourThemeMock}</span><i /></div>
              <div class="tour-color-swatches"><i /><i /><i /><i /></div>
            </>}
          </div>
          <span class="tour-floating-note"><IconNote /></span>
        </div>

        <div class="welcome-tour-copy" aria-live="polite">
          <span class="tour-step-count">{t.tourStep(current() + 1, steps.length)}</span>
          <h2 id="welcome-title">{active().title()}</h2>
          <p class="muted">{active().text()}</p>
        </div>

        <div class="welcome-tour-footer">
          <div class="tour-dots" aria-label={t.tourProgress}>
            <For each={steps}>{(_, index) => <button classList={{ active: current() === index() }} aria-label={t.tourGoToStep(index() + 1)} onClick={() => setCurrent(index())} />}</For>
          </div>
          <div class="tour-actions">
            <button class="link-btn welcome-skip" onClick={props.onClose}>{t.welcomeSkip}</button>
            {current() > 0 && <button class="ghost" onClick={previous}>{t.tourPrevious}</button>}
            {current() === 1 && <>
              <button class="ghost tour-quick-action" onClick={props.onImport}><IconLink /> {t.welcomeImport}</button>
              <button class="primary tour-quick-action" onClick={props.onAddMusic}><IconFolderPlus /> {t.welcomeAddMusic}</button>
            </>}
            <button class="primary tour-next" onClick={next}>{current() === steps.length - 1 ? t.tourFinish : t.tourNext}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
