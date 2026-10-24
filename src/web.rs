use std::{path::PathBuf, sync::Arc, time::Duration};

use axum::{
    Json, RequestExt, Router,
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, FromRequest, Request, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};
use tower_http::services::ServeDir;

use crate::{ADDRESS, ORIGIN, catalog, document::Document, render, session::Session};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DocumentRequest {
    document: Document,
    revision: u64,
}

impl DocumentRequest {
    fn validate_revision(&self) -> Result<(), String> {
        if self.revision > 9_007_199_254_740_991 {
            return Err("The session revision must be a safe nonnegative integer.".into());
        }
        Ok(())
    }
}

fn document_error(error: String) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": error })))
}

pub fn app(session: Arc<Session>, assets: PathBuf) -> Router {
    build_app(session, assets, None)
}

#[cfg(unix)]
pub fn app_with_compiler<E>(
    session: Arc<Session>,
    assets: PathBuf,
    compiler: Arc<crate::compiler::service::Compiler<E>>,
) -> Router
where
    E: crate::compiler::lifecycle::Engine + Send + 'static,
    E::Error: std::fmt::Display,
{
    build_app(
        session,
        assets,
        Some(crate::compiler::http::routes(compiler)),
    )
}

fn build_app(session: Arc<Session>, assets: PathBuf, compiler_routes: Option<Router>) -> Router {
    let enabled = compiler_routes.is_some();
    Router::new()
        .route("/api/session", post(start_session))
        .route("/api/health", get(move || health(enabled)))
        .route("/api/catalog", get(formula_catalog))
        .route("/api/documents/validate", post(validate_document))
        .route("/api/render", post(render_document))
        .fallback_service(ServeDir::new(assets))
        .with_state(session.clone())
        .merge(compiler_routes.unwrap_or_default())
        .layer(middleware::from_fn(bound_api_body))
        .layer(DefaultBodyLimit::max(1_048_576))
        .layer(middleware::from_fn_with_state(session, protect))
}

fn single_header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    let mut values = headers.get_all(name).iter();
    let value = values.next()?.to_str().ok()?;
    values.next().is_none().then_some(value)
}

async fn bound_api_body(mut request: Request, next: Next) -> Response {
    if request.uri().path().starts_with("/api/")
        && matches!(
            *request.method(),
            Method::POST | Method::PUT | Method::PATCH | Method::DELETE
        )
    {
        let (parts, body) = request.with_limited_body().into_parts();
        // Bound body collection only; compiler execution retains its own cleanup deadline.
        let bytes = match tokio::time::timeout(
            Duration::from_secs(5),
            Bytes::from_request(Request::new(body), &()),
        )
        .await
        {
            Ok(Ok(bytes)) => bytes,
            Ok(Err(error)) => return error.into_response(),
            Err(_) => {
                return (StatusCode::REQUEST_TIMEOUT, "The request body timed out.")
                    .into_response();
            }
        };
        request = Request::from_parts(parts, Body::from(bytes));
    }
    next.run(request).await
}

