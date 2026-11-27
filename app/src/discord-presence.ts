import { createSignal } from "solid-js";

const [enabled, setEnabled] = createSignal(false);

export const discordPresenceEnabled = enabled;
export const setDiscordPresenceEnabled = setEnabled;
