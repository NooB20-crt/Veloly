import { createSignal } from "solid-js";

/** Mode persistant à la session : l'état est initialisé depuis les préférences Tauri au démarrage. */
const [offlineMode, setOfflineMode] = createSignal(false);
export { offlineMode, setOfflineMode };