async fn protect(State(session): State<Arc<Session>>, request: Request, next: Next) -> Response {
    let headers = request.headers();
    let rejection = if single_header(headers, "host") != Some(ADDRESS) {
        Some((
            StatusCode::BAD_REQUEST,
            "The request host is not permitted.",
        ))
    } else if headers.contains_key("origin") && single_header(headers, "origin") != Some(ORIGIN) {
        Some((
            StatusCode::FORBIDDEN,
            "The request origin is not permitted.",
        ))
    } else if request.uri().path().starts_with("/api/") {
        authorize_api(&session, &request)
    } else {
        None
    };
    let mut response = match rejection {
        Some(error) => error.into_response(),
        None => next.run(request).await,
    };
    for (name, value) in [
        ("cache-control", "no-store"),
        ("referrer-policy", "no-referrer"),
        ("x-content-type-options", "nosniff"),
        ("cross-origin-resource-policy", "same-origin"),
        (
            "content-security-policy",
            "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self' blob: data:; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        ),
    ] {
        response
            .headers_mut()
            .insert(name, HeaderValue::from_static(value));
    }
    response
}

fn authorize_api(session: &Session, request: &Request) -> Option<(StatusCode, &'static str)> {
    let headers = request.headers();
    if single_header(headers, "x-texgen-client") != Some("1") {
        return Some((StatusCode::FORBIDDEN, "The app request header is required."));
    }
    if matches!(
        *request.method(),
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    ) {
        if single_header(headers, "origin") != Some(ORIGIN) {
            return Some((StatusCode::FORBIDDEN, "The app origin is required."));
        }
        if !single_header(headers, "content-type")
            .and_then(|value| value.split(';').next())
            .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/json"))
        {
            return Some((StatusCode::UNSUPPORTED_MEDIA_TYPE, "Use application/json."));
        }
    }
    if request.uri().path() != "/api/session"
        && !single_header(headers, "cookie").is_some_and(|cookies| session.authorizes(cookies))
    {
        return Some((
            StatusCode::UNAUTHORIZED,
            "Open a protected session with the launcher.",
        ));
    }
    None
}

async fn start_session(
    State(session): State<Arc<Session>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    if !body.as_object().is_some_and(|object| object.is_empty()) {
        return (
            StatusCode::BAD_REQUEST,
            "The session request must be an empty object.",
        )
            .into_response();
    }
    if !single_header(&headers, "authorization").is_some_and(|value| session.claim(value)) {
        return (
            StatusCode::UNAUTHORIZED,
            "The launch authorization is invalid or already used.",
        )
            .into_response();
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&session.cookie_header()).expect("random cookie is ASCII"),
    );
    println!("A protected browser session opened.");
    response
}

async fn formula_catalog() -> Json<&'static catalog::Catalog> {
    Json(catalog::bundled())
}

async fn validate_document(
    Json(request): Json<DocumentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    request.validate_revision().map_err(document_error)?;
    request.document.validate().map_err(document_error)?;
    Ok(Json(json!({
        "documentId": request.document.id,
        "revision": request.revision
    })))
}

async fn render_document(
    Json(request): Json<DocumentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    request.validate_revision().map_err(document_error)?;
    let source = render::tex(&request.document).map_err(document_error)?;
    Ok(Json(json!({
        "documentId": request.document.id,
        "revision": request.revision,
        "source": source
    })))
}

