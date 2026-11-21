pub mod deezer;
pub mod local;
pub mod jamendo;
pub mod youtube;

pub use deezer::DeezerSource;
pub use local::{read_cover, LocalLibrary};
pub use jamendo::JamendoSource;
pub use youtube::YouTubeMusicSource;
