import { DEFAULT_CUSTOMIZATION, type Customization } from "./api";
import { setBrandColors } from "./theme";

/** Applique et mémorise uniquement la palette sélectionnée par l'utilisateur. */
export function applyCustomization(value?: Partial<Customization> | null) {
  const customization = { ...DEFAULT_CUSTOMIZATION, ...value };
  if (!/^#[0-9a-f]{6}$/i.test(customization.primaryColor)) customization.primaryColor = DEFAULT_CUSTOMIZATION.primaryColor;
  if (!/^#[0-9a-f]{6}$/i.test(customization.secondaryColor)) customization.secondaryColor = DEFAULT_CUSTOMIZATION.secondaryColor;

  const primary = customization.primaryColor.toLowerCase();
  const secondary = customization.secondaryColor.toLowerCase();
  const root = document.documentElement.style;
  root.setProperty("--violet", primary);
  root.setProperty("--violet-deep", `color-mix(in srgb, ${primary} 68%, black)`);
  root.setProperty("--violet-light", secondary);
  root.setProperty("--accent", "var(--violet-light)");
  setBrandColors(primary, secondary);
}
