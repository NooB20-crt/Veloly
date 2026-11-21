//! Utilise yt-dlp s'il est déjà présent sur l'appareil.
//!
//! Veloly ne télécharge, n'installe et ne met à jour aucun exécutable depuis Internet.

use std::{path::{Path, PathBuf}, sync::Arc};

use parking_lot::Mutex;
use serde::Serialize;

use crate::{Error, Result};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum YtDlpStatus {
    Unknown,
    Installing { progress: f32 },
    Ready,
    System { path: PathBuf },
    Error { message: String },
}

pub struct YtDlp {
    dir: PathBuf,
    client: reqwest::Client,
    js_runtime: Mutex<Option<Option<Vec<String>>>>,
}

impl YtDlp {
    pub fn new(dir: PathBuf, client: reqwest::Client) -> Arc<Self> {
        Arc::new(Self { dir, client, js_runtime: Mutex::new(None) })
    }

    pub fn client(&self) -> &reqwest::Client {
        &self.client
    }

    pub fn status(&self) -> YtDlpStatus {
        if cfg!(any(target_os = "android", target_os = "ios")) {
            return YtDlpStatus::Ready;
        }
        let managed = self.managed();
        match managed.clone().or_else(find_system_ytdlp) {
            Some(_) if managed.is_some() => YtDlpStatus::Ready,
            Some(path) => YtDlpStatus::System { path },
            None => YtDlpStatus::Error { message: "yt-dlp doit être installé localement pour lire YouTube sur ordinateur".into() },
        }
    }

    /// Renvoie une version déjà présente sur l'appareil, sans accès réseau.
    pub async fn path(&self) -> Result<PathBuf> {
        if cfg!(any(target_os = "android", target_os = "ios")) {
            return Err(Error::Other("yt-dlp n'est pas utilisé sur mobile".into()));
        }
        let path = self.managed().or_else(find_system_ytdlp).ok_or_else(|| {
            Error::Other("yt-dlp n'est pas installé. Veloly ne le télécharge pas automatiquement.".into())
        })?;
        Ok(path)
    }

    pub fn js_runtime_args(&self) -> Vec<String> {
        let mut cache = self.js_runtime.lock();
        cache
            .get_or_insert_with(|| {
                let found = find_program("deno", &winget_package_dirs("DenoLand.Deno_"))
                    .map(|p| ("deno", p))
                    .or_else(|| find_program("node", &[]).map(|p| ("node", p)))
                    .or_else(|| find_program("bun", &[]).map(|p| ("bun", p)));
                found.map(|(name, path)| vec!["--js-runtimes".into(), format!("{name}:{}", path.display())])
            })
            .clone()
            .unwrap_or_default()
    }

    fn managed(&self) -> Option<PathBuf> {
        let hash = std::fs::read_to_string(self.dir.join("current")).ok()?;
        let hash = hash.trim();
        (hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()))
            .then(|| find_executable(&self.dir.join(&hash[..16])))
            .flatten()
    }
}

fn find_executable(dir: &Path) -> Option<PathBuf> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path.file_name().is_some_and(|name| {
                    let name = name.to_string_lossy();
                    name.starts_with("yt-dlp") && (!cfg!(windows) || name.ends_with(".exe"))
                })
        })
        .collect();
    files.sort();
    files.into_iter().next()
}

fn winget_package_dirs(prefix: &str) -> Vec<PathBuf> {
    let Some(local) = std::env::var_os("LOCALAPPDATA") else { return Vec::new() };
    let winget = PathBuf::from(local).join("Microsoft").join("WinGet");
    let mut dirs = vec![winget.join("Links")];
    if let Ok(entries) = std::fs::read_dir(winget.join("Packages")) {
        dirs.extend(entries.flatten().filter(|e| e.file_name().to_string_lossy().starts_with(prefix)).map(|e| e.path()));
    }
    dirs
}

fn find_program(name: &str, extra_dirs: &[PathBuf]) -> Option<PathBuf> {
    let file = if cfg!(windows) { format!("{name}.exe") } else { name.to_owned() };
    std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .chain(extra_dirs.iter().cloned())
        .map(|dir| dir.join(&file))
        .find(|path| path.is_file())
}

pub fn find_system_ytdlp() -> Option<PathBuf> {
    find_program("yt-dlp", &winget_package_dirs("yt-dlp.yt-dlp_"))
}
