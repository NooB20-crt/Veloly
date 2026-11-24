const consentKey = "veloly.telemetry.firstLaunchConsent.v1";
const installIdKey = "veloly.telemetry.installId.v1";
const sentKey = "veloly.telemetry.firstLaunchSent.v1";
const pendingDeleteKey = "veloly.telemetry.firstLaunchPendingDelete.v1";
const feedbackClientKey = "veloly.feedback.clientId.v1";
const endpoint = (import.meta.env.VITE_VELOLY_TELEMETRY_URL as string | undefined)?.trim().replace(/\/$/, "");

export const launchTelemetryAvailable = () => !!endpoint;
export const feedbackAvailable = () => !!endpoint;

/** Sends only the text the user submits, with an anonymous local ID used for a short cooldown. */
export async function sendFeedback(category: "idea" | "bug" | "other", message: string, version: string) {
  if (!endpoint) throw new Error("feedback_unavailable");
  let clientId: string;
  try {
    clientId = localStorage.getItem(feedbackClientKey) ?? crypto.randomUUID();
    localStorage.setItem(feedbackClientKey, clientId);
  } catch {
    clientId = crypto.randomUUID();
  }
  const response = await fetch(`${endpoint}/v1/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, message, version, clientId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `feedback_http_${response.status}`);
  }
}

export function launchTelemetryEnabled(): boolean {
  try {
    return localStorage.getItem(consentKey) === "1";
  } catch {
    return false;
  }
}

export function setLaunchTelemetryEnabled(enabled: boolean) {
  try {
    localStorage.setItem(consentKey, enabled ? "1" : "0");
  } catch {
    // If local storage is unavailable, telemetry remains disabled.
  }
  if (enabled) {
    void recordFirstLaunch();
  } else {
    void forgetFirstLaunch();
  }
}

async function forgetFirstLaunch() {
  if (!endpoint) return;
  try {
    const id = localStorage.getItem(installIdKey);
    if (!id || localStorage.getItem(sentKey) !== "1") return;
    localStorage.setItem(pendingDeleteKey, "1");
    const response = await fetch(`${endpoint}/v1/first-launch`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installId: id }),
    });
    if (response.ok) {
      localStorage.removeItem(sentKey);
      localStorage.removeItem(pendingDeleteKey);
    }
  } catch {
    // The opt-out is immediate locally; a later app launch can retry the remote deletion.
  }
}

function installId(): string | null {
  try {
    let id = localStorage.getItem(installIdKey);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(installIdKey, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Reports one anonymous first launch per local app profile, only after the user opts in. */
export async function recordFirstLaunch() {
  if (!endpoint) return;
  try {
    if (!launchTelemetryEnabled()) {
      if (localStorage.getItem(pendingDeleteKey) === "1") await forgetFirstLaunch();
      return;
    }
    if (localStorage.getItem(pendingDeleteKey) === "1") await forgetFirstLaunch();
    if (localStorage.getItem(sentKey) === "1") return;
    const id = installId();
    if (!id) return;
    const response = await fetch(`${endpoint}/v1/first-launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installId: id }),
    });
    if (response.ok) localStorage.setItem(sentKey, "1");
  } catch {
    // Offline or not configured: retry on a later launch, never interrupt playback.
  }
}
