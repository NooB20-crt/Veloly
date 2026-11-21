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

/** Violet de marque, conservé même lorsque la pochette du morceau change. */
const BRAND_SOURCE = argbFromHex("#9718ed");

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

let current = -1;

/** Applique le schéma Material 3 sombre d'une couleur source. */
function apply(source: number) {
  if (source === current) return;
  current = source;
  const scheme = new SchemeContent(Hct.fromInt(source), true, 0);
  const root = document.documentElement.style;
  for (const [name, color] of Object.entries(ROLES)) {
    root.setProperty(`--md-${name}`, hexFromArgb(color.getArgb(scheme)));
  }
}

/** La pochette change le fond flou, mais pas la couleur de marque de l'interface. */
export function themeFromCover(_url: string | null) {
  apply(BRAND_SOURCE);
}

// Palette violette dès le démarrage.
apply(BRAND_SOURCE);
