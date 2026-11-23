//! Source Jamendo : catalogue et lecture en continu.

use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;
use serde::Deserialize;

use crate::{Error, Location, MusicSource, Result, StreamData, Track};

const API: &str = "https://api.jamendo.com/v3.0";
pub struct JamendoSource {
    client: reqwest::Client,
    client_id: RwLock<Option<String>>,
}

#[derive(Deserialize)]
struct Response<T> {
    headers: Headers,
    #[serde(default = "empty_results")]
    results: Vec<T>,
}

fn empty_results<T>() -> Vec<T> { Vec::new() }

#[derive(Deserialize)]
struct Headers {
    status: String,
    error_message: Option<String>,
}

#[derive(Clone, Deserialize)]
struct ApiTrack {
    id: String,
    name: String,
    artist_name: String,
    duration: Option<f64>,
    album_name: Option<String>,
    album_id: Option<String>,
    album_image: Option<String>,
    image: Option<String>,
    audiodownload_allowed: Option<bool>,
    license_ccurl: Option<String>,
}

impl JamendoSource {
    pub fn new(client: reqwest::Client, client_id: Option<String>) -> Arc<Self> {
        Arc::new(Self { client, client_id: RwLock::new(clean_client_id(client_id)) })
    }

    pub fn set_client_id(&self, value: Option<String>) {
        *self.client_id.write() = clean_client_id(value);
    }

    fn client_id(&self) -> Result<String> {
        self.client_id.read().clone().ok_or_else(|| Error::Other("Ajoute le client_id Jamendo dans Réglages pour utiliser cette source".into()))
    }

    fn track_id(track: &Track) -> Result<&str> {
        if track.source != "jamendo" {
            return Err(Error::Other("Ce morceau ne vient pas de Jamendo".into()));
        }
        let id = track.id.strip_prefix("jamendo:").unwrap_or_default();
        if !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit()) { Ok(id) }
        else { Err(Error::Other("Identifiant Jamendo invalide".into())) }
    }

    async fn tracks(&self, params: &[(&str, String)]) -> Result<Vec<ApiTrack>> {
        let mut query = vec![("client_id", self.client_id()?), ("format", "json".into())];
        query.extend(params.iter().map(|(k, v)| (*k, v.clone())));
        let response: Response<ApiTrack> = self.client.get(format!("{API}/tracks/")).query(&query).send().await?.error_for_status()?.json().await?;
        if response.headers.status != "success" {
            return Err(Error::Other(response.headers.error_message.unwrap_or_else(|| "Erreur API Jamendo".into())));
        }
        Ok(response.results)
    }

    fn convert(&self, t: ApiTrack) -> Track {
        let id = t.id;
        Track {
            id: format!("jamendo:{id}"),
            source: "jamendo".into(),
            title: t.name,
            artist: t.artist_name,
            album: t.album_name,
            album_id: t.album_id,
            duration: t.duration,
            track_number: None,
            disc_number: None,
            artwork: t.album_image.or(t.image),
            has_cover: false,
            location: Location::Remote { remote_id: id },
            artists: Vec::new(),
            explicit: None,
            download_allowed: t.audiodownload_allowed,
            license_url: t.license_ccurl,
        }
    }

}

fn clean_client_id(value: Option<String>) -> Option<String> {
    value.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty() && s.len() <= 128)
}

#[async_trait]
impl MusicSource for JamendoSource {
    fn id(&self) -> &'static str { "jamendo" }
    fn name(&self) -> &'static str { "Jamendo" }

    async fn search(&self, query: &str, limit: usize) -> Result<Vec<Track>> {
        if query.trim().is_empty() || self.client_id.read().is_none() { return Ok(Vec::new()); }
        let records = self.tracks(&[
            ("search", query.trim().to_owned()),
            ("limit", limit.clamp(1, 50).to_string()),
            ("order", "popularity_month".into()),
            ("type", "single albumtrack".into()),
            ("audioformat", "mp32".into()),
        ]).await?;
        Ok(records.into_iter().map(|t| self.convert(t)).collect())
    }

    async fn featured(&self, limit: usize) -> Result<Vec<Track>> {
        if self.client_id.read().is_none() { return Ok(Vec::new()); }
        let records = self.tracks(&[
            ("limit", limit.clamp(1, 50).to_string()),
            ("order", "popularity_month".into()),
            ("type", "single albumtrack".into()),
            ("audioformat", "mp32".into()),
        ]).await?;
        Ok(records.into_iter().map(|t| self.convert(t)).collect())
    }

    async fn resolve(&self, track: &Track) -> Result<StreamData> {
        let id = Self::track_id(track)?.to_owned();
        let response = self
            .client
            .get(format!("{API}/tracks/file/"))
            .query(&[("client_id", self.client_id()?), ("id", id), ("action", "stream".into()), ("audioformat", "mp32".into())])
            .send()
            .await?
            .error_for_status()?;
        Ok(StreamData::Http { url: response.url().to_string(), ranged_len: None, hint: Some("mp3"), user_agent: None })
    }
}
