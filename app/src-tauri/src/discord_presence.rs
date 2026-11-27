//! Optional Discord Rich Presence, sent over Discord's local desktop IPC.

use std::{
    sync::{
        OnceLock,
        mpsc::{self, Sender},
    },
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;

const APPLICATION_ID: &str = "1572227136381522100";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresencePayload {
    enabled: bool,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    artwork: Option<String>,
    status: String,
    position: f64,
    duration: Option<f64>,
    speed: f64,
}

static PRESENCE_SENDER: OnceLock<Sender<PresencePayload>> = OnceLock::new();

#[tauri::command]
pub fn set_discord_presence(payload: PresencePayload) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let sender = PRESENCE_SENDER.get_or_init(|| {
            let (sender, receiver) = mpsc::channel::<PresencePayload>();
            thread::Builder::new()
                .name("veloly-discord-presence".into())
                .spawn(move || {
                    run_presence_worker(receiver);
                })
                .expect("Discord presence worker could not start");
            sender
        });
        let _ = sender.send(payload);
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    let _ = payload;
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn run_presence_worker(receiver: mpsc::Receiver<PresencePayload>) {
    use discord_rich_presence::{
        DiscordIpc, DiscordIpcClient,
        activity::{self, ActivityType},
    };

    let mut client: Option<DiscordIpcClient> = None;
    while let Ok(payload) = receiver.recv() {
        let Some(title) = payload
            .title
            .as_deref()
            .filter(|_| payload.enabled && matches!(payload.status.as_str(), "playing" | "paused"))
        else {
            if let Some(connected) = client.as_mut() {
                if connected.clear_activity().is_err() {
                    client = None;
                }
            }
            continue;
        };

        if client.is_none() {
            let mut next = DiscordIpcClient::new(APPLICATION_ID);
            if let Err(error) = next.connect() {
                eprintln!("Discord Rich Presence unavailable: {error}");
                continue;
            }
            client = Some(next);
        }

        let artist = payload.artist.as_deref().unwrap_or("Unknown artist");
        let paused = payload.status == "paused";
        let mut activity = activity::Activity::new()
            .name("Veloly")
            .activity_type(ActivityType::Listening)
            .details(truncate(title, 128))
            .state(truncate(
                if paused {
                    format!("Paused · {artist}")
                } else {
                    artist.to_owned()
                }
                .as_str(),
                128,
            ));

        let image = payload
            .artwork
            .as_deref()
            .filter(|url| url.starts_with("https://"));
        let album = payload
            .album
            .as_deref()
            .filter(|value| !value.trim().is_empty());
        if image.is_some() || album.is_some() {
            let mut assets = activity::Assets::new();
            if let Some(image) = image {
                assets = assets.large_image(image);
            }
            if let Some(album) = album {
                assets = assets.large_text(truncate(album, 128));
            }
            activity = activity.assets(assets);
        }

        if !paused {
            if let Some(duration) = payload
                .duration
                .filter(|duration| duration.is_finite() && *duration > 0.0)
            {
                let speed = if payload.speed.is_finite() {
                    payload.speed.clamp(0.5, 1.5)
                } else {
                    1.0
                };
                let position = if payload.position.is_finite() {
                    payload.position.clamp(0.0, duration)
                } else {
                    0.0
                };
                let elapsed_ms = (position / speed * 1000.0) as i64;
                let remaining_ms = ((duration - position) / speed * 1000.0) as i64;
                let now_ms = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;
                activity = activity.timestamps(
                    activity::Timestamps::new()
                        .start(now_ms - elapsed_ms)
                        .end(now_ms + remaining_ms),
                );
            }
        }

        if let Some(connected) = client.as_mut() {
            if let Err(error) = connected.set_activity(activity) {
                eprintln!("Discord Rich Presence update failed: {error}");
                client = None;
            }
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}
