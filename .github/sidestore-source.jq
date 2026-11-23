# SideStore (and AltStore) source for Veloly, filled in by the release workflow (job `ios`).
# Format: https://faq.altstore.io/developers/make-a-source
{
  name: "Veloly",
  identifier: "app.yato.player.source",
  subtitle: "A light, fast music player.",
  description: "The iPhone and iPad version of Veloly. Add this source in SideStore to get new versions on your phone.",
  iconURL: "https://noob20-crt.github.io/Veloly/assets/apple-touch-icon.png",
  website: "https://noob20-crt.github.io/Veloly/",
  tintColor: "#9718ED",
  apps: [
    {
      name: "Veloly",
      bundleIdentifier: "app.yato.player",
      developerName: "amonre555",
      subtitle: "A light, fast music player.",
      localizedDescription: "Free and open source music player: search any song, play your own files, import playlists from Spotify, Deezer or YouTube Music, with lyrics and an equalizer.",
      iconURL: "https://noob20-crt.github.io/Veloly/assets/apple-touch-icon.png",
      tintColor: "#9718ED",
      category: "entertainment",
      versions: [
        {
          version: $version,
          buildVersion: $version,
          date: $date,
          localizedDescription: $notes,
          downloadURL: $url,
          size: $size,
          minOSVersion: "15.0"
        }
      ],
      appPermissions: {
        entitlements: [],
        privacy: {}
      }
    }
  ],
  news: []
}