async fn health(enabled: bool) -> Json<Value> {
    Json(json!({
        "status": "ready",
        "version": env!("CARGO_PKG_VERSION"),
        "pdfCompilation": if enabled { "enabled" } else { "disabled" },
        "compilerReason": if enabled { "The protected compiler is available." } else { "Compilation is not opted in, or the verified local runtime is unavailable. Source editing and exports remain available." }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use tower::ServiceExt;

    async fn request(
        path: &str,
        method: Method,
        additions: &[(&str, &str)],
        body: &str,
    ) -> Response {
        let session = Arc::new(Session::new().unwrap());
        let mut request = Request::builder()
            .uri(path)
            .method(method)
            .header("host", ADDRESS)
            .header("x-texgen-client", "1");
        for (name, value) in additions {
            request = request.header(*name, *value);
        }
        app(session, PathBuf::from("ui/dist"))
            .oneshot(request.body(Body::from(body.to_owned())).unwrap())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn incomplete_session_bodies_finish_before_shutdown_can_wait_forever() {
        use http_body_util::{BodyExt, Full};
        let body =
            Full::new(axum::body::Bytes::from_static(b"{")).with_trailers(std::future::pending::<
                Option<Result<HeaderMap, std::convert::Infallible>>,
            >());
        let request = Request::builder()
            .method(Method::POST)
            .uri("/api/session")
            .header("host", ADDRESS)
            .header("origin", ORIGIN)
            .header("x-texgen-client", "1")
            .header("content-type", "application/json")
            .header("content-length", "2")
            .body(Body::new(body))
            .unwrap();
        let response = tokio::time::timeout(
            std::time::Duration::from_secs(6),
            app(Arc::new(Session::new().unwrap()), PathBuf::from("ui/dist")).oneshot(request),
        )
        .await
        .expect("An incomplete request must not block HTTP draining indefinitely.")
        .unwrap();
        assert_eq!(response.status(), StatusCode::REQUEST_TIMEOUT);
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert!(response.headers().contains_key("content-security-policy"));
    }

    #[tokio::test]
    async fn body_deadlines_preserve_the_existing_byte_limit() {
        let response = request(
            "/api/session",
            Method::POST,
            &[("origin", ORIGIN), ("content-type", "application/json")],
            &"x".repeat(1_048_577),
        )
        .await;
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(response.headers()["cache-control"], "no-store");
    }

    #[tokio::test]
    async fn body_deadlines_do_not_abort_a_slow_compiler_handler() {
        let session = Arc::new(Session::new().unwrap());
        let cookie = session.cookie_header();
        let compiler_routes = Router::new().route(
            "/api/compile",
            post(|| async {
                tokio::time::sleep(Duration::from_millis(5_100)).await;
                StatusCode::OK
            }),
        );
        let request = Request::builder()
            .method(Method::POST)
            .uri("/api/compile")
            .header("host", ADDRESS)
            .header("origin", ORIGIN)
            .header("x-texgen-client", "1")
            .header("content-type", "application/json")
            .header("cookie", cookie.split(';').next().unwrap())
            .body(Body::from("{}"))
            .unwrap();
        let response = tokio::time::timeout(
            Duration::from_secs(6),
            build_app(session, PathBuf::from("ui/dist"), Some(compiler_routes)).oneshot(request),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn unauthorized_requests_fail_with_security_headers() {
        let response = request("/api/health", Method::GET, &[], "").await;
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert_eq!(response.headers()["referrer-policy"], "no-referrer");
        assert!(
            !response
                .headers()
                .contains_key("access-control-allow-origin")
        );
    }

    #[tokio::test]
    async fn unrelated_origin_and_duplicate_host_fail() {
        assert_eq!(
            request(
                "/api/health",
                Method::GET,
                &[("origin", "https://unrelated.example")],
                ""
            )
            .await
            .status(),
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            request("/api/health", Method::GET, &[("host", "evil.example")], "")
                .await
                .status(),
            StatusCode::BAD_REQUEST
        );
    }

    #[tokio::test]
    async fn session_rejects_simple_requests_and_missing_origin() {
        assert_eq!(
            request(
                "/api/session",
                Method::POST,
                &[("origin", ORIGIN), ("content-type", "text/plain")],
                "{}"
            )
            .await
            .status(),
            StatusCode::UNSUPPORTED_MEDIA_TYPE
        );
        assert_eq!(
            request(
                "/api/session",
                Method::POST,
                &[("content-type", "application/json")],
                "{}"
            )
            .await
            .status(),
            StatusCode::FORBIDDEN
        );
    }

    #[tokio::test]
    async fn protected_session_opens_once_and_can_read_health() {
        let session = Arc::new(Session::new().unwrap());
        let token = session
            .launch_fragment()
            .trim_start_matches("#launch=")
            .to_owned();
        let app = app(session, PathBuf::from("ui/dist"));
        let bootstrap = || {
            Request::builder()
                .method(Method::POST)
                .uri("/api/session")
                .header("host", ADDRESS)
                .header("origin", ORIGIN)
                .header("x-texgen-client", "1")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::from("{}"))
                .unwrap()
        };
        let response = app.clone().oneshot(bootstrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let cookie = response.headers()[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .to_owned();
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Strict"));
        assert_eq!(
            app.clone().oneshot(bootstrap()).await.unwrap().status(),
            StatusCode::UNAUTHORIZED
        );
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/health")
                    .header("host", ADDRESS)
                    .header("x-texgen-client", "1")
                    .header("cookie", cookie.split(';').next().unwrap())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), 4096)
            .await
            .unwrap();
        let health: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(health["pdfCompilation"], "disabled");
    }
}
