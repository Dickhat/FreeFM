use axum::{
    extract::Request,
    http::{HeaderValue, Method},
    routing::Router,
};
use axum_server::tls_rustls::RustlsConfig;
use serde::Deserialize;
use std::fs;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

// Структура для отображения файла конфигурации
#[derive(Debug, Deserialize)]
struct Settings {
    music_dir: String,
    server_addr: String,
    certs: CertSettings,
}

#[derive(Debug, Deserialize)]
struct CertSettings {
    cert_path: PathBuf,
    key_path: PathBuf,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // 1. Читаем конфиг
    let config_contents = fs::read_to_string("config.toml")
        .expect("Не удалось найти файл config.toml");
    let settings: Settings = toml::from_str(&config_contents)
        .expect("Ошибка парсинга config.toml");

    // Используем настройки из конфига
    let music_dir = settings.music_dir.clone();

    let cors = CorsLayer::new()
        .allow_origin("https://open.spotify.com".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET])
        .allow_headers(Any);

    let app = Router::new()
        .nest_service("/tracks", ServeDir::new(&music_dir))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http().on_request(move |request: &Request<_>, _span: &_| {
                    let path = request.uri().path();
                    println!("--> Запрос файла: {}", path);
                    
                    // Проверка пути внутри замыкания
                    let full_path = Path::new("./music").join(path.trim_start_matches('/'));
                    if !full_path.exists() {
                        println!("    [!] Файл НЕ найден: {:?}", full_path);
                    }
                }))
                .layer(cors)
        );

    // 2. Загружаем SSL используя пути из конфига
    let tls_config = RustlsConfig::from_pem_file(
        settings.certs.cert_path,
        settings.certs.key_path,
    )
    .await
    .expect("Ошибка: Не удалось загрузить SSL сертификаты по путям из конфига");

    let addr: SocketAddr = settings.server_addr.parse()
        .expect("Некорректный адрес сервера в config.toml");
    
    println!("🚀 Production HTTPS сервер запущен на {}", addr);

    axum_server::bind_rustls(addr, tls_config)
        .serve(app.into_make_service())
        .await
        .unwrap();
}