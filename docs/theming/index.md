# Getting started

Veloly supports local CSS themes. You can edit Custom CSS live or import a `.css` file from your device. Theme selection, import, and custom CSS are stored locally; Veloly does not contact a theme gallery.

Styles are applied in this order:

1. Veloly’s built-in styles and selected main color.
2. The locally installed theme, if one is active.
3. Your Custom CSS, which is applied last.

## Try your first change

Open **Settings → Personalization → Custom CSS** and type:

```css
.np-title {
  font-style: italic;
}
```

Open Now Playing to see the song title in italics. Changes apply as you type and are saved on this device. Clear the field to remove your custom CSS.

## Install a theme file

In **Settings → Personalization → Themes**, choose **Import .css** and select a CSS file. Veloly installs and activates it locally. Use **None** to return to the default appearance, or remove a theme with the button beside its name.

Veloly is based on 555 and can use CSS adapted from compatible stylesheets, subject to their applicable license and attribution terms. Imported styles are not fetched, submitted, or updated through 555.

## Find what to style

- [CSS variables](./variables) are the most stable way to change colors, fonts, and corner sizes.
- [Selectors](./selectors) list the main parts of Veloly’s interface.
- [Examples](./examples) provide ready-to-paste snippets.
- [Theme files](./theme-files) explains how to import and keep several looks.

::: tip Phone and tablet layouts
Veloly also uses a compact layout on phones. Use `@media (max-width: 760px) { ... }` for styles that should only apply to smaller screens.
:::
