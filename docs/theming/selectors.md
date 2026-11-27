# Selectors

Use CSS classes for details that variables cannot change. These are the main selectors currently used in Veloly; implementation details may change between versions, so short selectors and CSS variables are more durable.

## Layout

| Selector | Part of the interface |
| --- | --- |
| `.app` | The app window. It receives `.view-discover`, `.view-library`, `.view-settings`, and other page classes, plus `.has-track`, `.playing-on`, and `.expanded` when relevant. |
| `.sidebar`, `.sidenav`, `.main` | Desktop navigation and content columns. |
| `.topbar`, `.search`, `.content` | Search row and scrolling content. |
| `.page`, `.page-head`, `.section`, `.section-title` | Page and section layout. |
| `.tabbar` | Navigation tabs on phones. |

## Player and lyrics

| Selector | Part of the interface |
| --- | --- |
| `.player` | Persistent player bar. |
| `.now-btn`, `.now-title`, `.now-sub` | Current track in the player bar. |
| `.transport`, `.play-btn`, `.seek`, `.seek-played`, `.player-time` | Playback buttons, progress, and time. |
| `.side-controls`, `.volume`, `.slider` | Player controls and volume. |
| `.nowplaying` | Expanded Now Playing view. |
| `.np-bg`, `.np-art`, `.np-title`, `.np-sub`, `.np-album`, `.np-actions` | Now Playing background, cover, track details, and controls. |
| `.lyrics`, `.lyric`, `.lyric.on`, `.lyric.past`, `.lyric-word` | Lyrics list, active line, sung lines, and timed words. |

## Lists, cards, and controls

| Selector | Part of the interface |
| --- | --- |
| `.card`, `.card-art`, `.card-title`, `.card-sub`, `.card.playing` | Song, album, or playlist cards. |
| `.row`, `.row-title`, `.row-sub`, `.row-album`, `.row-time`, `.row-like`, `.row-more`, `.row-handle` | Song rows and list details. |
| `.cover` | Album artwork. |
| `.hero`, `.hero-title` | Artist, album, and playlist headers. |
| `.primary`, `.ghost`, `.icon-btn` | Primary, secondary, and icon buttons. |
| `.switch`, `.switch.on`, `.segmented`, `.menu`, `.menu-item`, `.dialog` | Toggles, choice controls, menus, and dialogs. |

Veloly and 555 share many selectors, including `.np-title`, `.lyric`, `.player`, `.card`, and `.row`. A 555 theme that targets selectors absent from the current Veloly version may need a small adjustment.
