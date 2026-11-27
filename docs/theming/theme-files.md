# Theme files

A theme is a plain `.css` file. Add an optional first comment to give it a name, author, and description:

```css
/*
 * @name Midnight Pink
 * @author your-name
 * @description Pink accents on black, with rounder covers.
 */

:root {
  --violet: #e11d74 !important;
  --violet-deep: #7a0c3d !important;
}

.cover {
  border-radius: 20px;
}
```

`@name` is shown in Veloly. If it is missing, the filename is used. `@author` and `@description` are optional.

## Import and switch themes

1. Open **Settings → Personalization**.
2. Select **Import .css**, then choose the theme file.
3. Veloly installs and activates it on this device.

Only one saved theme is active at a time. Choose **None** to return to the default Veloly appearance. Use the remove icon beside an imported theme to delete it. Your Custom CSS remains on top of the active theme.

## If a theme makes the app hard to use

On a keyboard, press **Ctrl+Shift+0** (or **⌘+Shift+0** on Mac) to temporarily turn off theme CSS and custom CSS for the current session. The saved styles return the next time Veloly starts. You can then choose **None**, remove the theme, or edit the CSS. On a touch-only device, use the **Clear CSS** button or remove the active theme from Settings.

## Limits and network access

- Imported theme files are limited to 256 KB each.
- CSS can style the interface but cannot run JavaScript.
- Imported themes and Custom CSS stay on this device. Veloly does not fetch themes from, submit CSS to, or check for theme updates from 555.
- A stylesheet can still request external resources if its CSS contains external URLs and the app's content security policy allows them.
