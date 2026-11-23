/**
 * Étapes affichées par le bouton « Need help to do it? » dans la Bibliothèque.
 * Tu peux modifier les titres et les textes ici. Enregistre puis reconstruis Veloly pour
 * distribuer la nouvelle version du tutoriel.
 */
export const offlineGuide = {
  en: {
    title: "Add your own music",
    intro: "Veloly plays audio files stored on your device. It does not copy, move or delete your originals.",
    steps: [
      { title: "Put your music in a folder", text: "Use MP3, FLAC, OGG, M4A/AAC, WAV, AIFF or another supported audio file you own or are allowed to use." },
      { title: "Choose Add a folder", text: "In the Library, tap Add a folder and choose the folder containing your music." },
      { title: "Wait for the scan", text: "Veloly reads the audio tags and adds the tracks it finds. If you add or move files later, tap Rescan." },
      { title: "Play offline", text: "Your local files are available without an internet connection. Turn on Offline mode to keep playback to files on this device." },
      { title: "Remove safely", text: "The × beside a folder removes it from Veloly's Library only. It never deletes the audio files from your device." },
    ],
  },
  fr: {
    title: "Ajouter ta propre musique",
    intro: "Veloly lit les fichiers audio présents sur ton appareil. Il ne copie, ne déplace et ne supprime pas les originaux.",
    steps: [
      { title: "Range ta musique dans un dossier", text: "Utilise des fichiers MP3, FLAC, OGG, M4A/AAC, WAV, AIFF ou un autre format pris en charge, que tu possèdes ou peux utiliser." },
      { title: "Choisis Ajouter un dossier", text: "Dans la Bibliothèque, touche Ajouter un dossier et sélectionne le dossier qui contient ta musique." },
      { title: "Attends la fin du scan", text: "Veloly lit les informations des fichiers et ajoute les morceaux trouvés. Après avoir ajouté ou déplacé des fichiers, touche Rescanner." },
      { title: "Écoute hors ligne", text: "Tes fichiers locaux sont disponibles sans connexion. Active le mode hors ligne pour limiter la lecture aux fichiers de cet appareil." },
      { title: "Retire un dossier sans risque", text: "Le × à côté d’un dossier le retire seulement de la Bibliothèque Veloly. Il ne supprime jamais les fichiers audio de ton appareil." },
    ],
  },
} as const;
