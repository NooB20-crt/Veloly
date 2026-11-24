import { DEFAULT_CUSTOMIZATION, type Customization } from "./api";
import { setBrandColors } from "./theme";

/** Choisit noir ou blanc selon le contraste WCAG le plus élevé sur cette couleur. */
function readableForeground(hex: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const srgb = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#ffffff" : "#111018";
}

/** Applique et mémorise uniquement la palette sélectionnée par l'utilisateur. */
export function applyCustomization(value?: Partial<Customization> | null) {
  const customization = { ...DEFAULT_CUSTOMIZATION, ...value };
  if (!/^#[0-9a-f]{6}$/i.test(customization.primaryColor)) customization.primaryColor = DEFAULT_CUSTOMIZATION.primaryColor;
  if (!/^#[0-9a-f]{6}$/i.test(customization.secondaryColor)) customization.secondaryColor = DEFAULT_CUSTOMIZATION.secondaryColor;

  const primary = customization.primaryColor.toLowerCase();
  const secondary = customization.secondaryColor.toLowerCase();
  const root = document.documentElement.style;
  root.setProperty("--violet", primary);
  root.setProperty("--violet-deep", `color-mix(in srgb, ${primary} 68%, #000000)`);
  root.setProperty("--violet-light", secondary);
  root.setProperty("--on-violet", readableForeground(primary));
  root.setProperty("--on-violet-light", readableForeground(secondary));
  root.setProperty("--accent", "var(--violet-light)");
  setBrandColors(primary, secondary);
}
