# Troubleshooting

## A local track is missing or will not play

Check that the original file still exists and that the folder is readable. If it was moved, add its new folder in **Library**. On mobile, use **Add audio files** again if the imported copy was removed from Veloly’s app storage.

## Android will not install an APK

Open the APK from the device and allow the selected browser or file manager to install apps when prompted. To update, use an APK signed with the same app identity and confirm Android’s installer prompt. Do not uninstall first if you want to preserve app-private local data.

## iPhone or iPad installation

Use the [iOS installation guide](https://zyndrax707.github.io/Veloly/ios.html) for SideStore setup and renewal. An `.ipa` cannot be installed by opening it directly in Files.

## YouTube playback on desktop

Some desktop YouTube playback paths require `yt-dlp` to be installed locally. Install it from its official source and ensure it is available on your system PATH. Mobile platforms use different playback paths.

## Lyrics are unavailable

Lyrics depend on the providers’ catalog and the metadata match. Retry while online, verify the track title and artist, and remember that some tracks have no available lyrics.

## Playlist sharing fails

Creating or opening a Veloly playlist link requires a connection to the configured link service. Try again while online. Local audio is not included in the link, so recipients need their own copy of those files.

## The app says an update is available but installation fails

Android requires you to confirm installation in the system package installer. iOS updates are installed through SideStore. Desktop updater packages must match the app’s signing configuration; if the in-app update cannot install, use the matching installer from [GitHub Releases](https://github.com/zyndrax707/Veloly/releases).
