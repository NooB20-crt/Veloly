import { createSignal, onMount } from "solid-js";
import { getVersion } from "@tauri-apps/api/app";
import { IconClose } from "./icons";
import { t } from "./i18n";
import { sendFeedback } from "./telemetry";

type Category = "idea" | "bug" | "other";

export function FeedbackDialog(props: { onClose: () => void; onSent: () => void }) {
  const [category, setCategory] = createSignal<Category>("idea");
  const [message, setMessage] = createSignal("");
  const [version, setVersion] = createSignal("-");
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal("");
  onMount(() => getVersion().then(setVersion).catch(() => {}));

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const text = message().trim();
    if (text.length < 8) { setError(t.feedbackTooShort); return; }
    if (text.length > 1500 || sending()) return;
    setSending(true);
    setError("");
    try {
      await sendFeedback(category(), text, version());
      props.onSent();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(code === "rate_limited"
        ? t.feedbackRateLimited
        : code === "discord_unavailable"
          ? t.feedbackDiscordUnavailable
          : code === "feedback_unavailable"
            ? t.feedbackNotConfigured
            : t.feedbackFailed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="dialog-layer" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onKeyDown={(e) => e.key === "Escape" && props.onClose()}>
        <div class="dialog-head">
          <h2 id="feedback-title">{t.feedbackTitle}</h2>
          <button class="icon-btn" title={t.closeLabel} aria-label={t.closeLabel} onClick={props.onClose}><IconClose /></button>
        </div>
        <p class="muted small">{t.feedbackIntro}</p>
        <form class="feedback-form" onSubmit={submit}>
          <label class="feedback-label" for="feedback-category">{t.feedbackCategory}</label>
          <select id="feedback-category" class="setting-select" value={category()} onChange={(e) => setCategory(e.currentTarget.value as Category)}>
            <option value="idea">{t.feedbackIdea}</option>
            <option value="bug">{t.feedbackBug}</option>
            <option value="other">{t.feedbackOther}</option>
          </select>
          <label class="feedback-label" for="feedback-message">{t.feedbackMessage}</label>
          <textarea id="feedback-message" class="dialog-input feedback-textarea" value={message()} maxLength={1500} placeholder={t.feedbackPlaceholder} onInput={(e) => setMessage(e.currentTarget.value)} />
          <div class="feedback-meta"><span>{t.feedbackPrivacy}</span><span>{message().length}/1500</span></div>
          {error() && <p class="feedback-error" role="alert">{error()}</p>}
          <div class="dialog-actions">
            <button class="ghost" type="button" onClick={props.onClose}>{t.cancel}</button>
            <button class="primary" type="submit" disabled={sending() || message().trim().length < 8}>{sending() ? t.feedbackSending : t.feedbackSend}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
