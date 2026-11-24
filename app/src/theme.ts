// Palette Material You de Veloly : toute l'interface garde les couleurs de la marque.
// La bibliothèque officielle Material calcule les tons adaptés au mode sombre.
// Les couleurs sont des variables CSS déclarées avec `@property` (voir styles.css).
import {
  argbFromHex,
  DynamicColor,
  Hct,
  hexFromArgb,
  MaterialDynamicColors as C,
  SchemeContent,
} from "@material/material-color-utilities";

/** Couleurs de marque, conservées même lorsque la pochette du morceau change. */
const DEFAULT_PRIMARY = "#9718ed";
const DEFAULT_SECONDARY = "#d17aff";
let primarySource = argbFromHex(DEFAULT_PRIMARY);
let secondarySource = argbFromHex(DEFAULT_SECONDARY);

/** Rôles Material 3 utilisés par l'interface → variable CSS `--md-<nom>`. */
const ROLES: Record<string, DynamicColor> = {
  primary: C.primary,
  "on-primary": C.onPrimary,
  "primary-container": C.primaryContainer,
  "on-primary-container": C.onPrimaryContainer,
  "secondary-container": C.secondaryContainer,
  "on-secondary-container": C.onSecondaryContainer,
  tertiary: C.tertiary,
  "tertiary-container": C.tertiaryContainer,
  surface: C.surface,
  "surface-container-lowest": C.surfaceContainerLowest,
  "surface-container-low": C.surfaceContainerLow,
  "surface-container": C.surfaceContainer,
  "surface-container-high": C.surfaceContainerHigh,
  "surface-container-highest": C.surfaceContainerHighest,
  "on-surface": C.onSurface,
  "on-surface-variant": C.onSurfaceVariant,
  "outline-variant": C.outlineVariant,
  error: C.error,
  "error-container": C.errorContainer,
  "inverse-surface": C.inverseSurface,
  "inverse-on-surface": C.inverseOnSurface,
  "on-error-container": C.onErrorContainer,
};

let current = "";

/** Applique le schéma Material 3 sombre d'une couleur source. */
function apply(primary: number, secondary: number) {
  const key = `${primary}:${secondary}`;
  if (key === current) return;
  current = key;
  const scheme = new SchemeContent(Hct.fromInt(primary), true, 0);
  const secondaryScheme = new SchemeContent(Hct.fromInt(secondary), true, 0);
  const root = document.documentElement.style;
  for (const [name, color] of Object.entries(ROLES)) {
    const sourceScheme = name.startsWith("secondary-") || name.startsWith("tertiary") ? secondaryScheme : scheme;
    const sourceColor = name === "secondary-container" ? C.primaryContainer
      : name === "on-secondary-container" ? C.onPrimaryContainer
      : name === "tertiary" ? C.primary
      : name === "tertiary-container" ? C.primaryContainer
      : color;
    root.setProperty(`--md-${name}`, hexFromArgb(sourceColor.getArgb(sourceScheme)));
  }
}

/** La pochette change le fond flou, mais pas la couleur de marque de l'interface. */
export function themeFromCover(_url: string | null) {
  apply(primarySource, secondarySource);
}

/** Choisit les graines Material des deux couleurs personnalisées. */
export function setBrandColors(primary: string, secondary: string) {
  if (!/^#[0-9a-f]{6}$/i.test(primary) || !/^#[0-9a-f]{6}$/i.test(secondary)) return;
  primarySource = argbFromHex(primary);
  secondarySource = argbFromHex(secondary);
  apply(primarySource, secondarySource);
}

/** Génère automatiquement une couleur d'accent claire à partir de la teinte principale. */
export function generatedAccent(primary: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(primary)) return DEFAULT_SECONDARY;
  const source = Hct.fromInt(argbFromHex(primary));
  return hexFromArgb(Hct.from(source.hue, Math.max(32, source.chroma * 0.72), Math.min(88, Math.max(68, source.tone + 28))).toInt());
}

// Palette violette dès le démarrage.
apply(primarySource, secondarySource);
