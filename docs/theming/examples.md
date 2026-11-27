# Examples

Paste these into **Settings → Personalization → Custom CSS**, or save one as a `.css` theme file.

## Squarer panels

```css
:root {
  --r-sm: 2px;
  --r-md: 4px;
  --r-lg: 6px;
  --r-pill: 6px;
}
```

## Always use one accent color

```css
:root {
  --blue: #ff6a2b !important;
  --blue-deep: #a8340a !important;
}
```

## Remove grain and glow

```css
.backdrop::after,
.np-bg::before {
  display: none;
}

.play-btn,
.card-play,
.switch.on {
  box-shadow: none;
}
```

## Larger lyrics

```css
.lyric {
  font-size: 40px;
  line-height: 1.25;
}

@media (max-width: 760px) {
  .lyric { font-size: 30px; }
}
```

## Grayscale covers until hover

```css
.cover {
  filter: grayscale(1);
  transition: filter .3s;
}

.card:hover .cover,
.np-art .cover {
  filter: none;
}
```

## A complete theme

```css
/*
 * @name Paper
 * @author your-name
 * @description Warm text, serif titles, and square corners.
 */
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..800&display=swap");

:root {
  --display: "Fraunces", Georgia, serif;
  --text: #f3eee4;
  --text-2: #b9b0a0;
  --blue: #c7843d !important;
  --blue-deep: #6b3f12 !important;
  --r-lg: 4px;
  --r-md: 3px;
}

.np-title,
.page-head h1 {
  font-weight: 500;
  letter-spacing: 0;
}
```
