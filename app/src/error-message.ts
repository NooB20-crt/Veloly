import { t } from "./i18n";

/** Remplace les erreurs techniques les plus fréquentes par une explication et une action utile. */
export function userError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  const normalized = detail.toLowerCase();

  if (/yt-dlp|youtube.*unavailable/.test(normalized)) return t.errorYoutube;
  if (/network error|timed? out|dns|connection|connect|request failed|internet/.test(normalized)) return t.errorNetwork;
  if (/audio output|no output|device unavailable/.test(normalized)) return t.errorAudio;
  if (/file error|no such file|permission denied|cannot find the path/.test(normalized)) return t.errorFile;
  if (/track not found|song not found|playlist not found|private playlist|unavailable/.test(normalized)) return t.errorUnavailable;
  return detail ? t.errorGeneric(detail) : t.errorTryAgain;
}
