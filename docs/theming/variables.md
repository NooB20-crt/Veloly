# CSS variables

CSS variables are the simplest way to restyle the whole app. Put them on `:root`:

```css
:root {
  --r-lg: 6px;
  --blue: #16a34a !important;
  --blue-deep: #14532d !important;
}
```

## Accent colors

555 themes use blue-named accent variables. Veloly maps these onto its violet palette when a theme or Custom CSS declares them.

| 555 variable | Veloly equivalent | Used for |
| --- | --- | --- |
| `--blue` | `--violet` | Main accent: buttons, switches, progress, and glows. |
| `--blue-deep` | `--violet-deep` | Dark end of accent gradients. |
| `--blue-light` | `--violet-light`, `--accent` | Small highlights and focus outlines. |

The application’s selected color is set directly on the document. Add `!important` to an accent variable when you want your theme’s color to take priority, as in the example above.

## Material palette

Veloly also uses Material 3 color roles. They are set by the player while it runs, so use `!important` to replace a role in CSS:

```css
:root {
  --md-primary: #ffd23b !important;
  --md-on-primary: #17120a !important;
  --md-primary-container: #6b4e00 !important;
}
```

| Variable | Used for |
| --- | --- |
| `--md-primary`, `--md-on-primary` | Primary accents and text on primary controls. |
| `--md-primary-container`, `--md-on-primary-container` | Tinted surfaces and text on them. |
| `--md-secondary-container`, `--md-on-secondary-container` | Secondary tinted surfaces. |
| `--md-tertiary`, `--md-tertiary-container` | Supporting accent colors and visualizer colors. |
| `--md-surface`, `--md-surface-container-lowest` … `--md-surface-container-highest` | Layered dark surfaces. |
| `--md-on-surface`, `--md-on-surface-variant` | Main and secondary text. |
| `--md-outline-variant` | Subtle separators and outlines. |
| `--md-error-container`, `--md-on-error-container` | Error surfaces and their text. |

For synchronized lyrics, `.lyric.on` is the active line and `.lyric.past` is a line already sung:

```css
.lyric.on {
  --md-on-surface: #2de2ff;
  --md-on-surface-variant: #ff2bd6;
}
```

## Text, surfaces, and layout

| Variable | Default | Used for |
| --- | --- | --- |
| `--bg` | `#000` | Main background. |
| `--text`, `--text-2`, `--text-3` | white and gray tones | Main text, secondary text, and subtle labels. |
| `--surface`, `--surface-2` | translucent white | Controls and panels at rest and on hover. |
| `--panel`, `--glass` | translucent dark colors | Sidebar, player, and frosted overlays. |
| `--line`, `--hairline`, `--shadow` | subtle borders and shadows | Separators and raised surfaces. |
| `--font`, `--display` | Manrope, Unbounded | Body text and display headings. |
| `--r-sm`, `--r-md`, `--r-lg`, `--r-pill` | `8px`, `14px`, `22px`, `999px` | Corner radii. |
| `--gap`, `--sidebar-w`, `--player-h` | `12px`, `236px`, `68px` | Desktop spacing and layout. |

Example: change the font with Google Fonts:

```css
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400..700&display=swap");

:root {
  --font: "Space Grotesk", system-ui, sans-serif;
  --display: "Space Grotesk", system-ui, sans-serif;
}
```
