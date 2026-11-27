# Privacy and network use

Veloly does not require an account. Your library collection, preferences, and playlists are stored locally unless you explicitly use an online feature.

## When Veloly connects to the internet

Network requests are needed for online search and playback, artwork and metadata, lyrics, playlist link sharing, and checking for app updates. These requests may go to the corresponding service or to Veloly’s configured sharing/update infrastructure. Theme import, selection, and Custom CSS are local and do not contact 555.

## Discord Rich Presence

Discord status sharing is off by default and available on desktop only. When you enable it, Veloly sends the current song title, artist, album, an HTTPS cover URL when available, and playback timing to the Discord desktop client over local IPC. Discord may show this information on your profile according to your Discord activity-sharing settings. Turning the option off clears Veloly’s activity.

## Playlist links

Sharing a playlist sends its track metadata to the link service so it can be opened by another person. Local audio files and their local paths are not uploaded.

## Optional first-launch count and feedback

If anonymous first-launch counting is enabled in the app build, the app sends a one-time installation identifier to the configured counter. Feedback is sent only after you submit it; the message category and app version are included. Review the current Settings text for the options available in your build.

## Open source

Veloly is an independent, unaffiliated project based on [555](https://github.com/amonre555/555), distributed under GPL-3.0-or-later. Its source is available on [GitHub](https://github.com/zyndrax707/Veloly).
