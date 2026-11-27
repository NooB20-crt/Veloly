//! Réglages de l'app et écoute en cours, gardés dans de petits fichiers JSON.

use std::{collections::BTreeMap, fs, path::Path};

use serde::{Deserialize, Serialize, de::DeserializeOwned};

/// Ce que l'utilisateur règle dans la page Réglages.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Fondu enchaîné entre deux morceaux, en secondes (0 : aucun).
    pub crossfade: f64,
    /// Reprendre l'écoute (file, morceau, position) au lancement.
    pub resume: bool,
    /// Ne lire que les fichiers audio présents sur l'appareil.
    pub offline_only: bool,
    /// Publier facultativement le morceau en cours dans le statut Discord.
    pub discord_presence: bool,
    /// Égaliseur, réverbération et vitesse.
    pub fx: yato_core::fx::FxSettings,
    /// Profil d'effets mémorisé pour chaque sortie audio.
    pub output_profiles: BTreeMap<String, yato_core::fx::FxSettings>,
    /// Sortie audio choisie (identifiant) ; `None` : celle du système.
    pub output_device: Option<String>,
    /// Identifiant public d'application Jamendo, fourni par son portail développeur.
    pub jamendo_client_id: Option<String>,
    /// Couleurs de marque choisies par l'utilisateur.
    pub customization: Customization,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Customization {
    pub primary_color: String,
    pub secondary_color: String,
}

impl Default for Customization {
    fn default() -> Self {
        Self { primary_color: "#9718ed".into(), secondary_color: "#d17aff".into() }
    }
}

impl Customization {
    pub fn sanitize(&mut self) {
        sanitize_color(&mut self.primary_color, "#9718ed");
        sanitize_color(&mut self.secondary_color, "#d17aff");
    }
}

fn sanitize_color(value: &mut String, fallback: &str) {
    if value.len() != 7 || !value.starts_with('#') || !value[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        *value = fallback.into();
    } else {
        value.make_ascii_lowercase();
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self { crossfade: 0.0, resume: true, offline_only: false, discord_presence: false, fx: Default::default(), output_profiles: BTreeMap::new(), output_device: None, jamendo_client_id: None, customization: Customization::default() }
    }
}

impl Settings {
    /// Les réglages retirés de l'interface reprennent leurs valeurs sûres.
    pub fn retire_removed_sound_options(&mut self) {
        fn reset(fx: &mut yato_core::fx::FxSettings) {
            fx.normalize = false;
            fx.limiter = true;
            fx.channel_mode = yato_core::fx::ChannelMode::Stereo;
        }
        reset(&mut self.fx);
        for fx in self.output_profiles.values_mut() { reset(fx); }
    }
}

/// Lit un fichier JSON ; valeur par défaut s'il n'existe pas (mis de côté s'il est illisible).
pub fn load<T: DeserializeOwned + Default>(path: &Path) -> T {
    yato_core::load_json(path)
}

/// Écrit un fichier JSON d'un coup (fichier temporaire puis renommage : jamais à moitié écrit).
pub fn save<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec(value).map_err(std::io::Error::other)?)?;
    fs::rename(tmp, path)
}
